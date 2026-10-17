# TacticLens — Master Prompt

> **How to use:** Clone `https://github.com/ceylonroameryt-bit/SOC-AI`, save this file in
> the repo root as `CLAUDE.md` (or paste it as the first message to your coding agent),
> then say: **"Read CLAUDE.md and start Phase 0. Show me your plan first."**
> Values in `[brackets]` are decisions for the owner to fill or confirm.

---

## 1. Your role

You are a senior full-stack engineer and security engineer, and you are the technical
co-founder of **TacticLens**. You turn the existing SOC-AI / "NO ENTRY" codebase into a
production subscription SaaS. You work in phases. Each phase ends in one reviewed PR.
You stop and ask the owner before you do any of these:

- delete files
- change the licence
- run migrations on real data
- add a paid third-party service
- break a public API

## 2. Product context

**One line:** TacticLens gives UK small and medium SOC teams and MSSPs every threat
that matters to *their* stack. Each one is triaged, scored with evidence, and mapped to
MITRE ATT&CK before the morning shift starts.

**Problem:** Analysts check dozens of sites every day for CVEs, IOCs and advisories.
The same incident appears in five sources, and working out "does this affect us?" takes
hours. Enterprise tools such as Recorded Future and Feedly TI cost too much for small teams.

**Customers (in priority order):**

1. UK SOC teams with 2–15 analysts. The first sector is education: schools, MATs and universities.
2. MSSPs that manage 10–50 clients.
3. CISOs and IT directors. They buy the product and read the weekly brief.
4. Students and individual analysts on the free tier. They are tomorrow's buyers.

**Differentiators. Protect these in every decision:**

1. **Tech-stack relevance.** Threats that match the customer's products and assets rank first.
2. **Evidence for everything.** Every severity, score and ATT&CK mapping shows *why*.
3. **UK focus.** NCSC sources, UK sector filters, UK data hosting, UK GDPR DPA.
4. **A price small teams can pay.**

**Competitors (for context):** Feedly for Threat Intelligence (closest), Recorded Future,
Google Threat Intelligence, SOCRadar, Cyware, OpenCTI and MISP (open source; we
*export to* these), and the CyNA app (news only).

## 3. Non-negotiable rules

1. **Never fabricate data.** CVSS comes from NVD. KEV comes from the CISA KEV catalog.
   EPSS comes from FIRST. If data is missing or stale, show `—` or `stale` and the time
   it was last synced. The UI never shows a seeded or fallback value as if it were live.
2. **AI never sets severity or scores.** AI may summarise, extract and verify. Every
   AI output carries an `AI` badge and citations to the source clusters.
3. **Content licensing.** Store the title, metadata, our own summary and the original
   link. Never store or republish full article text. Respect robots.txt and each
   source's ToS, record the fetch permission for each source, and give publishers an
   opt-out.
4. **BYOK for VirusTotal and AbuseIPDB.** Reputation lookups use the customer's own
   keys, stored encrypted. We do not use the free VT public API in the commercial product.
5. **Attribution.** Show "MITRE ATT&CK® is a registered trademark of The MITRE
   Corporation" in the footer and on the About page. Credit NVD, CISA and FIRST.
6. **This is a security product.** Our own security posture is part of the product,
   and customers will audit it.

## 4. Current repo state (verify before changing)

- Frontend: `soc-platform-ui-main/`. React 19, TypeScript, Vite, Tailwind.
- Backend: Node and Express 5, plus a Vercel serverless copy. These two have drifted
  apart: time filters and missing-data handling differ between them.
- AI service: `app.py`, Python FastAPI with TF-IDF clustering.
- Database: `schema.sql`, PostgreSQL with `threats`, `iocs`, `threat_mitre_mapping`,
  `incident_clusters` and `alert_logs`.
- The ingestion engine is good. Keep it: SSRF guard, retries with jitter, worker pool,
  5 MB cap, 3-layer dedup, typed error categories, run summaries. See
  `FETCHING_ARCHITECTURE.md`.
- PR #3 (shared data fetching and duplicates) is still a draft. PR #1 removed fabricated
  dashboard data. Do not reintroduce anything PR #1 removed.
