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

## Step 3: Frontend Deployment (Vercel)

1. Go to [vercel.com](https://vercel.com) and import your Git repository.
2. Set the **Root Directory** to `soc-platform-ui-main`.
3. In **Build & Development Settings**:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add the Environment Variable:
   - `VITE_API_URL`: The URL of your Render backend (e.g. `https://no-entry-soc-backend.onrender.com`).
5. Click **Deploy**. Vercel will use [`vercel.json`](./soc-platform-ui-main/vercel.json) to handle Single-Page Application (SPA) routing automatically.

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
