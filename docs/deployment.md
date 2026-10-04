# Production Deployment Guide — NO ENTRY Threat Intelligence Platform

**Project:** NO ENTRY — Threat Intelligence Platform / SOC-AI  
**Target Environments:** Vercel (Frontend & Serverless API), Supabase / PostgreSQL (Authoritative Database), GitHub Actions (Scheduled Ingestion Pipeline & CI/CD)  
**Revision:** 2.0  

---

## 1. Prerequisites & Required Services

Before deploying, ensure you have provisioned:
1. **PostgreSQL Database:** Supabase project or any managed PostgreSQL 15+ instance.
2. **Vercel Account:** Hosting for the React 19 frontend and Node.js serverless functions.
3. **GitHub Repository:** Configured with GitHub Secrets for CI/CD and the Scheduled Collector.

---

## 2. Environment Variables Configuration

Copy `.env.example` to your production deployment environment. Configure the variables according to this checklist:

### A. Critical Infrastructure (Required)
| Variable | Description | Example / Default |
|---|---|---|
| `DATABASE_URL` | Supabase Transaction Pooler URI (port 6543) | `postgresql://postgres.[REF]:[PASS]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require` |
| `INGEST_API_KEY` | Secret token required for collector ingestion & protected routes | `min-32-char-random-alphanumeric-string` |
| `ALLOWED_ORIGIN` | Strict CORS origin | `https://soc-ai-six.vercel.app` |
| `ENABLE_DEMO_DATA` | Must be `false` in production | `false` |
| `APP_MODE` | Runtime environment identifier | `production` |
| `NODE_ENV` | Runtime environment | `production` |

### B. Third-Party Integrations (Optional)
| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key for executive brief generation (`OPENAI_MODEL=gpt-4o-mini`) |
| `VIRUSTOTAL_API_KEY` | VirusTotal v3 API key for IP/Hash/Domain reputation enrichment |
| `ABUSEIPDB_API_KEY` | AbuseIPDB API key for IP confidence triage |
| `SLACK_WEBHOOK_URL` | Incoming webhook URL for SOC alert notifications |
| `TEAMS_WEBHOOK_URL` | Microsoft Teams Office 365 webhook URL |
| `DISCORD_WEBHOOK_URL`| Discord channel webhook URL |
| `SMTP_HOST` / `USER` / `PASS` | SMTP outbound credentials for scheduled threat advisory dispatch |

---

## 3. Vercel Deployment Procedure

The application is structured for instant Vercel deployment:
- **Build Command:** `npm run build` (runs `tsc -b && vite build`)
- **Output Directory:** `dist`
- **Root Directory:** `soc-platform-ui-main` (or root depending on Vercel project settings)

### Step-by-Step Vercel Setup:
1. Link your GitHub repository to Vercel.
2. Under **Project Settings → General**:
   - Framework Preset: `Vite`
   - Root Directory: `soc-platform-ui-main`
3. Under **Project Settings → Environment Variables**:
   - Add `DATABASE_URL` (using Supabase transaction pooler URL).
   - Add `INGEST_API_KEY`.
   - Add `ALLOWED_ORIGIN` (`https://soc-ai-six.vercel.app`).
   - Add `ENABLE_DEMO_DATA` (`false`).
   - Add optional API keys (`OPENAI_API_KEY`, `VIRUSTOTAL_API_KEY`, etc.).
4. Trigger a deployment. Vercel automatically deploys the static frontend to the Edge and routes `/api/*` to the serverless Express engine via `api/index.js`.

---

## 4. Scheduled Collector Pipeline

Because Vercel serverless functions have execution timeouts (15–60s) and ephemeral filesystems, **batch feed collection must never be executed inside user-facing HTTP requests**.

Feed collection is automated through the dedicated GitHub Actions workflow:
`.github/workflows/scheduled-collector.yml`

### Schedule Configuration:
- Runs automatically on cron: `0 */4 * * *` (Every 4 hours).
- Can be manually triggered via `workflow_dispatch`.
- Authenticates against production using `INGEST_API_KEY` and updates PostgreSQL directly.

### Running Collector Manually:
```bash
cd soc-platform-ui-main
export DATABASE_URL="postgresql://..."
export INGEST_API_KEY="..."
npm run collector
```

---

## 5. Post-Deployment Verification Checklist

Verify deployment health using the following manual checks:
1. **Health Endpoint:**
   `curl https://soc-ai-six.vercel.app/api/health`
   Should return HTTP 200 with `{ "status": "ok", "timestamp": "..." }`.
2. **Snapshot Telemetry:**
   `curl https://soc-ai-six.vercel.app/api/dashboard/snapshot?time=24h`
   Verify `pipeline.state` displays authentic state (`LIVE`, `DEGRADED`, `STALE`, or `NO DATA`).
3. **Protected Refresh Endpoint:**
   `curl -X POST https://soc-ai-six.vercel.app/api/news/refresh`
   Must return HTTP 401 Unauthorized (`{"error": "Unauthorized"}`).
4. **Analyst Mutation Security:**
   Verify that guest users in the UI receive read-only notices and cannot update incident status without credentials.
5. **No Demo Data Leakage:**
   Inspect `/api/news?time=24h` to confirm zero objects have `isSimulated: true`.