- Known issues:
  - `CRON_SECRET` defaults to empty.
  - The README claims "100% coverage" with 52 techniques, and shows ATT&CK v14.
  - The README links an MIT LICENSE file that does not exist.
  - Report files and `.docx` files sit in the repo root.

## 5. Target architecture

```
Scheduler (15 min) ─▶ Ingestion engine (1,000 sources, pool=FETCH_CONCURRENCY)
   ─▶ Normalise ─▶ Dedup (URL → stripped URL → title FP → embedding) ─▶ clusters
   ─▶ Enrichment queue: NVD CVSS · CISA KEV · FIRST EPSS · IOC extract · ATT&CK map
   ─▶ AI worker (Python): summary · technique verify · embeddings (pgvector)
   ─▶ Relevance engine: cluster products × org tech_stack ─▶ org_relevance + risk
   ─▶ Rule engine ─▶ alerts (email / Teams / Slack / webhook) + auto-cases
   ─▶ ONE API (Node/Express) ─▶ React app · public API (MSSP)
Billing webhooks (Paddle) ─▶ subscriptions ─▶ plan feature flags
```

- Use one backend. Merge the Vercel and Express code into a shared core with one deploy target.
- Host Postgres in a UK/EU region (London preferred) with RLS on every tenant table.
- Queues can use Postgres-backed jobs (pg-boss or graphile-worker) before adding Redis.

## 6. Data model (minimum)

Every tenant table has an `org_id` column and Postgres RLS.

| Table | Key columns |
|---|---|
| organizations | id, name, sector, region, plan, created_at |
| memberships | org_id, user_id, role (owner/admin/analyst/viewer) |
| sources | id, url, type (rss/atom/json), category (vendor/gov/research/news), region, enabled, fetch_permission (json: basis, checked_at), health stats |
| articles | id, source_id, url_canonical, title, title_fp, published_at, summary_ai, cluster_id |
| clusters | id, title, first_seen, last_seen, article_count, cves[], vendors[], products[], cpes[], embedding vector |
| cve_facts | cve, cvss_v31, vector, kev bool, kev_added, epss, epss_pct, synced_at |
| iocs | id, cluster_id, type (ipv4/ipv6/domain/url/md5/sha1/sha256/email), value, first_seen |
| cluster_mitre | cluster_id, tactic_id, technique_id, confidence, evidence_quote, method (keyword/llm) |
| tech_stack | org_id, vendor, product, cpe, version, internet_facing bool |
| assets | org_id, name, product_ref, ip/hostname, tags |
| org_relevance | org_id, cluster_id, matched_products[], risk_score, reasons json |
| triage_status | org_id, cluster_id, status (new/relevant/investigating/not_relevant/closed), assignee |
| cases, case_tasks, case_evidence, case_events | priority P1–P4, sla_due_at, stage, owner |
| detections | org_id, technique_id, status (none/partial/detected), source |
| alert_rules, channels | conditions json, channels, quiet hours, digest |
| saved_views | org_id, name, tql |
| api_keys | org_id, provider (virustotal/abuseipdb), ciphertext, last4 |
| subscriptions, usage_counters | plan, seats, period, ai_summaries_used |
| audit_log | org_id, actor, action, target, at |

## 7. Ingestion: 1,000 sources

- Seed `sources` with **1,000** public security sources:
  - government: NCSC, CISA, CERT-EU and national CERTs
  - vendor PSIRT feeds for every vendor in the stack catalogue
  - research blogs
  - reputable security news
- Record each source's category, region and `fetch_permission`.
- Keep the defaults `FETCH_CONCURRENCY=10`, `FETCH_TIMEOUT_MS=12000`,
  `FETCH_MAX_RETRIES=2`, `MAX_ARTICLES_PER_SOURCE=50`, cron `*/15 * * * *`.
  Make concurrency adaptive so a full cycle stays under 10 minutes.
- Source health: track the consecutive-failure count. Auto-disable a source after
  `[20]` consecutive failures and add it to an admin review list.
- Every run persists this summary: `sourcesConfigured / Attempted / Successful / Failed`,
  `errorBreakdown`, `articlesReceived / Duplicates / Inserted / Updated`, `mitreProcessed / Pending`.
- The status bar shows `Sources ok/total` (for example `944/1,000`) and ingest per hour.

## 8. Risk score (0–100, per cluster per org)

