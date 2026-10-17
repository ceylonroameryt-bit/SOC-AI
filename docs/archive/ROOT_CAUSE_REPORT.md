# SOC-AI Ingestion System — Root Cause Report
**Document ID**: ROOT-CAUSE-REPORT-2026-10-04  
**Project**: NO ENTRY — Threat Intelligence Platform / SOC-AI  
**Classification**: Production Engineering Diagnostic

---

## 1. Architecture Summary

The SOC-AI ingestion ecosystem operates as a hybrid pipeline combining standalone scheduled collector jobs (GitHub Actions cron) and in-process API endpoints (Express on Node.js / Vercel Serverless).

### Current System Topology:
```
┌─────────────────────────────────────────────────────────────┐
│                    SCHEDULING & TRIGGERS                    │
├──────────────────────────────┬──────────────────────────────┤
│ 1. GitHub Actions Cron       │ 2. Express Server Boot /     │
│    (15 */2 * * *)            │    setInterval (30m) /       │
│    Runs: server/collector.js │    POST /api/news/refresh    │
└──────────────┬───────────────┴──────────────┬───────────────┘
               │                              │
               ▼                              ▼
      [collector.js CLI]             [newsService.js API]
       Concurrency: 5                 Concurrency: 10 chunks
       Lock: .collector.lock          Lock: NONE
       Runs DB Log: YES               Runs DB Log: NO
               │                              │
               └──────────────┬───────────────┘
                              ▼
                 [Third-Party RSS / Atom Feeds]
                 (500 configured feeds globally)
                              │
                              ▼
                     [Parser: rss-parser]
                     Timeout: 10s
                     Retry: NONE
                     SSRF Check: NONE
                     Max Size: NONE
                              │
                              ▼
                     [Normalization & Classification]
                     Severity Engine & Classification Engine
                     URL Normalization: NONE
                              │
                              ▼
                 [Storage: PostgreSQL / In-Memory DAO]
                 Table: intel_articles (ON CONFLICT DO UPDATE)
                 Duplicate Detection: Broken (Returns ID on update)
                 IOCs: Sequential N+1 unbatched queries
```

---

## 2. Complete Ingestion Flow

1. **Source Discovery**: Feeds are loaded from [`server/data/sources.json`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/data/sources.json) via `feedHealthService.getUniqueSources()`.
2. **Batching**: Sources are sliced into concurrent workers (`mapConcurrent` with 5 in `collector.js`, or chunks of 10 in `newsService.js`).
3. **Network Request**: Direct HTTP GET issued via `parser.parseURL(source.url)` with `User-Agent: NO-ENTRY-ThreatIntel-Collector/1.0`.
4. **Parsing**: `rss-parser` parses XML to JavaScript object (`feed.items`).
5. **Item Traversal**: Each item in `feed.items` is processed sequentially:
   - Mandatory check: `raw.title` and `raw.link`.
   - Date verification: Missing publication dates set to `null`; future dates flagged with `dateAnomaly: true`.
   - Severity Assessment: Evaluates title/content keywords to assign `Critical`, `High`, `Medium`, `Low`, or `Informational`.
   - Classification Engine: Maps to taxonomy category (`threat-actor`, `vulnerability`, `ransomware`, `advisory`, etc.).
   - Database Persistence: Calls `insertArticle(record)`.
   - IOC Extraction: Regex extraction for IPv4, CVE, and SHA256 hashes inserted sequentially into `iocs` table.
6. **Health Tracking**: Records success/failure in `feedHealthService` and writes to `source_health` table.
7. **Run Completion**: Standalone collector updates `collection_runs` table with summary telemetry.

---

## 3. Critical Root Causes

### Root Cause 1: Duplicate Articles Masked by Database Return Semantics
In `server/db/db.js`, `insertArticle` executes:
```sql
INSERT INTO intel_articles (...) VALUES (...)
ON CONFLICT (canonical_url) DO UPDATE SET ...
RETURNING id;
```
PostgreSQL returns the `id` of the updated row whenever a conflict occurs. In memory, `memStore.articles` also updates the existing element and returns its ID.  
Because `articleId` was non-null, callers (`collector.js` line 260 and `newsService.js` line 167) incremented `feedAccepted++` and `totalAccepted++`.  
**Consequence**: The system had zero ability to distinguish between newly discovered intelligence and existing duplicate records. Every collection run falsely reported 100% of received items as "accepted".

### Root Cause 2: Missing URL Normalization & Layered Deduplication
A single cybersecurity advisory is routinely syndicated across multiple feed aggregators with tracking parameters:
- `https://thehackernews.com/2026/10/critical-flaw.html?utm_source=feedburner`
- `https://thehackernews.com/2026/10/critical-flaw.html?utm_medium=rss`
- `https://thehackernews.com/2026/10/critical-flaw.html`
Without URL normalization, these three URLs produce three distinct rows in `intel_articles`, polluting the dashboard, search index, and reports with duplicate stories.

### Root Cause 3: Split-Brain Ingestion Engines
Two distinct implementations (`collector.js` vs `newsService.js`) duplicated feed parsing, article mapping, date checking, and IOC insertion.  
- `collector.js` maintained run logging in `collection_runs` and a local lockfile, but was not invoked by web routes.
- `newsService.js` was invoked by `POST /api/news/refresh`, server boot, and `setInterval`, but did not record `collection_runs` and had no locking.  
This fragmentation created inconsistent states where UI refreshes produced no run audit logs.

