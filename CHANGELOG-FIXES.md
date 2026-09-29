# CHANGELOG-FIXES: Security, Reliability & Parity Remediation

This document details all security hardening (P0), logic and correctness fixes (P1), and deployment hygiene improvements (P2) implemented across the NO ENTRY SOC Intelligence Platform (`soc-platform-ui-main`, Vercel serverless entry `api/index.js`, Express backend `server/server.js`, Python microservice `app.py`, and CI/CD workflows).

---

## P0: Security Fixes

### 1. Auth Bypass Removal (`/api/notifications/send`)
- **What Changed**: Removed the legacy bypass clause that accepted any Bearer token longer than 15 characters. The endpoint now strictly validates the token against `NOTIFICATION_API_KEY` (or `INGEST_API_KEY`) using constant-time comparison (`crypto.timingSafeEqual`). If neither key is configured in the environment, the endpoint fails closed with HTTP `503 Service Unavailable`.
- **Files Touched**:
  - `soc-platform-ui-main/server/utils/auth.js`
  - `soc-platform-ui-main/server/routes/webhooks.js`
  - `soc-platform-ui-main/server/server.js`
  - `soc-platform-ui-main/api/index.js`
- **Tests Added**:
  - `tests/security_fixes.test.js`: Suite `P0 Item 1: /api/notifications/send rejects without auth` (rejects missing key, rejects arbitrary long token, rejects wrong key).

### 2. `/api/v1/alerts` Fail-Closed & Payload Validation
- **What Changed**: 
  - Fails closed: if `INGEST_API_KEY` is unset or empty, requests return `503 Service Unavailable`.
  - Keys are compared in constant time (`safeEqual` via `crypto.timingSafeEqual`).
  - Strict payload validation: returns `400 Bad Request` (not `500`) for missing bodies, non-JSON payloads, invalid or missing `severity` (`Critical`, `High`, `Medium`, `Low`, `Informational`), and caps string lengths (e.g. `type` <= 100 chars, `description` <= 5000 chars, `ioc` <= 200 chars).
- **Files Touched**:
  - `soc-platform-ui-main/server/server.js`
  - `soc-platform-ui-main/api/index.js`
  - `soc-platform-ui-main/server/utils/auth.js`
- **Tests Added**:
  - `tests/security_fixes.test.js`: Suite `P0 Item 2: /api/v1/alerts fail-closed and validation` (unauthorized, malformed body, invalid severity, oversized fields, valid payload 201).

### 3. Authentication & Rate-Limiting on Sensitive Endpoints
- **What Changed**: Added mandatory API key validation (via `requireAuthMiddleware` / `requireApiKey`) and rate limiting to:
  - `POST /api/webhooks/test`
  - `POST /api/analyst/action`
  - `POST /api/ai/remediate`
  - `GET /api/analyst/status`
- **Files Touched**:
  - `soc-platform-ui-main/server/routes/webhooks.js`
  - `soc-platform-ui-main/server/routes/analyst.js`
  - `soc-platform-ui-main/server/routes/ai.js`
  - `soc-platform-ui-main/server/server.js`
- **Tests Added**:
  - `tests/platform_verification.test.js`: Test 22 updated with authenticated analyst headers.
  - `tests/security_fixes.test.js`: Verification of protected routes.

### 4. CORS Hardening & Allowed Origins
- **What Changed**:
  - Removed wildcard `*` with credentials combinations in both `vercel.json` and Express/FastAPI handlers.
  - Express server: reads `ALLOWED_ORIGIN` environment variable; splits comma-separated URLs; restricts allowed methods to `GET, POST, OPTIONS`; disables wildcard credentials. Removed blanket `*.up.railway.app` origin trust.
  - FastAPI (`app.py`): restricted `CORSMiddleware` to origins from `ALLOWED_ORIGIN` (falling back to local dev origins), set `allow_credentials=False`.
  - Root `vercel.json`: set `Access-Control-Allow-Credentials: false`, explicit headers and methods.
- **Files Touched**:
  - `vercel.json`
  - `soc-platform-ui-main/server/server.js`
  - `app.py`

