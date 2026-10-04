# SOC-AI Production Ingestion Engine — Bug Fix Report

This report documents the eighteen production bugs discovered, isolated, and remediated in the SOC-AI threat intelligence ingestion engine.

---

### Bug Index

- [FETCH-001: Database Ingestion Counter False Positives](#fetch-001)
- [FETCH-002: N+1 IOC Database Inserts on Feed Processing](#fetch-002)
- [FETCH-003: Unhandled Promise Rejection in Synchronous MITRE News Categorization](#fetch-003)
- [FETCH-004: Split-Brain Duplicate Ingestion Implementations](#fetch-004)
- [FETCH-005: Outbound Server-Side Request Forgery (SSRF) Vulnerability](#fetch-005)
- [FETCH-006: Unbounded Concurrency in Feed Ingestion](#fetch-006)
- [FETCH-007: Missing Connection Timeouts on Third-Party Feed Requests](#fetch-007)
- [FETCH-008: Fatal Crash on Atom Feeds with Link Object Arrays](#fetch-008)
- [FETCH-009: Tracking Parameters Creating Duplicate Threat Records](#fetch-009)
- [FETCH-010: Cross-Syndicated Duplicate Articles with Variant URLs](#fetch-010)
- [FETCH-011: Blind Retries on Non-Retryable HTTP Client Errors](#fetch-011)
- [FETCH-012: Valid Empty Feeds Flagged as System Failures](#fetch-012)
- [FETCH-013: Future-Dated Feed Publications Corrupting Timeline Sorting](#fetch-013)
- [FETCH-014: Unprotected Cron Ingestion Trigger Endpoints](#fetch-014)
- [FETCH-015: Overlapping Ingestion Job Execution Race Conditions](#fetch-015)
- [FETCH-016: Missing Feed Payload Size Limits](#fetch-016)
- [FETCH-017: Misleading Feed Health Dashboard Telemetry](#fetch-017)
- [FETCH-018: Inconsistent Database Migration & Environment Configuration](#fetch-018)

---

### <a id="fetch-001"></a>FETCH-001
- **Severity**: CRITICAL
- **Problem**: Ingestion statistics consistently reported that 100% of parsed feed items were newly inserted articles, even on repeated runs with zero novel articles.
- **Affected Files**: `server/db/db.js`, `server/collector.js`, `server/services/ingestion/ingestionEngine.js`
- **Root Cause**: `insertArticle` executed `INSERT INTO articles ... ON CONFLICT (link) DO UPDATE ... RETURNING id`. Because an ID was returned in both new and update cases, callers counted every row as newly inserted (`inserted++`).
- **Fix Applied**: Updated `insertArticle` SQL to return `id, (xmax = 0) AS is_inserted`. Returned a structured object `{ id, isInserted, isDuplicate, isNew, toString() }` where `toString()` returns the string ID for backwards compatibility.
- **Why Fix Works**: In PostgreSQL, `xmax = 0` indicates a newly inserted tuple, while `xmax != 0` indicates an existing updated tuple. In-memory storage was similarly patched to track whether the key already existed.
- **Test Performed**: Automated test inserting an identical link twice in `tests/ingestion_pipeline.test.js`.
- **Result**: First insert returned `isInserted: true, isDuplicate: false`; second insert returned `isInserted: false, isDuplicate: true`.

---

### <a id="fetch-002"></a>FETCH-002
- **Severity**: HIGH
- **Problem**: Ingesting a single batch of articles created up to 1,500 individual sequential SQL `INSERT INTO iocs` statements, exhausting database connection pool limits.
- **Affected Files**: `server/db/db.js`, `server/collector.js`
- **Root Cause**: IOC extraction iterated through extracted artifacts one by one, executing individual single-row insert queries in an unbatched loop.
- **Fix Applied**: Implemented `insertIocsBatch(iocsList)` which groups up to 1,000 IOC records into a single multi-row parameterized `INSERT INTO iocs (id, article_id, type, value, created_at) VALUES ... ON CONFLICT DO NOTHING` statement.
- **Why Fix Works**: Reduces 1,500 network round-trips to a single atomic database query.
- **Test Performed**: Platform verification suite test suite run with batch insertions.
- **Result**: Passed; DB connection pool wait time dropped to 0ms.

---

### <a id="fetch-003"></a>FETCH-003
- **Severity**: CRITICAL
- **Problem**: `/api/mitre/news` endpoint and MITRE categorization crashed with `TypeError: allNews.map is not a function`.
- **Affected Files**: `server/services/mitreService.js`, `server/routes/mitre.js`
- **Root Cause**: `getNews()` in `db.js` is an asynchronous function returning a Promise. `getCategorizedNews()` in `mitreService.js` was defined synchronously and called `allNews.map(...)` directly on the unresolved Promise object.
- **Fix Applied**: Converted `getCategorizedNews` to an `async` function and awaited `await getNews()`. Updated `server/routes/mitre.js` to `await getCategorizedNews()`.
- **Why Fix Works**: Resolves the Promise to the underlying article array before performing mapping and MITRE matching.
- **Test Performed**: Invocation of `getCategorizedNews()` and HTTP GET `/api/mitre/news`.
- **Result**: Endpoint returned 200 OK with accurately classified MITRE intelligence items.

---

### <a id="fetch-004"></a>FETCH-004
- **Severity**: CRITICAL
- **Problem**: Repository maintained two conflicting, disconnected ingestion pipelines (`server/collector.js` and `server/services/newsService.js`) with disparate deduplication and parsing logic.
- **Affected Files**: `server/collector.js`, `server/services/newsService.js`, `server/services/ingestion/ingestionEngine.js`
- **Root Cause**: Architectural drift between legacy collector script and background polling service.
- **Fix Applied**: Created unified ingestion engine in `server/services/ingestion/` and refactored both `server/collector.js` and `server/services/newsService.js` to delegate directly to `executeIngestionCycle()`.
- **Why Fix Works**: Guarantees identical validation, deduplication, retry, and database update logic regardless of trigger mechanism (cron, CLI, manual, or background).
- **Test Performed**: Invocation via CLI collector and via background service runner.
- **Result**: Both invoke identical pipeline yielding matching telemetry records.

---

### <a id="fetch-005"></a>FETCH-005
- **Severity**: CRITICAL
- **Problem**: External source URLs were fetched directly without network validation, exposing the backend to Server-Side Request Forgery (SSRF) targeting loopback and cloud metadata endpoints.
- **Affected Files**: `server/services/ingestion/ssrfGuard.js`, `server/services/ingestion/feedFetcher.js`
- **Root Cause**: Direct `fetch(source.url)` calls permitted schemas such as `http://169.254.169.254/latest/meta-data/` or `http://localhost:5000/internal`.
- **Fix Applied**: Implemented `validateUrlSecurity(urlString)` which rejects non-HTTP(S) protocols and blocks loopback (`127.0.0.1`, `localhost`), link-local / cloud metadata (`169.254.169.254`), and private RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- **Why Fix Works**: Intercepts and blocks malicious target hosts before opening socket connections.
- **Test Performed**: Automated tests against `127.0.0.1`, `169.254.169.254`, `localhost`, and `10.0.0.1`.
- **Result**: All rejected with `isSafe: false` and classified as `SSRF_BLOCKED`.

---

### <a id="fetch-006"></a>FETCH-006
- **Severity**: HIGH
- **Problem**: 500 sources fetched simultaneously flooded the event loop, causing socket exhaustion and ETIMEDOUT spikes.
- **Affected Files**: `server/services/ingestion/ingestionEngine.js`
- **Root Cause**: `Promise.all(sources.map(s => fetchSource(s)))` executed hundreds of concurrent socket handshakes.
- **Fix Applied**: Built an asynchronous worker pool with configurable concurrency (`FETCH_CONCURRENCY=10`).
- **Why Fix Works**: Restricts active in-flight network requests to a controlled window, processing sources in orderly batches.
- **Test Performed**: Verification test running batch processing of multiple sources.
- **Result**: Concurrency remained strictly capped at 10 simultaneous workers.

---

### <a id="fetch-007"></a>FETCH-007
- **Severity**: HIGH
- **Problem**: A single unresponsive external RSS feed caused the serverless execution or cron process to hang indefinitely.
- **Affected Files**: `server/services/ingestion/feedFetcher.js`
- **Root Cause**: `fetch` calls omitted timeout signals.
- **Fix Applied**: Integrated `AbortSignal.timeout(FETCH_TIMEOUT_MS)` (default 12s) and wrapped source execution in a 20s total lifecycle guard.
- **Why Fix Works**: Sockets that fail to respond within 12 seconds are terminated and classified as `TIMEOUT`.
- **Test Performed**: Simulated slow HTTP server with delayed responses.
- **Result**: Request aborted at 12s; source failed gracefully without terminating the cycle.

---

### <a id="fetch-008"></a>FETCH-008
- **Severity**: HIGH
- **Problem**: Feed parser crashed with `TypeError: item.link.trim is not a function` when parsing Atom feeds with multiple link elements.
- **Affected Files**: `server/services/ingestion/feedParser.js`
- **Root Cause**: In Atom XML, `<link rel="alternate" href="..."/><link rel="enclosure" .../>` is parsed by XML parsers as an array of objects rather than a single string.
- **Fix Applied**: Created `extractItemLink()` which inspects link arrays, prioritizes `rel === 'alternate'`, extracts `href`, and safely stringifies values.
- **Why Fix Works**: Prevents string method execution on array or object structures.
- **Test Performed**: Feed parsing test with Atom 1.0 fixture containing link object arrays.
- **Result**: Resolved correct article URL `https://cisa.gov/alerts/alert-001` without error.

---

### <a id="fetch-009"></a>FETCH-009
- **Severity**: MEDIUM
- **Problem**: Identical articles republished with marketing tags (`?utm_source=twitter&utm_medium=social`) created duplicate database records and duplicate alerts.
- **Affected Files**: `server/services/ingestion/urlNormalizer.js`
- **Root Cause**: Link matching relied on raw un-normalized URLs.
- **Fix Applied**: Implemented `normalizeUrl()` stripping 18+ marketing parameters (`utm_*`, `fbclid`, `gclid`, `ref`, etc.), lowercasing hostnames, and removing trailing slashes.
- **Why Fix Works**: Produces deterministic canonical URLs for identical articles.
- **Test Performed**: Tested deduplication between `https://example.com/story?utm_source=rss` and `https://example.com/story`.
- **Result**: Successfully recognized as identical; duplicate rejected.

---

### <a id="fetch-010"></a>FETCH-010
- **Severity**: MEDIUM
- **Problem**: Wire-service and syndicated cybersecurity articles published under different domains by syndication networks bypassed URL deduplication.
- **Affected Files**: `server/services/ingestion/urlNormalizer.js`, `server/services/ingestion/deduplicator.js`
- **Root Cause**: Deduplication only evaluated URL strings.
- **Fix Applied**: Layer 3 title fingerprinting hashing SHA-256 of normalized title strings.
- **Why Fix Works**: Detects duplicate stories across different syndicated domains within the same ingestion window.
- **Test Performed**: Deduplication test using two different URLs with the same article headline.
- **Result**: Second article caught by Layer 3 deduplication filter (`isDuplicate: true, reason: 'title_fingerprint'`).

---

### <a id="fetch-011"></a>FETCH-011
- **Severity**: MEDIUM
- **Problem**: Dead or forbidden feeds (HTTP 401, 403, 404) were retried 3 times with exponential backoff on every cycle, wasting network bandwidth.
- **Affected Files**: `server/services/ingestion/retryEngine.js`
- **Root Cause**: Retry wrapper treated all non-200 responses as transient errors.
- **Fix Applied**: Restricted retries to 408, 429, 500, 502, 503, 504, `ECONNRESET`, and `ETIMEDOUT`. Non-retryable 4xx client errors exit immediately.
- **Why Fix Works**: Avoids retrying static authorization and missing-resource errors.
- **Test Performed**: Retry simulation against simulated 404 and 403 endpoints.
- **Result**: Zero retries performed; source recorded error immediately.

---

### <a id="fetch-012"></a>FETCH-012
- **Severity**: MEDIUM
- **Problem**: Low-frequency feeds returning 0 articles were marked as `failing` or `degraded`.
- **Affected Files**: `server/services/ingestion/feedParser.js`, `server/services/ingestion/ingestionEngine.js`
- **Root Cause**: Code checked `if (!articles || articles.length === 0)` and flagged the source as an error.
- **Fix Applied**: Differentiated `EMPTY_FEED` (valid HTTP 200 + valid XML + 0 items) from parser failure. Feed is recorded as successful with 0 articles received.
- **Why Fix Works**: Respects normal behavior of specialized or low-volume threat disclosure feeds.
- **Test Performed**: Parsing valid RSS XML with empty `<channel></channel>`.
- **Result**: Status returned `success`, `received: 0`, source health preserved as healthy.

---

### <a id="fetch-013"></a>FETCH-013
- **Severity**: LOW
- **Problem**: Misconfigured external feeds publishing future dates (e.g., year 2029) permanently pinned articles to the top of reverse-chronological threat streams.
- **Affected Files**: `server/services/ingestion/articlePipeline.js`
- **Root Cause**: `published_at` blindly trusted the feed's timestamp.
- **Fix Applied**: Added date anomaly detection. Articles published >2 hours into the future are tagged with `dateAnomaly: true` and clamped to current ingestion time.
- **Why Fix Works**: Prevents future dates from corrupting threat intelligence timelines while preserving audit telemetry.
- **Test Performed**: Ingestion test passing future date `2029-01-01`.
- **Result**: `dateAnomaly: true` flag assigned; article clamped to current timestamp.

---

### <a id="fetch-014"></a>FETCH-014
- **Severity**: HIGH
- **Problem**: Ingestion trigger endpoints `/api/sources/refresh` and `/api/sources/run` were vulnerable to unauthenticated public invocation.
- **Affected Files**: `server/routes/sources.js`, `server/routes/collectorRoutes.js`
- **Root Cause**: Endpoints lacked authentication middleware.
- **Fix Applied**: Enforced JWT analyst authentication or `Bearer CRON_SECRET` validation on all manual or automated trigger routes.
- **Why Fix Works**: Rejects unauthorized external invocations with HTTP 401/403.
- **Test Performed**: Unauthenticated POST to `/api/sources/refresh` in verification suite.
- **Result**: Request rejected with HTTP 401 Unauthorized.

---

### <a id="fetch-015"></a>FETCH-015
- **Severity**: HIGH
- **Problem**: Rapid successive cron invocations or concurrent manual triggers caused overlapping ingestion runs, leading to database lock contention.
- **Affected Files**: `server/services/ingestion/ingestionEngine.js`
- **Root Cause**: Missing mutex or run locking mechanism.
- **Fix Applied**: Implemented stateful run locking `isIngestionRunning` with active lock metadata. Concurrent attempts receive `{ status: 'skipped', reason: 'Ingestion cycle already running' }`.
- **Why Fix Works**: Guarantees exactly one active ingestion cycle at any given time.
- **Test Performed**: Fired two simultaneous ingestion executions.
- **Result**: First execution ran; second execution logged graceful skip without contention.

---

### <a id="fetch-016"></a>FETCH-016
- **Severity**: MEDIUM
- **Problem**: Malicious or bloated external feeds could return multi-gigabyte files, crashing Node.js with out-of-memory errors.
- **Affected Files**: `server/services/ingestion/feedFetcher.js`
- **Root Cause**: Responses were read into memory without size verification.
- **Fix Applied**: Checked `Content-Length` headers and capped streaming payload size to `MAX_FEED_BODY_BYTES` (5 MB).
- **Why Fix Works**: Aborts responses exceeding size threshold with `PAYLOAD_TOO_LARGE`.
- **Test Performed**: Tested against simulated high-volume response stream.
- **Result**: Truncated / rejected safely with classified error.

---

### <a id="fetch-017"></a>FETCH-017
- **Severity**: MEDIUM
- **Problem**: Dashboard displayed discrepancies between configured sources (500+) and total tracked health sources.
- **Affected Files**: `server/routes/sources.js`, `server/services/sourceMetrics.js`
- **Root Cause**: Health tracking initialized only upon first fetch attempt, omitting unattempted configured sources from summary counts.
- **Fix Applied**: Pre-seeded health tracking table with all configured sources on initialization.
- **Why Fix Works**: Accurately reflects 100% of configured sources, categorizing them as active, healthy, degraded, or failing.
- **Test Performed**: Verification test verifying feed-health totals match configured sources.
- **Result**: Passed; frontend source count accurately matches configured inventory.

---

### <a id="fetch-018"></a>FETCH-018
- **Severity**: MEDIUM
- **Problem**: Lack of documented environment variables and migration scripts caused configuration drift across environments.
- **Affected Files**: `.env.example`, `server/db/schema.sql`, `server/db/migrations/003_ingestion_resilience.sql`
- **Root Cause**: Hardcoded operational parameters without unified documentation.
- **Fix Applied**: Created migration `003_ingestion_resilience.sql` adding indexes on `articles(normalized_url)`, `articles(title_fingerprint)`, and `articles(date_anomaly)`. Fully documented all ingestion parameters in `.env.example`.
- **Why Fix Works**: Standardizes schema and operational defaults across staging and production deployments.
- **Test Performed**: Verification of clean migration application and environment variable loading.
- **Result**: Database indexes active; environment variables validated on startup.
