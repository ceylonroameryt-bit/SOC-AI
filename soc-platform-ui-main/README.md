# 🔒 NO ENTRY — SOC Intelligence Platform

A real-time **Security Operations Center (SOC)** dashboard built with React, TypeScript, and Express. It aggregates cybersecurity news from 100+ RSS feeds, performs automated severity classification, tracks active threats, and delivers periodic email intelligence reports.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [Security Architecture](#-security-architecture)
- [API Reference](#-api-reference)
- [Pages & Components](#-pages--components)
- [Email Notifications](#-email-notifications)
- [Deployment](#-deployment)

---

## ✨ Features

| Feature | Description |
|---|---|
| **Live News Feed** | Aggregates cybersecurity news from 100+ RSS sources with 5-second live polling |
| **Severity Classification** | AI-powered keyword analysis categorizes news as Critical / High / Medium / Low |
| **Category Tagging** | Auto-tags news into categories: Ransomware, Data Breach, Vulnerability, Malware, Phishing, Government, Dark Web |
| **Threat Intelligence** | Daily auto-generated threat reports with IOCs (IPs, domains, hashes) |
| **Severity Analytics** | Interactive bar charts powered by Recharts showing severity distribution |
| **Critical Threats View** | Dedicated page with real-time Threat Level indicator and split Critical/High panels |
| **Data Archives** | Searchable, filterable news archive with timeline and grid views |
| **Intel Sources** | Manage 100+ RSS feed sources with category-based organization |
| **Report Export** | Download daily reports as TXT or export threats/news as CSV |
| **Email Reports** | Automated email reports every 3 hours via Gmail + manual trigger button |
| **Mobile Responsive** | Collapsible sidebar, hamburger menu, responsive grids |
| **Security Hardened** | Helmet, CSP, CORS allowlist, rate limiting, input validation, error handling |

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19.2 | UI Framework |
| TypeScript | 5.9 | Type Safety |
| Vite | 7.3 | Build Tool & Dev Server |
| Tailwind CSS | 3.4 | Styling |
| React Router | 7.13 | Client-Side Routing (SPA) |
| Recharts | 3.7 | Data Visualization |
| Lucide React | 0.563 | Icons |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Express | 5.2 | HTTP Server |
| Helmet | 8.1 | Security Headers |
| express-rate-limit | 8.2 | Rate Limiting |
| CORS | 2.8 | Cross-Origin Control |
| Compression | 1.8 | GZIP Response Compression |
| RSS Parser | 3.13 | Feed Aggregation |
| Nodemailer | 8.0 | Email Delivery |
| Node-Cron | 4.2 | Scheduled Tasks |
| dotenv | 17.2 | Environment Variables |

---

## 📁 Project Structure

```
soc-ui/
├── server/                     # Backend (Express API)
│   ├── server.js               # Main server with security middleware
│   ├── routes/
│   │   ├── news.js             # GET /api/news, /api/news/stats
│   │   ├── threats.js          # GET /api/threats, /api/threats/:id
│   │   ├── reports.js          # GET /api/reports/daily, /export/threats, /export/news
│   │   └── sources.js          # GET /api/sources, /api/sources/stats
│   ├── services/
│   │   ├── newsService.js      # RSS aggregation, caching, severity engine
│   │   └── emailService.js     # Email report generation & delivery
│   └── data/
│       ├── news.json           # Cached news articles
│       ├── threats.json        # Active threat intelligence
│       └── sources.json        # RSS feed source list (100+ feeds)
│
├── src/                        # Frontend (React + TypeScript)
│   ├── App.tsx                 # Router & lazy-loaded pages
│   ├── main.tsx                # Entry point
│   ├── index.css               # Global styles
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Layout.tsx      # Main layout (Sidebar + TopBar + Outlet)
│   │   │   ├── Sidebar.tsx     # Navigation sidebar (collapsible on mobile)
│   │   │   └── TopBar.tsx      # Top bar with search, email & download buttons
│   │   └── dashboard/
│   │       ├── NewsFeed.tsx     # Live news feed with severity badges
│   │       ├── NewsSummary.tsx  # News summary cards
│   │       ├── SeverityChart.tsx# Severity distribution bar chart
│   │       └── CriticalThreatsView.tsx  # Threat level + critical/high panels
│   └── pages/
│       ├── Dashboard.tsx       # Main dashboard (news feed + summary)
│       ├── Threats.tsx         # Threat intelligence table
│       ├── Archives.tsx        # Searchable news archive
│       └── Sources.tsx         # RSS source management
│
├── .env                        # Environment variables (NEVER commit!)
├── .gitignore                  # Git ignore rules (includes .env)
├── package.json                # Dependencies & scripts
├── vite.config.ts              # Vite configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
└── web.config                  # IIS deployment config (Azure)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later
- **Gmail Account** with App Password (for email reports)

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd soc-ui
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example below into a `.env` file in the project root:

```env
# Server
PORT=3000
NODE_ENV=development

# Email Configuration (Gmail App Password)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password
DEFAULT_EMAIL=your-email@gmail.com

# CORS (production domain, leave empty for dev)
ALLOWED_ORIGIN=
```

> ⚠️ **Gmail App Password**: Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) to generate one. You need 2-Factor Authentication enabled first.

### 4. Start Development Servers

Open **two terminals**:

**Terminal 1 — Backend Server (port 3000):**
```bash
npm run server
```

**Terminal 2 — Frontend Dev Server (port 5173):**
```bash
npm run dev
```

### 5. Open the App

Navigate to **http://localhost:5173** in your browser.

### Available Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `vite` | Start frontend dev server (port 5173) |
| `npm run server` | `nodemon server/server.js` | Start backend with auto-reload (port 3000) |
| `npm start` | `node server/server.js` | Start backend (production, no auto-reload) |
| `npm run build` | `tsc -b && vite build` | Build production frontend to `/dist` |
| `npm run lint` | `eslint .` | Run ESLint checks |
| `npm run preview` | `vite preview` | Preview production build locally |

---

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `EMAIL_USER` | Yes (for email) | — | Gmail address for sending reports |
| `EMAIL_PASS` | Yes (for email) | — | Gmail App Password (16 characters) |
| `DEFAULT_EMAIL` | No | `poornasujampathi@gmail.com` | Default recipient for scheduled reports |
| `ALLOWED_ORIGIN` | No | — | Production domain for CORS (e.g., `https://yourdomain.com`) |

---

## 🔒 Security Architecture

This application implements **defense-in-depth** with multiple security layers:

### 1. HTTP Security Headers (Helmet)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' http://localhost:3000 http://localhost:5173;
  frame-src 'none';
  object-src 'none';

X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
```

| Header | Protection Against |
|---|---|
| **CSP** | XSS, code injection, unauthorized resource loading |
| **X-Frame-Options: DENY** | Clickjacking attacks |
| **X-Content-Type-Options: nosniff** | MIME-type sniffing attacks |
| **X-XSS-Protection** | Reflected XSS in older browsers |
| **HSTS** | Protocol downgrade attacks (forces HTTPS) |
| **Referrer-Policy** | Information leakage via Referer header |
| **Permissions-Policy** | Unauthorized access to camera, microphone, geolocation |
| **COOP** | Cross-origin window attacks (Spectre-type) |

### 2. CORS — Strict Origin Allowlist

```javascript
// Only these origins can make API requests:
const allowedOrigins = [
    'http://localhost:5173',   // Vite dev server
    'http://localhost:3000',   // Server itself
    process.env.ALLOWED_ORIGIN // Your production domain
];
```

❌ **Before**: `origin: '*'` (any website could access the API)  
✅ **After**: Only explicitly allowed origins can make requests. Blocked origins are logged as security warnings.

### 3. Rate Limiting (Tiered)

| Endpoint | Limit | Window | Purpose |
|---|---|---|---|
| All `/api/*` routes | **500 requests** | 15 minutes | Prevents API abuse & DDoS |
| `/api/notifications/send` | **10 requests** | 15 minutes | Prevents email spam/abuse |

Rate limit headers are returned in every response:
```
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 499
X-RateLimit-Reset: 1707696000
```

### 4. Input Validation

**Email endpoint (`POST /api/notifications/send`)**:
```javascript
// Server-side regex validation
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
if (email && !emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address format.' });
}
```

### 5. Request Body Size Limit

```javascript
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
```

Protects against **payload bomb attacks** — any request body larger than 10KB is rejected with `413 Payload Too Large`.

### 6. Global Error Handler

```javascript
// Production: generic error messages only
// Development: detailed error messages for debugging
res.status(500).json({
    error: isDev ? err.message : 'Internal server error.'
});
```

- ✅ Stack traces are **never** exposed to clients in production
- ✅ All errors are logged server-side for debugging
- ✅ CORS errors return `403` with a clean message
- ✅ Malformed JSON returns `400` with a clean message

### 7. Static File Security

```javascript
app.use(express.static(path.join(__dirname, '../dist'), {
    dotfiles: 'deny',    // Blocks .env, .git, etc.
    etag: true,           // Cache validation
    maxAge: '1d',         // Browser caching
    index: false          // No directory listing
}));
```

### 8. Audit Logging

Every API request is logged with:
```
[2026-02-11T23:40:00.000Z] GET /api/news 200 12ms - ::1
[2026-02-11T23:40:05.123Z] POST /api/notifications/send 200 1523ms - ::1
```

Fields: `timestamp`, `method`, `path`, `status code`, `duration`, `client IP`

### 9. Environment Variable Protection

- All secrets stored in `.env` file
- `.env` is in `.gitignore` — **never committed to version control**
- `dotenv` loaded at server start via `import 'dotenv/config'`

### 10. Response Compression

All API responses are **GZIP compressed** via the `compression` middleware, reducing bandwidth and improving performance.

### Security Summary

```
┌──────────────────────────────────────────────────────────┐
│                    CLIENT REQUEST                         │
└──────────────────┬───────────────────────────────────────┘
                   │
           ┌───────▼───────┐
           │  Compression  │  GZIP all responses
           └───────┬───────┘
           ┌───────▼───────┐
           │    Helmet     │  20+ security headers
           └───────┬───────┘
           ┌───────▼───────┐
           │  Custom Hdrs  │  X-Frame, XSS, Permissions
           └───────┬───────┘
           ┌───────▼───────┐
           │     CORS      │  Origin allowlist check
           └───────┬───────┘
           ┌───────▼───────┐
           │  Body Parser  │  10KB size limit
           └───────┬───────┘
           ┌───────▼───────┐
           │ Rate Limiter  │  500 req/15min (API)
           └───────┬───────┘
           ┌───────▼───────┐
           │  Audit Log    │  Log method, path, IP, timing
           └───────┬───────┘
           ┌───────▼───────┐
           │   API Route   │  Input validation
           └───────┬───────┘
           ┌───────▼───────┐
           │ Error Handler │  No stack trace leaks
           └───────────────┘
```

---

## 📡 API Reference

### News

| Method | Endpoint | Description | Response |
|---|---|---|---|
| `GET` | `/api/news` | Get latest 50 news items (from cache) | `NewsItem[]` |
| `GET` | `/api/news/stats` | Severity distribution stats | `{ name, count }[]` |

### Threats

| Method | Endpoint | Description | Response |
|---|---|---|---|
| `GET` | `/api/threats` | Get all active threats | `Threat[]` |
| `GET` | `/api/threats/:id` | Get threat by ID | `Threat` |

### Reports

| Method | Endpoint | Description | Response |
|---|---|---|---|
| `GET` | `/api/reports/daily` | Download daily report | `text/plain` file |
| `GET` | `/api/reports/export/threats` | Export threats as CSV | `text/csv` file |
| `GET` | `/api/reports/export/news` | Export news archive as CSV | `text/csv` file |

### Sources

| Method | Endpoint | Description | Response |
|---|---|---|---|
| `GET` | `/api/sources` | Get all RSS sources | `Source[]` |
| `GET` | `/api/sources/stats` | Source category statistics | `{ total, categories }` |

### Notifications

| Method | Endpoint | Description | Rate Limit |
|---|---|---|---|
| `POST` | `/api/notifications/send` | Send email report | **10 req/15min** |

**Request Body:**
```json
{
  "email": "recipient@example.com"
}
```

---

## 📄 Pages & Components

### Pages

| Page | Route | Description |
|---|---|---|
| **Dashboard** | `/` | Main view with live news feed and summary cards |
| **Critical Threats** | `/critical` | Threat level indicator, severity chart, critical/high panels |
| **Threat Intel** | `/threats` | Detailed threat table with IOCs |
| **Severity Metrics** | `/metrics` | Full-page severity distribution chart |
| **Data Archives** | `/archives` | Searchable, filterable news archive with timeline view |
| **Intel Sources** | `/sources` | RSS feed source management with categories |

### Layout Components

| Component | Description |
|---|---|
| `Layout.tsx` | Main layout wrapper with Sidebar + TopBar + Content outlet |
| `Sidebar.tsx` | Navigation sidebar — collapsible on mobile with hamburger menu |
| `TopBar.tsx` | Search bar, "Email Report" button, "Download Report" button |

### Dashboard Components

| Component | Description |
|---|---|
| `NewsFeed.tsx` | Live news feed with severity badges, source labels, external links. Polls every 5 seconds. |
| `NewsSummary.tsx` | Summary statistics cards |
| `SeverityChart.tsx` | Interactive severity distribution bar chart (Recharts) |
| `CriticalThreatsView.tsx` | Threat level widget + split Critical/High priority panels with severity distribution chart |

---

## 📧 Email Notifications

### Setup Gmail App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification**
3. Go to [App Passwords](https://myaccount.google.com/apppasswords)
4. Generate an app password for "Mail"
5. Copy the 16-character password into your `.env`:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
```

### Schedule

- **Automatic**: Every **3 hours** (00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00)
- **Manual**: Click the "Email Report" button in the TopBar

### Report Contents

```
PERIODIC SECURITY INTELLIGENCE REPORT
Generated: 2/11/2026, 11:00:00 PM
==========================================

[ SUMMARY ]
Total New Threats: 5
Total News Items: 23

[ ACTIVE THREATS ]
• [CRITICAL] Zero-Day (Threat Intel Feed)
  desc: Active Zero-Day campaign detected...

[ GLOBAL SECURITY NEWS ]
• Windows 11 Notepad flaw let files execute silently
  Source: BleepingComputer | Severity: Critical
  Link: https://...
```

---

## 🌐 Deployment

### Build for Production

```bash
npm run build
```

This creates an optimized production bundle in the `/dist` folder.

### Run in Production

```bash
NODE_ENV=production npm start
```

In production mode:
- Error messages are generic (no stack traces)
- HSTS is enforced
- Set `ALLOWED_ORIGIN` in `.env` to your domain

### Azure App Service

A `web.config` file is included for IIS/Azure deployment. It configures:
- URL rewriting for SPA routing
- Node.js handler
- Static file serving

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📜 License

This project is private and proprietary.

---

**Built with ❤️ for Cybersecurity Professionals**
