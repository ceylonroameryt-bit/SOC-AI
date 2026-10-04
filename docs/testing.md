# Testing & Quality Assurance Architecture
**NO ENTRY — Threat Intelligence Platform / SOC-AI**
**Classification: Operational Technical Documentation**

---

## 1. Overview & Test Strategy

To guarantee platform honesty, database integrity, route correctness, and security guardrails across serverless and long-running instances, the test harness validates all core services against real and simulated states without depending on writable filesystem state or mock telemetry.

### Core Testing Pillars:
1. **Authoritative Persistence**: Verification that all runtime endpoints read from and write to PostgreSQL/Supabase DAO abstractions.
2. **Telemetry Honesty**: Testing that 0 ingested articles never yields "Live Telemetry Active" or "100% Healthy".
3. **Route Precedence**: Prevention of Express route shadowing (e.g. `/api/sources/runs` vs `/api/sources/:id`).
4. **Security & Authorization**: Verifying that Guest mutations return HTTP 403, unauthenticated webhook tests return HTTP 401, and refresh endpoints require API keys.
5. **Data Integrity & Normalization**: Testing date anomaly detection (`dateAnomaly: true` for future timestamps, null `published_at` preserving semantic integrity), safe Sigma YAML generation, and canonical permission validation.

---

## 2. Test Execution & Coverage Summary

The regression and verification suite is executed via:
```bash
cd soc-platform-ui-main
npm test
```

### Test Results Breakdown:
- **Total Tests**: 32 test cases across 6 suites
- **Passed**: 32
- **Failed**: 0
- **Duration**: ~2.5s

### Suite Breakdown:

| Test Suite / Category | Assertions Tested | Status |
| :--- | :--- | :--- |
| **Phase 1 & 2: Database Source of Truth** | `/api/news` returns DB articles, respects `time=24h`, stable ID persistence, zero fallback to seeds | Passed |
| **Phase 3: Demo Data Quarantine** | Fallback to fake seed reports disabled in production (`ENABLE_DEMO_DATA=false`) | Passed |
| **Phase 4 & 5: Measured Source Health** | Sources default to `unknown`, never auto-marked healthy; honest bucket calculation | Passed |
| **Phase 6: Pipeline State Integrity** | 0 ingested articles yields `NO_DATA` or `STALE`, never `LIVE` | Passed |
| **Phase 7: Global Time Range** | Time query parameter (`24h`, `7d`, `30d`, `all`) propagates to DB query window | Passed |
| **Phase 8: AI Brief Architecture** | `/api/ai/brief` returns cached briefing with metadata; honest empty state when 0 reports | Passed |
| **Phase 9: Analyst Workflow Security** | Guest unauthenticated PATCH/POST returns HTTP 403 `GUEST_READ_ONLY`; authenticated writes persist | Passed |
| **Phase 10: Webhook Test Security** | Anonymous POST to `/api/webhooks/test` returns HTTP 401 `AUTH_REQUIRED`; no URL leakage | Passed |
| **Phase 11: Collection Protection** | Anonymous POST to `/api/news/refresh` returns HTTP 401; protected from DOS abuse | Passed |
| **Phase 12: Collection Runs Telemetry** | `/api/sources/runs` retrieves authoritative audit logs from database | Passed |
| **Phase 13: Route Precedence** | `/api/sources/runs` returns array of runs rather than treating `runs` as a source ID | Passed |
| **Phase 14: Report Data Consistency** | `/api/reports/export/*` reflects identical database records as dashboard | Passed |
| **Phase 15 & 16: Canonical Permissions** | Validates canonical structure (`permissionOutcome`, `rules`, `requirements`) without fake approvals | Passed |
| **Phase 17 & 18: Date Semantics** | Future timestamps flagged with `dateAnomaly: true`; null `published_at` not overwritten by `Date.now()` | Passed |
| **Phase 19: Domain Enrichment** | Domain lookup validates input, returns query telemetry without claiming fake external hits | Passed |
| **Phase 20 & 21: Notification & Errors** | Unconfigured SMTP returns HTTP 500 error; no mock success claimed in production | Passed |
| **Phase 22: CORS Configuration** | No wildcard CORS with credentials; strict origin headers | Passed |
| **Phase 31: Safe Sigma YAML** | User inputs with special characters are safely escaped via `yaml` serialization | Passed |

---

## 3. Continuous Integration Configuration

The GitHub Actions CI pipeline is configured in `.github/workflows/ci.yml`:

```yaml
name: CI Pipeline

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: 'soc-platform-ui-main/package-lock.json'
      - name: Install Dependencies
        run: |
          cd soc-platform-ui-main
          npm ci
      - name: Lint
        run: |
          cd soc-platform-ui-main
          npm run lint --if-present
      - name: Run Test Suite
        run: |
          cd soc-platform-ui-main
          npm test
      - name: Production Build
        run: |
          cd soc-platform-ui-main
          npm run build
        env:
          VITE_API_URL: ''
          ENABLE_DEMO_DATA: false
```

---

## 4. Manual Verification & QA Sign-Off Matrix

| Feature / Flow | Test Procedure | Expected Result | Actual Result |
| :--- | :--- | :--- | :--- |
| **Dashboard Ingestion Zero-State** | Flush articles; reload dashboard | Top banner displays "Pipeline Stale / No Data", Ingested: 0, AI Brief displays honest empty message | Verified |
| **Time Range Switching** | Select `Last 7 Days` in top-level dropdown | All API calls pass `?time=7d`; summary cards, AI Brief, News Feed reload with matching time filter | Verified |
| **Guest Note Modification** | Click report detail -> Type note -> Submit | Banner displays "Action Prohibited: Guest sessions are read-only. Authentication required." | Verified |
| **Webhook Delivery Test** | Click "Test Webhook" in Settings without token | Error prompt: "Authentication required to trigger webhook test." URL remains masked | Verified |
| **Sigma Generation Injection** | Submit IOC with quotes and YAML syntax characters | Generated rule is cleanly parsed and escaped by YAML parser without schema corruption | Verified |
| **Assistant Floating Widget** | Toggle assistant bubble in bottom right corner | Right-hand side panel opens smoothly; does not obscure navigation or table headers | Verified |
