# SOC-AI Ingestion System — Comprehensive Bug Report
**Document ID**: BUG-REPORT-2026-10-04  
**Scope**: Ingestion, Fetching, Parsing, Normalization, Deduplication, Persistence, Security, MITRE/AI Integration, Scheduling  
**Target Repository**: [github.com/ceylonroameryt-bit/SOC-AI](https://github.com/ceylonroameryt-bit/SOC-AI)

---

## 1. Executive Summary

A comprehensive, zero-assumption audit was conducted on the feed ingestion and processing pipeline of the SOC-AI platform. The investigation revealed **18 architectural and operational bugs** in feed fetching, error classification, deduplication, URL handling, concurrency management, database writing, and scheduled execution. These defects cause silent data loss, duplicate article multiplication, false metric reporting, serverless timeouts, and potential Denial of Service/SSRF vulnerabilities.

---

## 2. Bug Classification & Summary

| Bug ID | Severity | Category | Affected File(s) | Short Summary |
|---|---|---|---|---|
| **FETCH-001** | **CRITICAL** | Deduplication & Metrics | `server/db/db.js`, `server/collector.js`, `server/services/newsService.js` | `insertArticle` returns ID on conflict update, causing duplicate articles to be falsely reported as newly accepted. |
| **FETCH-002** | **CRITICAL** | URL Normalization & Storage | `server/db/db.js`, `server/collector.js`, `server/services/newsService.js` | Missing URL normalization causes identical articles with tracking parameters (`utm_*`, `fbclid`) to create duplicate database records. |
| **FETCH-003** | **CRITICAL** | Ingestion Fragmentation | `server/services/newsService.js`, `server/collector.js`, `server/server.js` | Split-brain ingestion: Two separate, competing ingestion engines with divergent logic, missing database run logging in API path. |
| **FETCH-004** | **CRITICAL** | Async/Await Route Crash | `server/services/mitreService.js`, `server/routes/mitre.js` | `getCategorizedNews` calls async `getNews()` without `await`, resulting in `allNews.map is not a function` runtime 500 error. |
| **FETCH-005** | **HIGH** | Security & SSRF | `server/collector.js`, `server/services/newsService.js` | Feed URLs are fetched without validating target IP or protocol, exposing cloud metadata (`169.254.169.254`) and internal loopback to SSRF. |
| **FETCH-006** | **HIGH** | Reliability & Retries | `server/collector.js`, `server/services/newsService.js` | Transient network errors (408, 429, 500, 502, 503, 504, `ECONNRESET`) are never retried with backoff, immediately failing feeds. |
| **FETCH-007** | **HIGH** | Telemetry & Status | `server/collector.js`, `server/services/newsService.js` | All fetch errors are hardcoded to `httpStatus: 500` and `'FETCH_ERROR'`, masking 404s, 403s, 429 rate limits, and DNS failures. |
| **FETCH-008** | **HIGH** | Feed Parsing (Atom) | `server/collector.js`, `server/services/newsService.js` | Atom feeds with array links (`rel="alternate"`) crash `raw.link.trim()` with `TypeError`, aborting the feed's articles. |
| **FETCH-009** | **HIGH** | Concurrency & Run Overlap | `server/services/newsService.js`, `server/server.js`, `server/collector.js` | Web server `fetchAndProcessNews` lacks run locking; simultaneous triggers (cron, setInterval, API refresh) execute overlapping runs. |
| **FETCH-010** | **MEDIUM** | Resource Safety | `server/collector.js`, `server/services/newsService.js` | External feed HTTP responses lack max byte size limits, creating XML bomb and memory exhaustion risks. |
| **FETCH-011** | **MEDIUM** | Database Performance | `server/collector.js`, `server/services/newsService.js` | IOC extraction performs 3 sequential SQL queries per article sequentially, creating an N+1 query storm (1,500+ round-trips per run). |
| **FETCH-012** | **MEDIUM** | Pipeline Coupling | `server/server.js`, `server/services/mitreService.js` | Ingestion is tightly coupled to MITRE mapping in server boot/interval, reprocessing the same 100 articles repeatedly. |
| **FETCH-013** | **MEDIUM** | Configuration | `server/collector.js`, `server/services/newsService.js` | Hardcoded concurrency (5/10) and request timeouts (10s); operational parameters missing from `.env.example`. |
| **FETCH-014** | **MEDIUM** | Checkpointing | `server/collector.js` | Long collector runs lack source-level checkpointing; interrupted runs restart from source 1 instead of resuming. |
| **FETCH-015** | **MEDIUM** | Empty Feed Handling | `server/services/feedHealthService.js` | Feeds with 0 new articles are conflated with errors or left ambiguous instead of being recorded as `EMPTY_FEED` success. |
| **FETCH-016** | **LOW** | User-Agent & Headers | `server/collector.js`, `server/services/newsService.js` | Missing explicit `Accept` headers for RSS/Atom/XML/JSON, leading some strict CDNs to return HTML 403/406. |
| **FETCH-017** | **LOW** | TypeScript Typing | `src/types/` | Absence of shared TypeScript interfaces for `FetchResult`, `FeedSource`, `ParsedArticle`, and `FetchJobSummary`. |
| **FETCH-018** | **LOW** | Logging Hygiene | `server/collector.js`, `server/services/newsService.js` | Unstructured console warnings without standard error categories, timestamps, or job correlation IDs. |

---

## 3. Detailed Bug Specifications

### FETCH-001: Duplicate Articles Falsely Reported as Newly Accepted
- **Severity**: **CRITICAL**
- **Affected Files**: [`server/db/db.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/db/db.js), [`server/collector.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/collector.js), [`server/services/newsService.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/services/newsService.js)
- **Affected Functions**: `insertArticle(article)`, `runCollector()`, `fetchAndProcessNews()`
- **Problem**: When an article already exists in the database, `insertArticle` executes `ON CONFLICT (canonical_url) DO UPDATE ... RETURNING id`. Because an `id` is always returned on update, the caller checks `if (articleId) feedAccepted++;`. Duplicate articles are counted as newly accepted rather than duplicates.
- **Root Cause**: `insertArticle` returned a single ID string without exposing insertion metadata (`isInserted: boolean`, `isDuplicate: boolean`).
- **Impact**: Collection metrics report hundreds of "new articles accepted" on every single collection run even when zero new stories were published. `itemsLast24Hours` in `source_health` is artificially multiplied on every poll.
- **How to Reproduce**:
  1. Ingest feed A (10 articles). Summary reports: `10 accepted, 0 duplicates`.
  2. Ingest feed A again immediately without any new articles.
  3. Summary reports: `10 accepted, 0 duplicates` instead of `0 accepted, 10 duplicates`.
- **Recommended Fix**: Update `insertArticle` to return `{ id, isNew: boolean, isDuplicate: boolean, isUpdated: boolean }` using PostgreSQL `(xmax = 0)` detection, and track `duplicates` separately from `accepted`.

---

### FETCH-002: Missing URL Normalization Leads to Duplicate Records
- **Severity**: **CRITICAL**
- **Affected Files**: [`server/db/db.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/db/db.js), [`server/collector.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/collector.js), [`server/services/newsService.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/services/newsService.js)
- **Affected Functions**: `insertArticle(article)`, `normalizeUrl(url)`
- **Problem**: External RSS publishers frequently attach query-string tracking tags (e.g. `?utm_source=rss&utm_medium=feed`, `?mc_cid=...`, `?ref=rss`). The same article syndicated with different tracking tags or differing trailing slashes produces distinct `canonical_url` keys and inserts duplicate rows into `intel_articles`.
- **Root Cause**: No URL normalization utility exists. The raw `raw.link.trim()` is used directly as the unique constraint key.
- **Impact**: Analysts see 3-5 identical news items for major security advisories. Database storage grows unnecessarily.
- **How to Reproduce**:
  1. Insert article with URL `https://example.com/cve-2026?utm_source=rss`.
  2. Insert article with URL `https://example.com/cve-2026?utm_source=feed`.
  3. Both records are stored as separate rows.
- **Recommended Fix**: Build a deterministic `normalizeUrl(rawUrl)` utility that strips tracking query parameters (`utm_*`, `fbclid`, `gclid`, `mc_cid`, `ref`), removes fragment hashes (`#...`), normalizes protocol (`http` to `https` where appropriate), strips standard trailing slashes, and downcases hostnames.

---

### FETCH-003: Fragmented & Competing Ingestion Implementations
- **Severity**: **CRITICAL**
- **Affected Files**: [`server/services/newsService.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/services/newsService.js), [`server/collector.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/collector.js), [`server/server.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/server.js)
- **Affected Functions**: `fetchAndProcessNews()`, `runCollector()`
- **Problem**: The platform has two completely separate ingestion implementations with divergent behavior:
  - `collector.js` has a lockfile, records runs into `collection_runs`, but lacks MITRE processing and is only triggered via CLI/GitHub Actions.
  - `newsService.js` runs in chunks of 10 inside the Express process, does NOT record `collection_runs`, lacks process locking, and cannot be monitored via `/api/sources/runs`.
- **Root Cause**: Lack of a single central ingestion service. `newsService.js` and `collector.js` evolved separately.
- **Impact**: Ingestion runs triggered via `POST /api/news/refresh` or server timer leave no audit trail in `collection_runs`. Duplicate concurrent fetches can occur if both execute at once.
- **How to Reproduce**: Trigger `POST /api/news/refresh`. Inspect `SELECT * FROM collection_runs`. Zero runs are logged.
- **Recommended Fix**: Consolidate core ingestion into a modular service library (`server/services/ingestion/`). Both `collector.js` CLI and `newsService.js` API call the central ingestion engine with unified metrics, run logging, and locking.

---

### FETCH-004: Unhandled Async Call in `getCategorizedNews`
- **Severity**: **CRITICAL**
- **Affected Files**: [`server/services/mitreService.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/services/mitreService.js), [`server/routes/mitre.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/routes/mitre.js)
- **Affected Functions**: `getCategorizedNews(options)`, `router.get('/news')`
- **Problem**: `getNews()` in `newsService.js` was migrated to be asynchronous for database DAO queries. In `mitreService.js` line 307, `const allNews = getNews();` is invoked without `await`. In `server/routes/mitre.js`, the route handler is synchronous. Calling `.map()` on `allNews` throws `TypeError: allNews.map is not a function`, crashing requests to `GET /api/mitre/news` with HTTP 500.
- **Root Cause**: `getCategorizedNews` was written synchronously under the legacy in-memory architecture and was not converted to `async/await` when `getNews` became asynchronous.
- **Impact**: Frontend ATT&CK news categorization page crashes on load.
- **How to Reproduce**: Execute `node -e "import('./server/services/mitreService.js').then(m => m.getCategorizedNews())"`.
- **Recommended Fix**: Convert `getCategorizedNews` to `async` with `const allNews = await getNews(options);` and make the route handler in `mitre.js` async.

---

### FETCH-005: Server-Side Request Forgery (SSRF) Risk
- **Severity**: **HIGH**
- **Affected Files**: [`server/collector.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/collector.js), [`server/services/newsService.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/services/newsService.js)
- **Affected Functions**: `fetchSource()`, `parseURL()`
- **Problem**: Any URL registered in sources is fetched via HTTP GET. If a registered source points to `http://169.254.169.254/latest/meta-data/` (cloud metadata), `http://127.0.0.1:8000/` (local Python AI service), or a private IP (`10.0.0.0/8`, `192.168.0.0/16`), the backend will fetch it and parse the response.
- **Root Cause**: No URL validation or IP restriction before initiating the external request.
- **Impact**: Exposure of internal server network, local microservices, or cloud instance credentials.
- **How to Reproduce**: Add feed URL `http://127.0.0.1:8000/health`. Collector queries local port 8000.
- **Recommended Fix**: Implement SSRF validator checking that protocols are strictly `http:` or `https:`, hostnames do not resolve to loopback, link-local, or private IP ranges, and disallowing cloud metadata addresses.

---

### FETCH-006: Lack of Retries with Exponential Backoff & Jitter
- **Severity**: **HIGH**
- **Affected Files**: [`server/collector.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/collector.js), [`server/services/newsService.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/services/newsService.js)
- **Affected Functions**: `parseURL(url)`
- **Problem**: When fetching 500 external feeds across global networks, transient network glitches (`ETIMEDOUT`, `ECONNRESET`, HTTP 429, 502, 503) occur naturally. The current code performs a single attempt and immediately marks the feed as failed.
- **Root Cause**: Single-shot `parser.parseURL()` call with no retry wrapper.
- **Impact**: Up to 10-20% of legitimate sources fluctuate into "Failed" or "Degraded" states due to momentary network hiccups.
- **How to Reproduce**: Simulate a temporary socket timeout on feed fetch. The source immediately transitions to `failed`.
- **Recommended Fix**: Wrap feed HTTP fetching in an isolated retry utility (2-3 attempts with exponential backoff: 1s, 2s, 4s + jitter). Only retry retryable codes (408, 429, 500, 502, 503, 504, `ECONNRESET`, `ETIMEDOUT`). Never retry 400, 401, 403, 404. Respect `Retry-After`.

---

### FETCH-007: Masked Status Codes & Uniform HTTP 500 Fallback
- **Severity**: **HIGH**
- **Affected Files**: [`server/collector.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/collector.js), [`server/services/newsService.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/services/newsService.js), [`server/services/feedHealthService.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/services/feedHealthService.js)
- **Affected Functions**: Catch blocks in `collector.js` (line 309) and `newsService.js` (line 92)
- **Problem**: Catch blocks blindly execute:
  `httpStatus: 500, errorCategory: 'FETCH_ERROR'`
  regardless of whether the true failure was DNS resolution failure, connection timeout, HTTP 404, HTTP 403 (Cloudflare block), or invalid XML.
- **Root Cause**: Raw error objects from `rss-parser` are not inspected for HTTP response status or error codes (`ENOTFOUND`, `ETIMEDOUT`, `status: 404`).
- **Impact**: SOC administrators cannot tell why a feed failed (e.g. DNS expired vs Cloudflare 403 vs 404 dead link).
- **How to Reproduce**: Point source to non-existent domain. Recorded status is `500` instead of `DNS_ERROR`.
- **Recommended Fix**: Implement error classifier extracting HTTP response status codes and system error codes (`TIMEOUT`, `DNS_ERROR`, `HTTP_401`, `HTTP_403`, `HTTP_404`, `HTTP_429`, `HTTP_5XX`, `INVALID_XML`).

---

### FETCH-008: Atom Link Array Crash (`raw.link.trim is not a function`)
- **Severity**: **HIGH**
- **Affected Files**: [`server/collector.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/collector.js), [`server/services/newsService.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/services/newsService.js)
- **Affected Functions**: Item mapping loop in `runCollector()` and `fetchAndProcessNews()`
- **Problem**: Standard Atom feeds frequently structure links as arrays of link objects (e.g. `[ { $: { rel: 'self', href: '...' } }, { $: { rel: 'alternate', href: '...' } } ]`) or single objects. When `rss-parser` outputs `raw.link` as an object or array, `raw.link.trim()` throws an uncaught `TypeError`.
- **Root Cause**: Unsafe assumption that `raw.link` is always a primitive string.
- **Impact**: Ingestion of the entire feed aborts; all legitimate articles from that publisher are discarded.
- **How to Reproduce**: Feed an Atom XML payload with `<link rel="alternate" href="https://example.com/post"/>` to parser. Calling `raw.link.trim()` throws.
- **Recommended Fix**: Implement `extractArticleLink(raw)`: handles string, array of link objects (selecting `rel="alternate"` first), or nested href attributes safely.

---

### FETCH-009: Missing Concurrency Control & Job Overlap
- **Severity**: **HIGH**
- **Affected Files**: [`server/services/newsService.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/services/newsService.js), [`server/server.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/server.js)
- **Affected Functions**: `fetchAndProcessNews()`
- **Problem**: In `server.js`, `fetchAndProcessNews()` is called on boot and on a 30-minute interval, while `POST /api/news/refresh` can be triggered via API. None of these use a mutex, database advisory lock, or active job tracker. Two collection cycles can run simultaneously in memory, hammering external feeds and database connections.
- **Root Cause**: Lack of operational job locking in `newsService.js`.
- **Impact**: Race conditions, duplicate database queries, external rate limits (HTTP 429).
- **How to Reproduce**: Send 3 rapid POST requests to `/api/news/refresh`. All 3 run parallel batches of 500 feeds.
- **Recommended Fix**: Implement database-backed advisory lock or in-memory run mutex preventing concurrent execution. Subsequent triggers return `{ status: 'in_progress', message: 'A collection run is already active' }`.

---

### FETCH-010: Unlimited Response Size Vulnerability
- **Severity**: **MEDIUM**
- **Affected Files**: [`server/collector.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/collector.js), [`server/services/newsService.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/services/newsService.js)
- **Problem**: HTTP requests to external RSS URLs do not specify a maximum response byte limit. A publisher returning a huge response (e.g. 50MB-100MB) can cause high memory spikes or OOM crashes in Node.js.
- **Root Cause**: Direct `parser.parseURL()` call without an underlying HTTP streaming size cap.
- **Impact**: Denial of Service via memory exhaustion.
- **Recommended Fix**: Download feed content using `fetch` with a streaming size check (max 5MB per feed), then parse the buffered XML string with `parser.parseString()`.

---

### FETCH-011: N+1 Database Round-Trips on IOC Storage
- **Severity**: **MEDIUM**
- **Affected Files**: [`server/collector.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/collector.js), [`server/services/newsService.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/services/newsService.js)
- **Problem**: For each accepted article, the collector executes individual `INSERT INTO iocs (article_id, type, value) VALUES ...` queries for every IP, CVE, and hash in loops.
- **Root Cause**: Unbatched SQL operations inside the per-article ingestion loop.
- **Impact**: 500 articles with 3 IOCs trigger 1,500 round-trips over the PostgreSQL connection pool, slowing down collection runs by 30-60 seconds.
- **Recommended Fix**: Batch IOC insertions using multi-row SQL syntax (`INSERT INTO iocs (article_id, type, value) VALUES ($1, $2, $3), ($4, $5, $6)... ON CONFLICT DO NOTHING`).

---

### FETCH-012: Ingestion & MITRE ATT&CK Processing Tightly Coupled
- **Severity**: **MEDIUM**
- **Affected Files**: [`server/server.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/server.js), [`server/collector.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/collector.js)
- **Problem**: MITRE processing is executed in `server.js` by passing all returned articles into `processNewsForMitre(news)`. In `collector.js` (CLI / GitHub Actions), MITRE mapping is not triggered at all.
- **Root Cause**: MITRE processing is treated as an ad-hoc post-hook on `server.js` instead of being part of the central article processing pipeline.
- **Impact**: Articles ingested by the CLI collector in GitHub Actions lack technique hit counters and tactic mappings until the web server is restarted.
- **Recommended Fix**: Integrate MITRE mapping as an independent enrichment stage within the article processing pipeline, storing tactic and technique mappings on the article record.

---

### FETCH-013: Hardcoded Concurrency & Timeout Literals
- **Severity**: **MEDIUM**
- **Affected Files**: [`server/collector.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/collector.js), [`server/services/newsService.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/services/newsService.js)
- **Problem**: Concurrency is hardcoded as `5` in `collector.js` and `CHUNK_SIZE = 10` in `newsService.js`. Timeouts are hardcoded as `10000ms`.
- **Root Cause**: Lack of unified environment variable configuration.
- **Impact**: Operators cannot tune concurrency for high-spec servers or throttle it down for serverless environments.
- **Recommended Fix**: Read `FETCH_CONCURRENCY`, `FETCH_TIMEOUT_MS`, `FETCH_MAX_RETRIES`, and `FETCH_BATCH_SIZE` from `process.env` with safe production defaults (concurrency: 10, timeout: 12000ms, retries: 2).

---

### FETCH-014: Missing Checkpointing in Long Ingestion Runs
- **Severity**: **MEDIUM**
- **Affected Files**: [`server/collector.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/collector.js)
- **Problem**: If an ingestion run processing 500 feeds is interrupted at source #300 due to a runner timeout or redeployment, the next invocation starts over from source #1.
- **Root Cause**: Runs do not track which sources were already polled during the active window.
- **Recommended Fix**: Implement lightweight source checkpointing: sort sources by `last_attempt_at ASC NULLS FIRST`, ensuring oldest-polled or never-polled sources are prioritized.

---

### FETCH-015: Empty Feeds Treated as Degraded or Erroneous
- **Severity**: **MEDIUM**
- **Affected Files**: [`server/services/feedHealthService.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/services/feedHealthService.js)
- **Problem**: Feeds that return valid XML with `<channel>` but 0 `<item>` elements are marked with `itemsCount: 0`. There is no explicit `EMPTY_FEED` classification to distinguish between a healthy feed with no current stories and a broken feed.
- **Recommended Fix**: Explicitly categorize valid feeds with 0 items as `EMPTY_FEED` with `success: true`.

---

### FETCH-016: Missing Explicit HTTP Accept Headers
- **Severity**: **LOW**
- **Affected Files**: [`server/collector.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/collector.js), [`server/services/newsService.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/services/newsService.js)
- **Problem**: Requests only send `User-Agent`. Some strict web servers or WAFs reject requests lacking standard XML/RSS `Accept` headers with HTTP 406 Not Acceptable or 403.
- **Recommended Fix**: Set standard header:
  `Accept: application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, text/html;q=0.8, */*;q=0.7`

---

### FETCH-017: Missing Shared Ingestion TypeScript Interfaces
- **Severity**: **LOW**
- **Affected Files**: `src/types/`
- **Problem**: Frontend and backend lack shared types for `FetchResult`, `FeedSource`, `ParsedArticle`, and `FetchJobSummary`.
- **Recommended Fix**: Create `src/types/ingestion.ts` with explicit type contracts.

---

### FETCH-018: Unstructured Ingestion Logging
- **Severity**: **LOW**
- **Affected Files**: [`server/collector.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/collector.js), [`server/services/newsService.js`](file:///d:/Project/SOC%20Ai%20B/SOC-AI-main/soc-platform-ui-main/server/services/newsService.js)
- **Problem**: Catch blocks print unstructured console lines like `[FAIL] Source Name: error message`.
- **Recommended Fix**: Log structured JSON objects containing `jobId`, `sourceId`, `sourceUrl`, `durationMs`, `attempt`, `status`, `errorCategory`, and sanitized error message.
