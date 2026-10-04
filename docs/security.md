# Security Architecture & Hardening Specification

## 1. Threat Model & Security Posture

The NO ENTRY Threat Intelligence Platform operates under a zero-trust model for external telemetry and public client interactions.

## 2. Key Hardening Measures

### A. Authentication & Guest Authorization (Phase 9 & 10)
- **Guest Read-Only Principle**: Unauthenticated users may browse intelligence, search archives, view analytics, and query indicators.
- **Protected Mutations**: Any request to mutate triage status, record analyst investigation notes, dismiss incidents, trigger feed refreshes, or execute webhook test dispatches requires valid analyst or administrative credentials (`x-api-key` or `Authorization: Bearer <token>`).
- If an unauthenticated request attempts mutation, the server immediately rejects with HTTP 403 `GUEST_READ_ONLY` or HTTP 401 `AUTH_REQUIRED`. The frontend visibly reports the authorization requirement instead of silently ignoring failures.

### B. Single Source of Truth & Injection Prevention
- **SQL Injection**: All database operations in `server/db/db.js` use parameterized statements (`$1, $2, ...`), preventing query tampering.
- **CSV Formula Injection**: All exported CSV rows are escaped through `escapeCsvField()`, neutralizing dangerous spreadsheet prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`).
- **Sigma YAML Injection**: Sigma rule generation in `server/services/siemQueryService.js` uses standard `YAML.stringify()` rather than naive string concatenation, safely serializing arbitrary IOCs, descriptions, and titles.
- **Untrusted HTML Sanitization**: External RSS feed descriptions and titles are stripped of executable script tags and restricted to safe text.

### C. CORS & Header Security (Phase 22)
- Fixed CORS misconfiguration where `Access-Control-Allow-Origin: *` was coupled with `Access-Control-Allow-Credentials: true`.
- Dynamic CORS middleware validates incoming origins against `ALLOWED_ORIGIN`. Wildcard origins never transmit credentials.
- Security response headers applied via `helmet`:
  - `Content-Security-Policy`: Restricts script and object execution.
  - `X-Content-Type-Options`: `nosniff`.
  - `X-Frame-Options`: `SAMEORIGIN`.
  - `Permissions-Policy`: `camera=(), microphone=(), geolocation=()`.

### D. Secret Protection & API Key Masking
- No backend secrets (`DATABASE_URL`, `OPENAI_API_KEY`, `VIRUSTOTAL_API_KEY`, `ABUSEIPDB_API_KEY`, `INGEST_API_KEY`, `SMTP_PASS`) are exposed in Vite client environment variables or frontend bundles.
- Webhook endpoints (`/api/webhooks/config`) only return masked URLs (e.g. `https://hooks.slack.com/...XXXX`) to indicate whether an integration is configured, never disclosing the complete webhook token.

### E. Rate Limiting (Phase 23)
- Global windowed rate limiting protects sensitive endpoints:
  - `/api/news/refresh` & `/api/sources/refresh`: Restricted to prevent feed flooding.
  - `/api/enrich/*`: Windowed to preserve external third-party API quotas.
  - `/api/webhooks/test`: Protected against webhook amplification attacks.
  - `/api/rules/generate`: Rate-limited against resource exhaustion.

### F. Legal & Content Permissions Governance (Phase 15 & 16)
- The platform strictly distinguishes between technical feed connectivity and legal content-use permissions.
- RSS feeds without explicit verified licenses are recorded with `permissionOutcome = 'pending'`.
- Sources where `fetchingPermitted=false` or `displayingPermitted=false` cannot receive "Permitted" badges.