### 5. Rate Limiting & Proxy Trust
- **What Changed**:
  - Added `app.set('trust proxy', 1)` in Express `server.js` to correctly obtain client IPs behind Vercel/reverse proxies.
  - Added shared rate limiters on enrichment endpoints (`/api/enrich/*`), capping VirusTotal free-tier calls to 4 requests/min per IP, and query generation to 30 requests/min.
- **Files Touched**:
  - `soc-platform-ui-main/server/server.js`
  - `soc-platform-ui-main/server/routes/enrich.js`

### 6. CSV Formula Injection Prevention (DDE / Spreadsheet Injection)
- **What Changed**: In `escapeCsvField` (`reportGenerator.js`), any field value starting with formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) is prefixed with a single quote (`'`) before quotation and CSV serialization, preventing Excel/Calc code execution.
- **Files Touched**:
  - `soc-platform-ui-main/server/services/reportGenerator.js`
- **Tests Added**:
  - `tests/security_fixes.test.js`: Suite `P0 Item 6: CSV formula injection prevention (escapeCsvField)` testing all injection triggers (`=CMD`, `+cmd`, `-1+1`, `@SUM`, `\t`, `\r`).

### 7. IOC Escaping & Type Validation in SIEM Query Generation
- **What Changed**:
  - In `siemQueryService.js`: escaped special characters for Splunk SPL (backslashes and quotes), Azure KQL, and Sigma YAML (escaping single quotes).
  - Capped IOC input length at 200 characters on `/api/enrich/queries/:ioc`.
  - Rejected unsupported/unknown IOC types with HTTP `400 Bad Request`.
- **Files Touched**:
  - `soc-platform-ui-main/server/services/siemQueryService.js`
  - `soc-platform-ui-main/server/routes/enrich.js`
- **Tests Added**:
  - `tests/security_fixes.test.js`: Suite `P0 Item 7: detectIOCType correctly identifies types` (IPv4, SHA256, SHA1, MD5, CVE, multi-label domain, rejects invalid hash length).

### 8. Feed Item Link Validation & Deduplication Key Fix
- **What Changed**:
  - Added `validateLink(link)`: only retains valid `http://` or `https://` URLs, returning `null` for javascript:, data:, relative paths, or `#`.
  - Fixed duplicate key collision where link-less items collapsed onto `#`: `dedupeKey` now falls back to a deterministic SHA-1 hash of `title + source`.
- **Files Touched**:
  - `soc-platform-ui-main/server/services/newsService.js`
- **Tests Added**:
  - `tests/security_fixes.test.js`: Suite `P0 Item 8: validateLink and dedupeKey` (protocol filtering, fallback hash uniqueness).

### 9. Sanitized `/api/health` Endpoint
- **What Changed**: Removed internal database URL defaults and connection telemetry from `/api/health`. The endpoint now solely returns `{ "status": "ok", "timestamp": "..." }`.
- **Files Touched**:
  - `soc-platform-ui-main/server/server.js`
- **Tests Added**:
  - `tests/security_fixes.test.js`: Suite `P0 Item 9: /api/health only returns {status, timestamp}`.

### 10. Dependency Vulnerability Remediation
- **What Changed**: Ran `npm audit fix` in `soc-platform-ui-main/`. Confirmed clean `npm audit` reporting 0 vulnerabilities.
- **Files Touched**:
  - `soc-platform-ui-main/package.json`
  - `soc-platform-ui-main/package-lock.json`

---

## P1: Correctness & Functional Fixes

### 11. MITRE ATT&CK Word-Boundary Mapping
- **What Changed**: Replaced plain substring `.includes()` with word-boundary regexes (`\b...\b`). Disallowed false positives from short keywords (e.g. `rce`, `bec`, `lpe`, `smb`, `c2`, `rdp`). Fixed technique names (e.g. T1543 = "Create or Modify System Process"). Replaced hard-coded `count: 5` in top techniques with dynamic tallying.
- **Files Touched**:
  - `soc-platform-ui-main/server/services/mitreService.js`
- **Tests Added**:
  - `tests/security_fixes.test.js`: Suite `P1 Item 11: MITRE word-boundary regex` proving "resource", "because", and "helped" do NOT trigger false positives for `rce`, `bec`, or `lpe`.

