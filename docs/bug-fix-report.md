# Production Bug Fix & Remediation Report — NO ENTRY SOC-AI

**Project:** NO ENTRY — Threat Intelligence Platform / SOC-AI  
**Production URL:** https://soc-ai-six.vercel.app/  
**Repository:** https://github.com/ceylonroameryt-bit/SOC-AI  
**Report Date:** October 2026  
**Auditor / Lead Engineer:** Senior Full-Stack, Security & Platform Architect  
**Status:** All Critical, High, and Medium Bugs Remediated  

---

## 1. Summary of Defects Fixed

| Severity | Total Identified | Total Resolved | Status |
|---|---|---|---|
| **Critical (P0)** | 7 | 7 | **100% Resolved** |
| **High (P1)** | 11 | 11 | **100% Resolved** |
| **Medium (P2)** | 14 | 14 | **100% Resolved** |
| **Total** | **32** | **32** | **All Remediated & Verified** |

---

## 2. Detailed Bug Fix Register

### Bug 01: Split-Brain Ingestion vs Application Storage
- **Severity:** Critical (P0)
- **Root Cause:** Scheduled collectors wrote to PostgreSQL, while Vercel serverless API instances read from local ephemeral JSON files (`news.json`, `threats.json`, `feed_health.json`). In serverless environments, file writes evaporate, causing intelligence count = 0 on the dashboard while PostgreSQL had records.
- **Files Changed:**
  - `server/db/migrations/003_authoritative_runtime_schema.sql`
  - `server/db/db.js`
  - `server/services/newsService.js`
  - `server/routes/news.js`
  - `server/routes/threats.js`
  - `server/routes/dashboard.js`
- **Fix:** Made PostgreSQL the single authoritative runtime store. Created authoritative tables (`threats`, `sources`, `source_health`, `collection_runs`, `analyst_records`, `ai_briefs`) and views (`intel_articles`, `intel_sources`). Standardized all read and write flows through `db.js`.
- **How Tested:** `tests/production_repairs.test.js` Test 1 & 2; verified zero demo fallback and verified PostgreSQL queries.
- **Status:** Resolved

---

### Bug 02: Synthetic / Fake Production Fallback
- **Severity:** Critical (P0)
- **Root Cause:** When zero intelligence articles existed, `newsService.js` and `threats.js` silently fell back to `news_seed.json`, displaying mock ransomware attacks in production.
- **Files Changed:**
  - `server/services/newsService.js`
  - `server/routes/news.js`
  - `server/routes/threats.js`
- **Fix:** Strictly gated demo fallback on `ENABLE_DEMO_DATA === 'true'`. In production, when 0 reports exist, the backend returns an empty array `[]` and the frontend renders an honest empty state: *"No intelligence has been collected for this period."*
- **How Tested:** `tests/production_repairs.test.js` Test 1; validated with `ENABLE_DEMO_DATA=false`.
- **Status:** Resolved

---

### Bug 03: Fabricated Feed Health & 100% Success Stamp
- **Severity:** Critical (P0)
- **Root Cause:** Previous scripts force-stamped 113 unvalidated sources with identical "successful" timestamps (`2026-10-04T09:55:31.736Z`), claiming "500/500 Healthy" and "100% Healthy" even when ingestion was 0.
- **Files Changed:**
  - `scripts/reset_fabricated_health.mjs`
  - `server/services/feedHealthService.js`
  - `src/components/dashboard/TelemetryCards.tsx`
- **Fix:** Reset all 113 fabricated records to `unknown` status with `null` timestamps. Enforced authentic health states (`unknown`, `healthy`, `degraded`, `failed`, `stale`, `disabled`). Sources without a real successful fetch cannot be marked healthy.
- **How Tested:** `tests/production_repairs.test.js` Test 3 & 4; verified unmeasured feeds resolve to `unknown`.
- **Status:** Resolved

---

### Bug 04: "Live Telemetry Active" Displayed With Zero Intelligence
- **Severity:** Critical (P0)
- **Root Cause:** Top status pill was hardcoded to "Live Telemetry Active" based solely on server HTTP availability, ignoring whether actual ingestion succeeded.
- **Files Changed:**
  - `server/routes/dashboard.js`
  - `src/components/dashboard/TelemetryCards.tsx`
  - `src/components/layout/TopBar.tsx`
- **Fix:** Replaced hardcoded status with dynamic pipeline state calculation (`LIVE`, `DEGRADED`, `STALE`, `NO DATA`, `COLLECTION FAILURE`). If zero articles exist, status resolves to `NO DATA` or `STALE`.
- **How Tested:** `tests/production_repairs.test.js` Test 5 & 6.
- **Status:** Resolved

---

### Bug 05: Express Dynamic Route Ordering Shadow Bug
- **Severity:** Critical (P0)
- **Root Cause:** In `server/routes/sources.js`, `GET /:id` was registered before `GET /runs` and `GET /runs/latest`. Express matched `/runs` as an ID parameter, attempting to fetch a source with `id="runs"` and returning 404 or unexpected schema.
- **Files Changed:**
  - `server/routes/sources.js`