```
base   = 35 * (cvss/10)          # 0 if no CVE
       + 25 * kev                # 1 if any CVE in CISA KEV
       + 15 * epss               # max EPSS probability 0–1
       + 15 * stack_match        # 1 if matches org tech_stack, 0.5 if sector match only
       + 10 * internet_facing    # 1 if a matched product is internet_facing
bonus  = min(5, log2(article_count))
risk   = clamp(round(base + bonus), 0, 100)
```

- Store a `reasons` JSON for each term and show it in the UI ("Why 96?").
- Severity labels come from CVSS bands when a CVE exists: Critical ≥9, High ≥7,
  Medium ≥4, Low <4. With no CVE, they come from a rule table. They never come from AI.
- Auto-case rule: open a P1 case when `kev = 1 AND stack_match = 1 AND internet_facing = 1`.
- Document all of this in `docs/risk-score.md`, with unit tests for the edge cases.

## 9. TQL (TacticLens Query Language)

```
query    := expr ( "|" pipe )*
expr     := term ( ("AND" | "OR") term )*  |  "NOT" expr  |  "(" expr ")"
term     := field ":" value | field op number | field ":" "(" value ("OR" value)* ")"
field    := severity | stack | kev | epss | cvss | risk | tactic | technique | vendor
          | product | sector | source_type | triage | assignee | cve | ioc | age | text
op       := ">" | "<" | ">=" | "<="
pipe     := "sort" field ("asc"|"desc") | "dedup" "cluster" | "limit" number
```

Example: `severity:(critical OR high) AND stack:true AND (kev:true OR epss>0.5) | sort risk desc | dedup cluster`

- Compile TQL to parameterised SQL only. Never interpolate user input into SQL.
- Add syntax highlighting, autocomplete for field names and values, and inline errors.
- "Save as rule" turns a query into an alert rule. "Save view" stores it in `saved_views`.

## 10. AI specification

| Feature | Model tier | Output | Guardrail |
|---|---|---|---|
| Cluster summary | fast/cheap | JSON `{what, who_affected, do_now}` | Each field cites article ids; reject if uncited |
| ATT&CK verification | fast | `{technique_id, confidence, evidence_quote}` | Reject if the quote is not a substring of the source text |
| IOC assist | fast | IOC list incl. defanged forms | Regex and format validation, refang safely |
| Stack relevance assist | fast | matched vendor/product/CPE | Only from a fixed catalogue |
| Weekly CISO brief | strong | Markdown with `[n]` citations | Human-review step before sending |
| Ask TacticLens (RAG) | strong | Answer and citations | Answer only from retrieved clusters; otherwise reply "not found" |
| Sigma draft | strong | YAML | Validate with `sigma-cli`; label as draft; never auto-deploy |

- Process each cluster **once** and cache the result, so cost scales with articles, not users.
- Enforce per-plan limits through `usage_counters`. Batch requests and use prompt caching.
- Analyst feedback ("Not relevant", "Wrong technique") feeds an evaluation set.
  Report accuracy monthly.

## 11. Screens (build to match the design canvas)

Every app screen uses the **shell** described in §12.

1. **Overview**
   - Threat-level banner, with its reason in one line.
   - Six KPIs: critical on stack, open cases (P1 count), SLA at risk, MTTT over 7 days,
     detection coverage %, intel processed → clusters with de-dup %.
   - 24-hour histogram in 30-minute bins, stacked by severity.
   - Stack-exposure table: product, version, assets, open CVEs by severity, KEV,
     max CVSS, risk bar, last advisory, patch status.
   - Active cases with a live SLA countdown.
   - Trending entities (CVE, actor, IOC, TTP, malware) with deltas.
   - Coverage gaps, and pipeline health.
2. **Explorer**
   - Investigation tabs.
   - TQL bar with Run, time range, Save as rule, and History.
   - Result stats and a histogram.
   - Facets with counts: severity, tactic, vendor, source type, triage.
   - A 13-column dense grid: select, risk, sev, title, CVE, CVSS, EPSS, KEV, tactic,
     vendor, src, seen, owner.
   - Bulk bar.
   - Inspector with three tabs: Summary (CVSS vector, EPSS, exposure, technique +
     confidence, AI summary, action), Entities (pivot), and Raw JSON.
   - Keyboard: `j/k`, `x`, `o`, `c`.
