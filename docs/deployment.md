# Deployment Guide & DevOps Specification

## 1. Deployment Topology

The platform supports two deployment targets:
1. **Vercel Serverless (Frontend + Serverless Node.js API)**:
   - Configured via root `vercel.json` and `soc-platform-ui-main/vercel.json`.
   - Frontend is built into `dist/` and served at root.
   - All `/api/*` routes rewrite to `api/index.js`, executing the unified Express application without filesystem dependencies.
2. **Dedicated Node.js / Docker Container**:
   - Executes `node server/server.js` listening on `$PORT` (default: 3000).
   - Serves API routes and static production bundle from `dist/`.
   - Runs in-process background cron worker for periodic threat feed ingestion.

## 2. Environment Variables Configuration

Set these variables in Vercel Project Settings or your `.env` container environment:

| Variable | Required | Description | Example / Recommended Value |
|---|---|---|---|
| `DATABASE_URL` | **Yes (Prod)** | PostgreSQL/Supabase Pooler URI | `postgresql://postgres.[REF]:[PASS]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require` |
| `NODE_ENV` | **Yes** | Node environment | `production` |
| `APP_MODE` | **Yes** | Operational mode | `production` |
| `ENABLE_DEMO_DATA` | **Yes** | Strictly controls demo simulation fallback | `false` |
| `ALLOWED_ORIGIN` | **Yes** | Trusted origin for CORS headers | `https://soc-ai-six.vercel.app` |
| `INGEST_API_KEY` | **Yes** | Server key for collection triggers & mutations | Strong 32+ character random string |
| `NOTIFICATION_API_KEY` | Optional | Shared key for notification dispatches | Strong random string |
| `VIRUSTOTAL_API_KEY` | Optional | VirusTotal Public API for IP/Domain/Hash | Free or Premium VT API key |
| `ABUSEIPDB_API_KEY` | Optional | AbuseIPDB API for IP threat scoring | Free or Premium AbuseIPDB key |
| `OPENAI_API_KEY` | Optional | LLM API key for Executive Briefing | `sk-...` |
| `OPENAI_MODEL` | Optional | OpenAI model selector | `gpt-4o-mini` |
| `AI_SERVICE_URL` | Optional | Python FastAPI microservice | `http://127.0.0.1:8000` |
| `SLACK_WEBHOOK_URL` | Optional | ChatOps Slack incoming webhook | `https://hooks.slack.com/services/...` |
| `TEAMS_WEBHOOK_URL` | Optional | Microsoft Teams incoming webhook | `https://...webhook.office.com/...` |
| `DISCORD_WEBHOOK_URL` | Optional | Discord alert webhook | `https://discord.com/api/webhooks/...` |
| `SMTP_HOST` | Optional | Mail server host for daily reports | `smtp.gmail.com` |
| `SMTP_PORT` | Optional | Mail server port | `587` |
| `SMTP_USER` | Optional | SMTP username / address | `alerts@domain.com` |
| `SMTP_PASS` | Optional | SMTP password / app credential | Application password |

## 3. Database Migration Steps

1. Obtain your Supabase/PostgreSQL connection string.
2. Run the migration script:
   ```bash
   psql "$DATABASE_URL" -f soc-platform-ui-main/server/db/migrations/003_authoritative_source_of_truth.sql
   ```
3. Verify table presence:
   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
   ```

## 4. Scheduled Collector Strategy

In a Vercel serverless environment, invocations are capped at 15–60 seconds, which cannot accommodate multi-minute feeds collection across hundreds of sources.

### Recommended Pipeline: GitHub Actions Scheduled Workflow
Run the collector via GitHub Actions on a cron schedule (every 30 or 60 minutes):
```yaml
name: Scheduled Threat Ingestion
on:
  schedule:
    - cron: '*/30 * * * *'
  workflow_dispatch:

jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd soc-platform-ui-main && npm ci
      - name: Ingest Threat Feeds to PostgreSQL
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NODE_ENV: production
          ENABLE_DEMO_DATA: false
        run: cd soc-platform-ui-main && npm run collector
```

The collector directly writes new disclosures to `intel_articles`, evaluates real source latency in `source_health`, and completes the run audit in `collection_runs`. Vercel serverless lambdas immediately read the updated database without executing background network fetches.

## 5. Build & Verification Commands

```bash
cd soc-platform-ui-main
npm ci
npm run lint
npm test
npm run build
```