### 12. Stable Deterministic Article IDs
- **What Changed**: Replaced ephemeral array index IDs (`art-${idx}`) with deterministic SHA-1 hashes of the canonical article link (`deriveArticleId`). If link is missing, a unique cryptographic ID is assigned.
- **Files Touched**:
  - `soc-platform-ui-main/server/services/newsService.js`
- **Tests Added**:
  - `tests/feed_reliability.test.js`: Suite `8a. deriveArticleId — stable deterministic IDs`.

### 13. Vercel Serverless & Express Backend Parity Bridge
- **What Changed**:
  - Extracted and centralized core service logic under `server/services/` so both local Express and Vercel serverless invoke identical route handlers.
  - Vercel entrypoint `soc-platform-ui-main/api/index.js` delegates directly to the canonical Express `app`.
  - Re-exported root `api/index.js` cleanly forwards to the unified Vercel handler.
  - Standardized hash validation across all services to 32 (MD5), 40 (SHA-1), or 64 (SHA-256) hex characters.
- **Files Touched**:
  - `soc-platform-ui-main/api/index.js`
  - `api/index.js`
  - `soc-platform-ui-main/server/server.js`

### 14. Real Integrations for Webhooks & Notifications
- **What Changed**: Replaced mocked `success: true` responses in `/api/webhooks/test` and `/api/notifications/send` with real dispatchers (`broadcastAlert`, `sendPeriodicSummary`). Returns clear error responses when target webhooks or SMTP services are unconfigured.
- **Files Touched**:
  - `soc-platform-ui-main/server/routes/webhooks.js`
  - `soc-platform-ui-main/server/services/emailService.js`

### 15. Analyst Action Persistence & Schema Validation
- **What Changed**:
  - Supported database persistence via PostgreSQL (`db.js`) when `DATABASE_URL` is set, falling back to atomic file storage.
  - Whitelisted allowed `actionType` values (`status_change`, `note_added`, `dismiss`, etc.) and `status` values (`new`, `under_review`, `action_required`, `resolved`, `dismissed`).
  - Enforced max note length (2,000 chars), capped history length (50 items), derived `analystId` from authenticated credentials, and generated UUIDs via `crypto.randomUUID()`.
- **Files Touched**:
  - `soc-platform-ui-main/server/routes/analyst.js`
  - `soc-platform-ui-main/server/db/db.js`

### 16. Non-Blocking Feed Refresh & Vercel Configuration
- **What Changed**:
  - Feed collector decoupled from synchronous HTTP requests; serves in-memory/cached articles immediately and refreshes asynchronously in background workers or scheduled collectors.
  - Configured explicit `functions: { "api/index.js": { "maxDuration": 15, "memory": 1024 } }` in `vercel.json`.
  - Removed duplicate `soc-platform-ui-main/vercel.json` to eliminate Vercel root/UI config conflicts.
- **Files Touched**:
  - `vercel.json`
  - `soc-platform-ui-main/vercel.json` (removed duplicate)
  - `soc-platform-ui-main/server/routes/news.js`

### 17. Honest Threat Intelligence Export
- **What Changed**: Rewired threat export endpoints (`/api/threats/export/*`) to real in-memory/persisted threat sources. If threats are unavailable or in an unconfigured state, returns an explicit HTTP 501 or 404 rather than generating empty dummy files.
- **Files Touched**:
  - `soc-platform-ui-main/server/routes/threats.js`
  - `soc-platform-ui-main/server/routes/reports.js`

### 18. Enrichment Accuracy (IPv6, Private IP Skipping, Zero-Fabrication)
- **What Changed**:
  - Added RFC 1918, loopback, link-local, and reserved IP range detection to skip unnecessary external third-party calls.
  - Added IPv6 parsing and validation support.
  - Returns `null` (not `0` or simulated defaults) when third-party threat scores are unknown or unassessed.
  - Error responses are excluded from enrichment cache.
- **Files Touched**:
  - `soc-platform-ui-main/server/services/enrichmentService.js`

### 19. Shared Canonical IOC Extraction
- **What Changed**: Unified duplicate IOC extraction logic into `enrichmentService.extractIOCs()`. Validates IPv4 octets (0-255), drops private/loopback IPs, filters common file extensions (.exe, .pdf, .docx, .zip) from domain detection, supports defanged IOC formats (`hxxp`, `[.]`, `(.)`), and extracts SHA-1 hashes (40 hex).
- **Files Touched**:
  - `soc-platform-ui-main/server/services/enrichmentService.js`
  - `soc-platform-ui-main/server/services/siemQueryService.js`