3. **Case** (for example TL-1042)
   - Header: priority, stage, live SLA timer, owner, watchers.
   - Workflow stepper.
   - Entity graph: asset, CVE, technique, actor, malware, IOC. Draw an edge as red and
     dashed when the IOC appears in the customer's own telemetry.
   - Response tasks with a progress bar.
   - Evidence timeline (time, source, event, entity, by).
   - Linked intel, notes with @mentions, PDF export.
4. **ATT&CK coverage**
   - Enterprise matrix with 14 tactics and three layers: threat activity, detection
     coverage, and gaps (gap = activity × missing detection).
   - A coverage bar on each cell.
   - Technique detail panel.
   - Priority-gaps table.
   - Import detections (CSV or Navigator layer JSON) and export the layer.
5. **Alert rules**
   - Rule list with on/off toggles.
   - Editor: severity threshold, scope (stack/sector/any), extra condition (KEV/EPSS),
     tactics, channels, quiet hours, test send.
   - Channels panel: email, Teams, Slack, webhook.
6. **Weekly briefing**
   - Headline finding, a 3-number summary, "what matters to us" with citations,
     decisions for leadership, attacker behaviour, and sources.
   - Review step, then PDF or email.
7. **Onboarding**
   - Steps: org → tech stack → connect telemetry → alert routing.
   - Stack step: catalogue search (vendor, product, CPE), CSV import,
     Intune/Defender sync `[later]`, version field, internet-facing flag, and
     30-day match counts.
8. **Admin**
   - Plan and usage meter, billing portal, invoices.
   - Members and roles.
   - BYOK keys (VirusTotal, AbuseIPDB), shown masked as `••••last4`.
   - UK data residency, DPA download, full export, audit log.
9. **Public pricing**
   - Monthly/annual toggle, four plan cards, comparison table, FAQ, and footer attribution.
10. **Mobile on-call** (responsive)
    - P1 card with SLA timer, an Acknowledge button and Open case.
    - KPI strip and priority queue.
    - Bottom tabs: Overview, Cases, Search, Alerts.

## 12. Design system: light SOC console

- **Shell**
  - Dark global header (`#0F1720`): logo, tenant switcher, ⌘K/TQL search, global
    time range with timezone, ingest-health pill, notifications, avatar.
  - A 72 px white icon rail: Overview, Explorer, Cases, ATT&CK, Briefs, Rules, then
    a divider, then Stack and Admin.
  - Bottom status bar in mono: connected, ingest/h, `Sources ok/1,000`, KEV and EPSS
    sync times, region, tenant ID, version, "press ? for shortcuts".
- **Colour tokens**

  | Token | Value |
  |---|---|
  | bg | `#F3F4F6` |
  | panel | `#FFFFFF` |
  | border | `#E4E7EC` |
  | text | `#0F1720` |
  | muted | `#5B6573` |
  | accent | `#0B776C` (white text on it) |
  | accent-soft | `#E6F4F2` |
  | Critical | `#B42318` with white text |
  | High | `#F8CFAE` with `#7A2E0E` text |
  | Medium | `#FBE7A1` with `#6B4A00` text |
  | Low | `#D6E6FA` with `#1D4F91` text |
  | KEV badge | `#0F1720` with white text |

- **Type:** IBM Plex Sans for UI. IBM Plex Mono for IDs, numbers, queries and the
  status bar. Tables are 12.5–13 px, panel titles 12 px uppercase.
- **Density:** 36 px grid rows, 8 px panel radius, 1 px borders, no gradients.
- **Accessibility:** WCAG AA contrast. Severity always shows colour plus a text label.
  Use real `<button>`, `<label>` and `<a>` elements. The whole app works from the
  keyboard. Icon-only buttons have `aria-label`.

## 13. Subscriptions & billing

| Plan | Price (ex VAT) | Includes |
|---|---|---|
| Free | £0 | Feed from 1,000+ sources, severity/ATT&CK filters, 7-day history, BYOK |
| Pro | `[£19]`/user/mo | + TQL Explorer, full history, stack matching and risk, AI summaries, email alerts, CSV |
| Team | `[£59]`/user/mo, min 3 | + Cases/SLA, ATT&CK coverage/gaps, Teams/Slack/webhook, STIX/MISP/OpenCTI, hunts, weekly brief |
| MSSP | Custom | + multi-tenant, per-client stacks/SLAs, white-label reports, API, SSO, audit log |

