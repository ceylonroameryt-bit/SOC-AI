# Security Architecture & Threat Defense Report — NO ENTRY SOC-AI

**Project:** NO ENTRY — Threat Intelligence Platform / SOC-AI  
**Classification:** Enterprise SOC Platform Standard  
**Revision:** 2.0  
**Status:** Hardened & Verified  

---

## 1. Security Architecture Summary

The NO ENTRY Threat Intelligence Platform operates as a frontline defensive cybersecurity instrument. As such, the application must adhere to strict security baselines, ensuring that untrusted external threat telemetry cannot compromise internal operations or lead to credential exposure.

---

## 2. Threat Modeling & Defense Implementations

### A. Timing Side-Channel Attack Prevention
- **Threat:** Attackers observing nanosecond differences in string comparisons to deduce secret API keys (`INGEST_API_KEY`, `NOTIFICATION_API_KEY`).
- **Mitigation:** All authentication tokens are verified using `crypto.timingSafeEqual()` in `server/utils/auth.js`.
- **Implementation:**
  ```javascript
  export function safeEqual(a, b) {
      if (typeof a !== 'string' || typeof b !== 'string') return false;
      const bufA = Buffer.from(a, 'utf8');
      const bufB = Buffer.from(b, 'utf8');
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
  }
  ```
  Fail-closed logic ensures that unset or blank environment keys immediately return HTTP 503 instead of false matches.

---

### B. CSV Formula Injection (CWE-1236)
- **Threat:** Threat actors injecting formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) into threat titles or CVE descriptions, triggering arbitrary command execution when SOC analysts export CSV reports into Excel or Google Sheets.
- **Mitigation:** In `server/utils/csv.js`, every exported field is sanitized through `escapeCsvField()`.
- **Implementation:** Any field starting with formula triggers is prefixed with an apostrophe (`'`), neutralizing spreadsheet formula parsing.

---

### C. SIEM / Sigma YAML Code Injection
- **Threat:** Malicious IOC values (e.g. `evil.exe" || calc.exe` or multi-line YAML payloads) injected into threat hunting query generators to alter Sigma rule logic or escape YAML blocks.
- **Mitigation:**
  - Removed all raw string interpolation templates in `server/services/siemQueryService.js`.
  - Switched to typed object composition serialized via `js-yaml.dump({ lineWidth: -1, noRefs: true })`.
  - Splunk SPL and Microsoft Sentinel KQL generators escape metacharacters (`"`, `\`, `*`, `?`) before output.

---

### D. Server-Side Request Forgery (SSRF) & Webhook Security
- **Threat:** Internal service port scanning or intranet exploitation via attacker-supplied webhook URLs or custom RSS feeds.
- **Mitigation:**
  - In `server/services/webhookService.js`, webhook URLs must adhere to strict HTTPS schemes.
  - Private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.1`, `localhost`, `169.254.169.254` AWS metadata) are rejected.
  - The webhook test endpoint requires administrative authentication.

---

### E. Rate Limiting & Denial of Service (DoS) Defense
- **Mitigation:** Applied granular Express rate limiters (`express-rate-limit`) on compute-heavy or third-party metered routes:
  - `aiLimiter`: 10 requests / 15 minutes (protects LLM tokens & budgets).
  - `vtLimiter`: 30 requests / minute (protects VirusTotal & AbuseIPDB quotas).
  - `analystLimiter`: 60 requests / minute (protects mutation endpoints).
  - Standard public read endpoints (`/api/news`, `/api/sources`) remain accessible without blocking legitimate analysts.

---

### F. Strict Cross-Origin Resource Sharing (CORS)
- **Problem:** Previous configurations combined `credentials: true` with wildcard origins, or mismatched headers.
- **Mitigation:**
  - Enforced strict origin filtering using `ALLOWED_ORIGIN` (defaulting to `https://soc-ai-six.vercel.app`).
  - Set `credentials: false` across public routes.
  - Removed wildcard origins on authenticated endpoints.

---

### G. SQL Injection Prevention
- **Mitigation:** 100% of database interactions in `server/db/db.js` use PostgreSQL parameterized queries (`$1, $2, ...`). Zero string-concatenated SQL queries exist in the codebase.

---

### H. Secret Isolation & Zero Client Leakage
- **Audit Verification:**
  - Frontend bundle inspection confirms zero instances of `INGEST_API_KEY`, `OPENAI_API_KEY`, `VIRUSTOTAL_API_KEY`, `ABUSEIPDB_API_KEY`, or `DATABASE_URL`.
  - Vite client variables are strictly restricted to public non-sensitive prefixes (`VITE_*`).
  - Webhook URLs displayed in the Settings UI are masked (`https://hooks.slack.com/services/***`).
  - Backend errors return structured JSON with safe error codes (`UNAUTHORIZED`, `SMTP_UNCONFIGURED`, `RATE_LIMITED`); stack traces are suppressed from client responses.

---

### I. Untrusted Feed Content Sanitization
- **Threat:** External RSS/Atom feeds containing malicious HTML/JavaScript payloads.
- **Mitigation:**
  - Content snippets are stripped of raw HTML before storage and rendering.
  - Image hotlinking and source logos are suppressed unless explicitly licensed.
  - Ingestion limits text snippets to 500 characters, enforcing copyright and legal compliance.