### 20. Domain IOC Detection & Sigma Rule Syntax
- **What Changed**:
  - Updated domain detection in `siemQueryService.js` to accept multi-label domains and punycode (`xn--...`).
  - Cleaned generated Sigma queries: removed hard-coded `attack.execution` tag, enforced lowercase `level` values, and aligned field names with log sources.
- **Files Touched**:
  - `soc-platform-ui-main/server/services/siemQueryService.js`

### 21. Safe News Sorting & Pagination Clamping
- **What Changed**:
  - Query parameters clamped: `limit` bounded between `1` and `500`, `page >= 1`.
  - Safe date parsing: invalid or missing `pubDate` fields are safely sorted to the end (oldest) without throwing `NaN` comparator errors.
- **Files Touched**:
  - `soc-platform-ui-main/server/services/newsService.js`
  - `soc-platform-ui-main/server/routes/news.js`

### 22. Server Lifecycle & Production Hardening
- **What Changed**:
  - Default `NODE_ENV` treated as `production` when unset.
  - Replaced fragile `isTestMode` heuristics with `NODE_ENV === 'test'`.
  - Added `.catch()` error handlers to background timers, cron tasks, and startup fetches.
  - Replaced raw stack trace dumps with sanitized generic error messages in API responses.
  - Missing/empty request bodies return `400 Bad Request` instead of `500 Internal Server Error`.
- **Files Touched**:
  - `soc-platform-ui-main/server/server.js`

### 23. Authentic AI Telemetry & Settings Parity
- **What Changed**:
  - `/api/ai/stats` dynamically reflects actual configuration status (`OPENAI_API_KEY`, `AI_SERVICE_URL`) instead of returning hard-coded `false`.
  - Settings UI and backend status cards reflect live microservice states.
- **Files Touched**:
  - `soc-platform-ui-main/server/routes/ai.js`
- **Tests Added**:
  - `tests/security_fixes.test.js`: Suite `P1 Item 23: /api/ai/stats reflects real configuration`.

---

## P2: Deployment & Hygiene Fixes

### 24. Azure App Service Workflow Gating
- **What Changed**: Fixed invalid job-level `if: secrets.X != ''` expression in `.github/workflows/azure-app-service.yml` (since the `secrets` context is not accessible at the job level in GitHub Actions). Moved secret detection into a build step that sets `$GITHUB_OUTPUT`, gating artifact upload and deployment cleanly.
- **Files Touched**:
  - `.github/workflows/azure-app-service.yml`

### 25. CI Workflow Security & Python Testing
- **What Changed**:
  - Added `npm audit --audit-level=high` step to frontend and server job.
  - Replaced shallow Python syntax checking with `flake8` linting and an automated FastAPI initialization test in GitHub Actions CI.
- **Files Touched**:
  - `.github/workflows/ci.yml`

### 26. Removal of Committed Runtime Data & Seed Fallback
- **What Changed**:
  - Removed large runtime data files (`news.json` ~55MB, `threats.json`, `analyst_actions.json`, `feed_health.json`) from git tracking.
  - Added them to `.gitignore`.
  - Deleted stray `test_threats.js` and `test_threats.cjs`.
  - Created a lightweight `news_seed.json` so fresh clones and demo modes have immediate valid seed articles without requiring 50MB git bloat.
- **Files Touched**:
  - `.gitignore`
  - `soc-platform-ui-main/server/data/news_seed.json`
  - `soc-platform-ui-main/server/services/newsService.js`
  - Tracked git index updated via `git rm --cached`.

### 27. Feed Catalogue Cleanup & URL Migration
- **What Changed**:
  - Replaced legacy CISA US-CERT (`/uscert/ncas/bulletins.xml`) URLs with modern CISA advisories feed (`/cybersecurity-advisories/bulletins.xml`).
  - Fixed old SANS Internet Storm Center URLs and corrected "SANS ICO" typos to "SANS ISC".
  - Quarantined dead/blocked endpoints (Cloudflare challenges, removed RSS endpoints) with explicit documented reasons.