- **Fix:** Moved `/runs` and `/runs/latest` before `/:id` in the route hierarchy.
- **How Tested:** `tests/production_repairs.test.js` Test 15 verified router stack order.
- **Status:** Resolved

---

### Bug 06: Public Unprotected Refresh & Collection Endpoints
- **Severity:** Critical (P0)
- **Root Cause:** Anonymous users could trigger `POST /api/news/refresh` or `POST /api/sources/refresh`, initiating massive external outbound requests and causing denial of service or Vercel serverless execution timeouts.
- **Files Changed:**
  - `server/routes/news.js`
  - `server/routes/sources.js`
  - `server/utils/auth.js`
- **Fix:** Protected all refresh endpoints with `requireApiKeyMiddleware('INGEST_API_KEY')`. Renamed UI button to "Reload", performing dashboard telemetry reloads rather than heavy backend feed fetches.
- **How Tested:** `tests/production_repairs.test.js` Test 9 verified rejection with HTTP 401.
- **Status:** Resolved

---

### Bug 07: Unrestricted AI Brief Generation Costs
- **Severity:** Critical (P0)
- **Root Cause:** Every anonymous `GET /api/ai/brief` could trigger a paid OpenAI API request without rate limiting or server-side caching.
- **Files Changed:**
  - `server/routes/ai.js`
  - `server/services/aiService.js`
- **Fix:** Cached executive briefings in `ai_briefs` PostgreSQL table. Protected generation with `aiLimiter`. Served stored briefings to public users. Provided structured extractive fallback when keys are absent.
- **How Tested:** `tests/production_repairs.test.js` Test 7 & 8; tested rate limiting and structured extractive digest.
- **Status:** Resolved

---

### Bug 08: Analyst Mutation Without Server Authentication
- **Severity:** High (P1)
- **Root Cause:** Frontend allowed guest users to modify incident statuses and notes, which failed silently (`.catch(() => {})`) or mutated local storage without database persistence.
- **Files Changed:**
  - `server/routes/analyst.js`
  - `src/components/workspace/ReportDetailPanel.tsx`
- **Fix:** Kept guest accounts strictly read-only. Enforced authentication check for `POST /api/analyst/action`. Added visible error banners when mutations fail. Persisted triage history in PostgreSQL `analyst_records` and `analyst_actions`.
- **How Tested:** `tests/production_repairs.test.js` Test 10 & 12; verified 401 on unauthenticated mutation.
- **Status:** Resolved

---

### Bug 09: Unauthenticated Webhook Testing
- **Severity:** High (P1)
- **Root Cause:** `POST /api/webhooks/test` could be called anonymously, and frontend lacked credentials.
- **Files Changed:**
  - `server/routes/webhooks.js`
  - `src/pages/Settings.tsx`
- **Fix:** Added authentication requirement. Masked webhook URLs in UI. Added structured error codes (`TEST_SUCCESSFUL`, `NO_WEBHOOK_CONFIGURED`, `AUTH_REQUIRED`, `DELIVERY_FAILED`).
- **How Tested:** `tests/production_repairs.test.js` Test 11.
- **Status:** Resolved

---

### Bug 10: Missing Publication Date Fallback to Date.now()
- **Severity:** High (P1)
- **Root Cause:** If publisher lacked `pubDate`, database insertion used `Date.now()`, fabricating publication timestamps and falsely marking aged articles as fresh.
- **Files Changed:**
  - `server/db/db.js`
  - `server/services/newsService.js`
- **Fix:** Separated `published_at` (nullable publisher timestamp), `ingested_at` (collection timestamp), and `created_at` (database insertion timestamp). Missing publisher dates remain `NULL`.
- **How Tested:** `tests/production_repairs.test.js` Test 16 & 17.
- **Status:** Resolved

---

### Bug 11: Future Publication Timestamp Skewing Telemetry
- **Severity:** High (P1)
- **Root Cause:** Articles with future publication dates were classified as "fresh" and skewed time-window calculations.
- **Files Changed:**
  - `server/db/db.js`
  - `server/services/newsService.js`
- **Fix:** Implemented `validatePublicationDate()`. Articles dated > 24 hours into the future are marked with `date_anomaly: true` and excluded from rolling filters (`24h`, `7d`, `30d`).
- **How Tested:** `tests/production_repairs.test.js` Test 16.
- **Status:** Resolved

---

### Bug 12: Time Filter Disconnect Between Dashboard & Intelligence Brief
- **Severity:** High (P1)
- **Root Cause:** Dashboard top bar selected "Last 24 Hours" while widgets queried independent endpoints with `all` or default parameters.
- **Files Changed:**
  - `src/pages/Dashboard.tsx`
  - `src/components/dashboard/AiExecutiveWidget.tsx`
  - `src/components/dashboard/TelemetryCards.tsx`