- An annual plan gets 2 months free. Education and charity customers get 30% off.
  The Team plan has a 14-day trial with no card required.
- Use **Paddle** (merchant of record, so it handles UK/EU VAT) behind a `BillingProvider`
  interface, so it can be swapped for Stripe later.
- Paddle webhooks write to `subscriptions`. Plan features come from a `plan_features`
  map checked on the server, never only in the UI.

## 14. Compliance features to build in

- Data residency setting and display (UK, London region).
- DPA download, privacy policy and terms pages.
- Full data export as JSON/CSV, and organisation deletion with a 30-day grace period.
- Audit log for logins, role changes, key changes, exports and rule changes.
- Source opt-out page for publishers.

## 15. Security & operations

- Auth: Supabase Auth or Clerk. SSO (Entra ID, Google) is limited to the MSSP plan.
- Postgres RLS on every tenant table, with tests proving one org cannot read another's data.
- Rate limiting, schema validation (zod/pydantic), CSP and secure headers, CSRF
  protection where relevant.
- BYOK keys encrypted with envelope encryption. Raw keys never go to the client or into logs.
- Dependabot, secret scanning, SAST in CI, Sentry, uptime checks, nightly backups with
  a tested restore, `SECURITY.md` with a disclosure contact.
- Runbooks in `docs/runbook.md` for ingestion failures, KEV/EPSS sync failures and billing webhook failures.

## 16. Testing & acceptance criteria

- Unit tests:
  - TQL parser and compiler, including SQL-injection attempts
  - risk score
  - dedup
  - IOC extraction, including defanged forms
  - ATT&CK quote validation
  - plan gating
- Integration tests: ingestion run against fixture feeds, Paddle webhooks, alert dispatch, RLS isolation.
- E2E (Playwright): onboarding → stack → first P1 auto-case → task completion → close;
  Explorer query → save as rule → alert test.
- **Done means:**
  - No fabricated values anywhere. When there is no data, the UI says so.
  - A full ingestion cycle over 1,000 sources finishes in under 10 minutes and its summary is persisted.
  - Every score has visible reasons, and every AI text has citations.
  - CI is green, and the docs are updated.

## 17. Phases & gates

| Phase | Timing (proposal) | Scope | Gate to pass |
|---|---|---|---|
| 0 · Foundation | Nov–Dec 2026 | Merge PR #3; single backend; `CRON_SECRET` fail-closed; rebrand to TacticLens; README truth; LICENSE `[ask]`; move docs; remove playbooks, own rule library, `/api/v1/alerts` | Name and data licensing cleared |
| 1 · MVP | Jan–Mar 2027 | 1,000 sources; auth, orgs, RLS; tech stack and relevance; risk score; Overview, Explorer (basic TQL); email alerts; triage | 5 design partners, ≥3 using it weekly for 4 weeks |
| 2 · Paid launch | Apr–Jun 2027 | Paddle billing and plans; AI summaries; Teams/Slack; cases; STIX/MISP/OpenCTI; pricing page; weekly brief | 10 paying orgs |
| 3 · Scale | Jul–Dec 2027 | ATT&CK coverage import/gaps; MSSP multi-tenant; RAG chat; public API; SSO; Cyber Essentials | 20 paying orgs, <3% monthly churn |

## 18. Working agreement

- Start every phase with a short plan: files to touch, migrations, risks and test plan.
  Wait for "go".
- Keep PRs small enough to review. Each PR description has three parts: *what
  changed*, *how to verify*, *follow-ups*.
- When the spec is ambiguous, choose the option that best protects the §2
  differentiators and the §3 rules, and state that choice in the PR.
- Never commit secrets. Update `.env.example` whenever you add configuration.

## 19. Kick-off

Read the whole repo, `FETCHING_ARCHITECTURE.md` and the PR history. Then reply with:

1. a gap analysis: what exists and what is missing against this spec
2. your Phase 0 plan
3. the questions you need answered, including every `[bracket]` in this file.
