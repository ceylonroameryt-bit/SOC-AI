# NO ENTRY — Multi-Tier Deployment & Architecture Guide

This guide details the step-by-step instructions for deploying the **NO ENTRY SOC Intelligence Platform** across **Supabase (PostgreSQL)**, **Vercel (React Frontend)**, and **Render / Railway (Node.js Backend & Python AI Microservice)**.

---

## 🏛️ Architecture Overview

```
                           ┌───────────────────────────┐
                           │    Frontend (Vite React)  │
                           │     Hosted on Vercel      │
                           └─────────────┬─────────────┘
                                         │ REST API / CORS
                                         ▼
                           ┌───────────────────────────┐
                           │   Backend Server (Node)   │
                           │   Hosted on Render / Rail │
                           └──────┬─────────────┬──────┘
                                  │             │
                    HTTP Request  │             │ Connection Pool
                    for Briefings │             │ (pg Pool / SSL)
                                  ▼             ▼
  ┌──────────────────────────────────┐       ┌──────────────────────────────────┐
  │   AI Microservice (Python app.py)│       │     PostgreSQL Database          │
  │    Hosted on Render Web Service  │       │     Hosted on Supabase / Neon    │
  └──────────────────────────────────┘       └──────────────────────────────────┘
```

---

## Step 1: Database Setup (Supabase PostgreSQL)

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** in your Supabase dashboard.
3. Open [`schema.sql`](./schema.sql) and paste the entire SQL script into the editor.
4. Click **Run**. This will:
   - Enable `uuid-ossp` and `pg_trgm` extensions.
   - Create `threats`, `iocs`, `threat_mitre_mapping`, `incident_clusters`, and `alert_logs` tables.
   - Set up unique deduplication indexes and analytical views (`v_severity_stats`, `v_top_mitre_techniques`).
5. Copy your connection string from **Project Settings ➔ Database ➔ Connection String ➔ URI** (Session Pooler mode):
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```

---

## Step 2: Backend & Python AI Deployment (Render / Railway)

### Option A: Render (Using `render.yaml`)
1. Link your GitHub repository to [render.com](https://render.com).
2. Click **New ➔ Blueprint** and select your repository. Render will automatically detect [`render.yaml`](./render.yaml) and configure both services:
   - **`no-entry-soc-backend`** (Node.js Express)
   - **`no-entry-ai-microservice`** (Python FastAPI)
3. Set the following environment variables in the Render Dashboard for the backend service:
   - `DATABASE_URL`: Your Supabase connection string.
   - `VIRUSTOTAL_API_KEY`: (Optional) Free API key from virustotal.com.
   - `ABUSEIPDB_API_KEY`: (Optional) Free API key from abuseipdb.com.
   - `SLACK_WEBHOOK_URL` / `DISCORD_WEBHOOK_URL`: (Optional) ChatOps alert URLs.
   - `INGEST_API_KEY`: Secret token for external SIEM pushes (`POST /api/v1/alerts`).

---

## Step 3: Frontend & Serverless Hosting on Vercel

The platform is fully optimized for **Vercel** with full SPA client-side routing, automated Serverless Function execution (`/api/*`), and built-in analyst authentication.

### Option A: Standard Deployment (Recommended)
1. Go to [vercel.com](https://vercel.com) and click **"Add New... ➔ Project"**.
2. Import your GitHub / GitLab repository.
3. In the project configuration:
   - **Root Directory**: `soc-platform-ui-main` (or leave default if deploying from monorepo root)
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Configure Environment Variables in Vercel Dashboard (Project Settings ➔ Environment Variables):
   - `AUTH_SECRET`: A secure random string used to sign analyst session tokens (e.g. `soc-super-secret-key-2026`).
   - `DATABASE_URL`: (Optional) Your Supabase / PostgreSQL database URI. If omitted, the platform runs in high-speed in-memory store.
   - `ALLOWED_ORIGIN`: (Optional) Your custom domain if applicable (all `*.vercel.app` domains are automatically whitelisted).
5. Click **Deploy**. Vercel will build the frontend assets and automatically deploy the Express API as a serverless function (`/api`).

### Option B: Monorepo Root Deployment
- If you import from the repository root without changing the Root Directory, Vercel will use [`vercel.json`](./vercel.json) at the root level which automatically runs `cd soc-platform-ui-main && npm install && npm run build` and serves static files from `soc-platform-ui-main/dist`.

---

## 🔐 Authentication & Analyst Login Process

The platform features an integrated Cyber Operations Center authentication gateway protecting all workspace and intelligence views.

### Default Operational Analysts:
| Role | Callsign / Email | Password | Clearance Level | Permissions |
|---|---|---|---|---|
| **Lead SecOps Commander** | `admin@soc.corp` | `admin123` | **Level 5 (Top Secret // SCI)** | Full administrative command, pipeline controls & alert dispatch |
| **Threat Intel Analyst** | `analyst@soc.corp` | `analyst123` | **Level 3 (Secret)** | Threat hunting, IOC enrichment, MITRE ATT&CK analysis |
| **Incident Responder** | `responder@soc.corp` | `responder123` | **Level 2 (Confidential)** | Triage, containment verification & reporting |

### Authentication Features:
- **1-Click Demo Access**: Fast role selection cards allow instant one-click login for evaluators, recruiters, and demo viewers without manual typing.
- **Manual Authentication**: Supports email/callsign and password authentication with security passkey reveal and validation.
- **Auto-Provisioning**: Any operational analyst identifier can register or sign in dynamically.
- **Cryptographic Session Tokens**: HMAC-SHA256 authenticated sessions persisted to local storage for 7 days.
- **Route Guarding**: All operational views (`/intelligence`, `/overview`, `/threats`, `/investigate`, etc.) are protected behind `<ProtectedRoute />`. Unauthenticated visitors are automatically routed to `/login`.
- **TopBar & Sidebar Integration**: Real-time display of active analyst name, role, clearance badge, and a one-click **"Sign Out & Terminate Session"** action.

---

## 💻 Local Development Workflow

Run all services locally in separate terminal windows:

### Terminal 1 — Python AI Microservice (FastAPI on port 8000)
```bash
pip install -r requirements.txt
python app.py
# Interactive API documentation: http://localhost:8000/docs
```

### Terminal 2 — Node.js Express Backend (Port 3000)
```bash
cd soc-platform-ui-main
npm run server
# REST API: http://localhost:3000/api/news, /api/mitre/news, /api/enrich
```

### Terminal 3 — Vite React Frontend (Port 5174 / 5173)
```bash
cd soc-platform-ui-main
npm run dev
# Web Dashboard: http://localhost:5174
```