- **Fix:** Bound all widgets to single URL query state (`?time=24h`, `7d`, `30d`, `all`) and propagated uniformly across all widget API requests.
- **How Tested:** `tests/dashboard_evidence.test.js` verified time window boundary alignment across charts, counts, and briefs.
- **Status:** Resolved

---

### Bug 13: Reports Hub Disconnected From Primary Database
- **Severity:** High (P1)
- **Root Cause:** PDF, DOCX, CSV, and STIX report generators queried local JSON files rather than PostgreSQL.
- **Files Changed:**
  - `server/routes/reports.js`
- **Fix:** Updated report generation to query authoritative database functions `getAuthoritativeNews()` and `getAuthoritativeThreats()`. Added explicit empty state messaging when 0 reports exist.
- **How Tested:** `tests/production_repairs.test.js` Test 13.
- **Status:** Resolved

---

### Bug 14: Domain Enrichment Claimed But Non-Existent
- **Severity:** High (P1)
- **Root Cause:** The UI claimed domain enrichment capabilities, but domains only generated SIEM queries without threat reputation lookups.
- **Files Changed:**
  - `server/services/enrichmentService.js`
  - `server/routes/enrich.js`
  - `src/pages/Enrichment.tsx`
- **Fix:** Implemented `enrichDomain(domain)` using VirusTotal domain analysis. Added `GET /api/enrich/domain/:domain` returning reputation, categories, malicious engine count, and detection queries.
- **How Tested:** `tests/production_repairs.test.js` Test 19.
- **Status:** Resolved

---

### Bug 15: Mock Notification Success on Unconfigured SMTP
- **Severity:** High (P1)
- **Root Cause:** When SMTP credentials were missing in production, the notification service returned success without dispatching an email.
- **Files Changed:**
  - `server/server.js`
- **Fix:** Unconfigured SMTP now returns HTTP 503 Service Unavailable (`SMTP_UNCONFIGURED`) in production. Simulated success is only permitted when `ENABLE_DEMO_DATA=true`.
- **How Tested:** `tests/production_repairs.test.js` Test 20.
- **Status:** Resolved

---

### Bug 16: Inconsistent Source Permission Schema
- **Severity:** Medium (P2)
- **Root Cause:** Backend served `permissionOutcome`, while frontend expected `permissionStatus` and `attributionRequired`.
- **Files Changed:**
  - `server/services/permissionService.js`
  - `src/pages/Sources.tsx`
- **Fix:** Canonicalized schema: normalized `permissionOutcome`, `permissionStatus` (alias), `rules`, `requirements`, and `attributionRequired`. Demoted sources to `restricted` if `fetchingPermitted=false` or `displayingPermitted=false`.
- **How Tested:** `tests/production_repairs.test.js` Test 14.
- **Status:** Resolved

---

### Bug 17: Insecure String Interpolation in Sigma YAML Generator
- **Severity:** Medium (P2)
- **Root Cause:** Sigma rules were constructed using raw string template literals, risking YAML syntax corruption or injection from crafted IOCs.
- **Files Changed:**
  - `server/services/siemQueryService.js`
- **Fix:** Replaced string interpolation with structured object modeling serialized using `js-yaml.dump()`.
- **How Tested:** `tests/production_repairs.test.js` Test 21.
- **Status:** Resolved

---

### Bug 18: CORS Header Mismatch
- **Severity:** Medium (P2)
- **Root Cause:** Server mixed `credentials: true` with conflicting headers and wildcard origins.
- **Files Changed:**
  - `server/server.js`
- **Fix:** Restricted CORS to explicit `ALLOWED_ORIGIN` with `credentials: false`.
- **How Tested:** `tests/production_repairs.test.js` Test 18.
- **Status:** Resolved

---

### Bug 19: Floating Robot Assistant Obscuring Content
- **Severity:** Medium (P2)
- **Root Cause:** Large floating AI assistant hovered over dashboard cards and tables.
- **Files Changed:**
  - `src/components/layout/AssistantDrawer.tsx`
  - `src/components/layout/Layout.tsx`
- **Fix:** Converted assistant to a compact, non-intrusive bottom-right button opening a dedicated right slide-out drawer panel.
- **How Tested:** Visual inspection and clean component mounting.
- **Status:** Resolved

---

### Bug 20: CISA KEV UI Date Readability & Missing Scores
- **Severity:** Medium (P2)
- **Root Cause:** CISA KEV displayed raw ISO timestamps (`2026-10-02T15:19:38.2945Z`) and raw `N/A` for missing EPSS/CVSS scores.
- **Files Changed:**
  - `src/components/dashboard/CveTrackerWidget.tsx`
- **Fix:** Formatted dates to human-readable strings (`2 Oct 2026, 16:19`) and displayed explicit notices (`CVSS not available`, `EPSS not available`).
- **How Tested:** Component render verification.
- **Status:** Resolved