- **Files Touched**:
  - `soc-platform-ui-main/server/data/sources_registry.json`

### 28. Detection Rules Standardization & Parity
- **What Changed**:
  - Validated that every Sigma rule has a UUID `id`, `date`, `author`, and `falsepositives`.
  - Tightened PowerShell execution rule 1 to require encoded command execution or obfuscation patterns (does not trigger on bare `Invoke-WebRequest`).
  - Reviewed YARA rules for LockBit 3.0 and Cobalt Strike to eliminate low-complexity false positives.
  - Ensured both Express and Vercel read identical rule files from `server/data/rules/`.
- **Files Touched**:
  - `soc-platform-ui-main/server/data/rules/sigma_rules.yml`
  - `soc-platform-ui-main/server/data/rules/yara_rules.yar`

### 29. Render Configuration & Port Alignment
- **What Changed**:
  - In `render.yaml`, removed unused `OPENAI_API_KEY` from the AI microservice configuration (since `app.py` operates without direct OpenAI API calls).
  - Explicitly declared Python microservice port `8000`.
  - Documented `AI_SERVICE_URL` alignment and added `INGEST_API_KEY` synchronization.
- **Files Touched**:
  - `render.yaml`

---

## Verification & Test Results

- **ESLint**: Clean (`npm run lint` exited code 0).
- **Test Suite**: 152 / 152 tests passed across 27 suites (`node --test tests/*.test.js`).
- **Production Build**: Clean (`tsc -b && vite build` completed in ~10 seconds).
- **Security Audit**: Clean (`npm audit` reported 0 vulnerabilities).
- **Python Syntax**: Valid (`python -m py_compile app.py` clean).

---

## Environment Variables Required for Deployment

### Vercel (Frontend & Serverless API)
Configure these in the Vercel Dashboard (**Project Settings > Environment Variables**):

| Variable Name | Required | Description |
|---|---|---|
| `INGEST_API_KEY` | **Yes** | Shared secret key for authenticating alert ingestion (`/api/v1/alerts`) and analyst actions (`/api/analyst/action`). Minimum 32 characters recommended. |
| `NOTIFICATION_API_KEY` | **Yes** | Shared secret key for triggering notifications (`/api/notifications/send`). |
| `ALLOWED_ORIGIN` | **Yes** | Allowed CORS origins, e.g. `https://soc-ai-six.vercel.app`. |
| `DATABASE_URL` | Optional | PostgreSQL connection string (Supabase / Neon / AWS RDS). If unset, the app operates in resilient read-only / in-memory mode. |
| `VIRUSTOTAL_API_KEY` | Optional | API key for IP and hash enrichment. |
| `ABUSEIPDB_API_KEY` | Optional | API key for IP reputation checks. |
| `AI_SERVICE_URL` | Optional | URL of the Python FastAPI microservice (e.g. `https://no-entry-ai-microservice.onrender.com`). |
| `SLACK_WEBHOOK_URL` | Optional | Incoming webhook URL for Slack alert notifications. |
| `TEAMS_WEBHOOK_URL` | Optional | Incoming webhook URL for Microsoft Teams notifications. |
| `DISCORD_WEBHOOK_URL` | Optional | Incoming webhook URL for Discord alert notifications. |

### Render (Backend & Python AI Microservice)
Configure these in the Render Dashboard:

#### Backend Service (`no-entry-soc-backend`):
| Variable Name | Value / Description |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `INGEST_API_KEY` | Must match Vercel `INGEST_API_KEY` |
| `NOTIFICATION_API_KEY` | Must match Vercel `NOTIFICATION_API_KEY` |
| `ALLOWED_ORIGIN` | `https://soc-ai-six.vercel.app` |
| `DATABASE_URL` | PostgreSQL connection string |
| `AI_SERVICE_URL` | URL of the deployed `no-entry-ai-microservice` |

#### AI Microservice (`no-entry-ai-microservice`):
| Variable Name | Value / Description |
|---|---|
| `PYTHON_VERSION` | `3.11.0` |
| `PORT` | `8000` |
| `INGEST_API_KEY` | Must match backend `INGEST_API_KEY` |
| `ALLOWED_ORIGIN` | `https://soc-ai-six.vercel.app` |