### Root Cause 4: Fragile Feed Parsing on Atom Variants
Standard Atom feeds frequently represent links as an array of objects or an object with XML attributes:
```json
"link": [
  { "$": { "rel": "self", "type": "application/atom+xml", "href": "..." } },
  { "$": { "rel": "alternate", "type": "text/html", "href": "https://example.com/advisory" } }
]
```
Calling `raw.link.trim()` on an array throws `TypeError: raw.link.trim is not a function`, instantly crashing the source fetch and dropping all articles in that feed.

### Root Cause 5: Absence of Retries, Backoff, and Granular Error Extraction
Neither engine retried transient errors. Catch blocks uniformly stamped:
```javascript
httpStatus: 500,
errorCategory: 'FETCH_ERROR'
```
DNS resolution errors (`ENOTFOUND`), connection resets (`ECONNRESET`), socket timeouts (`ETIMEDOUT`), HTTP 404 dead links, HTTP 429 rate limits, and HTTP 403 WAF blocks were all recorded as `500 FETCH_ERROR`. This made root-cause diagnosis of failing feeds impossible for administrators.

---

## 4. Why Fetching Becomes Unreliable

1. **Cascade Failures on Atom/Malformed Feeds**: Because a parsing error threw an exception inside the item loop, an entire feed of 50 articles was discarded if one item had an unusual link structure.
2. **Serverless Execution Limits**: On Vercel, serverless function executions terminate after 15 seconds. Running `POST /api/news/refresh` across 500 sources in chunks of 10 exceeds 15 seconds, causing Vercel to terminate the process mid-fetch.
3. **Transient Network Fluctuation**: Without 2-3 retries with jitter, normal internet packet loss and DNS hiccups cause 15-30 feeds to bounce between healthy and degraded states on every cycle.
4. **N+1 Database Query Saturation**: 500 articles with 3 IOCs execute 1,500 sequential SQL queries, exhausting connection pool clients and causing query timeouts.

---

## 5. Deployment Limitations

| Environment | Mechanism | Limitation | Required Architecture |
|---|---|---|---|
| **Vercel Serverless** | Web API (`/api/*`) | 15s execution timeout; no writable filesystem; no background threads | Reads database only; refresh endpoint queues run or triggers standalone worker |
| **GitHub Actions** | Standalone CLI (`collector.js`) | 10m job timeout; external to web server; runs on schedule | Authoritative collector writing to PostgreSQL database with run auditing |
| **Local Node Server** | Long-running process | Runs web server + optional collector | Can run background collector with run mutex |

---

## 6. Database-Related Issues

1. **Duplicate Detection Semantics**: `ON CONFLICT (canonical_url) DO UPDATE` must use `(xmax = 0)` to signal whether the row was genuinely inserted or updated.
2. **Unbatched IOC Inserts**: Inserting IOCs one-by-one inside a loop causes connection pool starvation.
3. **Missing Indexes**: Indexes needed for `canonical_url`, `normalized_url`, `published_at`, `created_at`, `severity`, and `intel_category`.

---

## 7. Concurrency & Locking Issues

1. **Filesystem Lock Failure**: `.collector.lock` works for a single machine CLI, but is invisible across serverless functions or container replicas.
2. **Lack of In-Process Mutex**: Rapid calls to `POST /api/news/refresh` trigger multiple simultaneous collection sweeps.
3. **Target Concurrency**: Fixed concurrency of 5 (CLI) or 10 (chunks) cannot be tuned per environment.

---

## 8. Feed Parser & Security Issues

1. **SSRF Vulnerability**: Feed URLs are not inspected for internal IPs (`127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.169.254`).
2. **Unbounded Response Size**: Feeds can return unlimited payload size, causing memory exhaustion.
3. **Missing Accept Headers**: Strict publishers reject requests lacking RSS/Atom MIME types.

---

## 9. Recommended Architecture

Consolidate all fetching logic into a modular, production-grade **Central Ingestion Engine** (`server/services/ingestion/`):

```
server/services/ingestion/
  ├── types.js            # Unified data contracts (FetchResult, ParsedArticle, FetchJobSummary)
  ├── urlNormalizer.js    # Layered URL cleaner (strips tracking, anchors, trailing slashes)
  ├── ssrfGuard.js        # Validates public IP and HTTP/HTTPS protocols
  ├── feedFetcher.js      # Robust fetcher with timeouts (12s), size limit (5MB), Accept headers
  ├── feedParser.js       # RSS 2.0 & Atom parser with link array resolution and fallback
  ├── retryEngine.js      # Exponential backoff with jitter for retryable HTTP & network errors
  ├── deduplicator.js     # Exact URL, normalized URL, and title fingerprint deduplication
  ├── articlePipeline.js  # Normalization, validation, severity, classification, and batching
  ├── sourceCheckpoint.js # Tracks source attempt priority (oldest attempted first)
  └── ingestionEngine.js  # Central coordinator used by both CLI collector and API refresh
```

### Key Architectural Invariants:
1. **Isolated Source Failures**: Every source produces an independent `FetchResult` (`success`, `failed`, `timeout`, `empty`). A failed source NEVER interrupts others.
2. **Truthful Duplicate Metrics**: Ingestion reports exact counts: `received`, `inserted`, `duplicates`, `updated`, `rejected`.
3. **Decoupled Enrichment**: MITRE and AI processing are independent stages. Failure in MITRE mapping never causes article drops.
4. **Centralized Job History**: Every run (CLI, schedule, or API) creates and finalizes a record in `collection_runs`.
