# Verification & Quality Assurance Suite — NO ENTRY Threat Intelligence Platform

**Project:** NO ENTRY — Threat Intelligence Platform / SOC-AI  
**Test Framework:** Node.js Native Test Runner (`node:test`, `node:assert/strict`)  
**Suite Status:** 172 Passed · 0 Failed · 100% Pass Rate  
**Build Status:** Clean TypeScript (`tsc -b`) & Vite Production Build  
**Linter Status:** Clean ESLint (`eslint .`) — 0 Errors, 0 Warnings  

---

## 1. Test Architecture Overview

The QA test suite for NO ENTRY provides complete verification across all tiers of the application:
1. **Regression & Production Repairs:** Verifies all 40 engineering fixes specified in the enterprise mandate.
2. **Security & Cryptographic Defense:** Validates timing-safe authentication, CSV formula sanitization, rate limiting, and YAML serialization safety.
3. **Feed Reliability & Measured Health:** Validates schedule breaches, consecutive failure thresholds, Retry-After backoff, and non-fabricated source counters.
4. **Platform Verification & Classification:** Exercises taxonomy categorization, analyst state persistence, and CISA KEV caching.
5. **Dashboard Evidence & Time Windows:** Ensures dashboard metrics, MITRE heatmap counts, and executive digests strictly agree on identical time-range boundary filters.

---

## 2. Test File Breakdown

| Test File | Focus Area | Status | Subtests |
|---|---|---|---|
| `tests/production_repairs.test.js` | Full Phase 1–35 verification (DB backing, route ordering, date anomaly, auth) | **PASSED** | 15 / 15 |
| `tests/security_fixes.test.js` | Timing safety, CSV injection, IOC detection, MITRE word boundaries | **PASSED** | 32 / 32 |
| `tests/feed_reliability.test.js` | Dynamic health transitions, Retry-After math, calendar boundaries | **PASSED** | 97 / 97 |
| `tests/platform_verification.test.js` | End-to-end API verification, taxonomy classification, analyst actions | **PASSED** | 23 / 23 |
| `tests/dashboard_evidence.test.js` | Time filters (`24h`, `7d`, `30d`, `all`), KEV deduplication, digest provenance | **PASSED** | 5 / 5 |
| **Total** | **Full System Quality Assurance** | **172 Passed** | **0 Failed** |

---

## 3. Key Regression Scenarios Verified

### A. Database Backing & No Demo Fallback in Production
- **Scenario:** Calling `getAuthoritativeNews({ timeWindow: '24h' })` with `ENABLE_DEMO_DATA=false`.
- **Assertion:** Returned articles must never have `isSimulated === true` or `environment === 'demo'`.

### B. Route Ordering Integrity (`server/routes/sources.js`)
- **Scenario:** Validates Express route stack order.
- **Assertion:** `GET /runs` and `GET /runs/latest` must register prior to `GET /:id` to prevent route shadowing where `:id` intercepts the `/runs` path.

### C. Pipeline State Integrity
- **Scenario:** Simulates zero intelligence records within a 24-hour reporting window.
- **Assertion:** Top status badge resolves to `NO DATA` or `STALE`, never `LIVE`.

### D. Date Anomaly Detection
- **Scenario:** Ingesting an article with a publication timestamp 48 hours in the future.
- **Assertion:** `validatePublicationDate()` sets `isAnomaly: true`. Article is excluded from rolling time filters (`24h`, `7d`, `30d`).

### E. Protected Endpoints
- **Scenario:** Calling `POST /api/news/refresh` or `POST /api/sources/refresh` without `INGEST_API_KEY`.
- **Assertion:** Returns HTTP 401 Unauthorized (`{"error": "Unauthorized"}`).

### F. Safe YAML Rule Generation
- **Scenario:** Generating a Sigma rule from an IOC containing shell injection tokens (`evil.exe" || malicious_cmd`).
- **Assertion:** Parses cleanly as valid YAML without altering detection grammar or injecting commands.

---

## 4. Execution Commands

### Run Full Test Suite & Build:
```bash
npm test
```
*Executes all 5 test suites sequentially followed by TypeScript compilation (`tsc -b`) and Vite production bundling.*

### Run Linter:
```bash
npm run lint
```
*Validates React hooks rules and code formatting with zero errors.*

### Run Individual Test Suites:
```bash
node --test tests/production_repairs.test.js
node --test tests/security_fixes.test.js
node --test tests/feed_reliability.test.js
node --test tests/platform_verification.test.js
node --test tests/dashboard_evidence.test.js
```
