# Privacy Notice

**Last Updated:** [OPERATOR_INPUT_REQUIRED: Date, e.g., September 26, 2026]  
**Platform:** SOC-AI / NO ENTRY (https://soc-ai-six.vercel.app/)  
**Data Controller:** [OPERATOR_INPUT_REQUIRED: Legal Business Entity Name, e.g., NO ENTRY Cyber Intel Ltd.]  
**Controller Address:** [OPERATOR_INPUT_REQUIRED: Registered Address]  
**Data Protection Contact:** [OPERATOR_INPUT_REQUIRED: Privacy Contact or DPO Email, e.g., privacy@soc-ai.example.com]

---

## 1. Introduction
This Privacy Notice describes how NO ENTRY / SOC-AI ("we", "us", or "our") collects, uses, stores, and protects personal data when you interact with our cybersecurity intelligence platform. We adhere to the General Data Protection Regulation (EU GDPR), the UK GDPR, and the California Consumer Privacy Act as amended by the CPRA (CCPA/CPRA), where applicable.

## 2. Personal Data We Collect
We collect personal data in three primary contexts:

### 2.1 Technical and Usage Data
When you visit the platform, our hosting servers (e.g., Vercel, Supabase) automatically log standard network telemetry:
- Internet Protocol (IP) address.
- Browser user-agent string, operating system, and screen resolution.
- Request timestamps, referring URLs, and requested endpoints.
- Timezone preferences saved in local storage or browser cookies.

### 2.2 Search and Query Data
- Search terms, date range selections, and MITRE filter parameters entered into the Explore and Intelligence workspaces.
- Queries are logged in aggregated, pseudonymized form for system optimization, abuse prevention, and rate-limiting.

### 2.3 Third-Party Threat Intel & Breach Data Minimization
The platform aggregates cybersecurity news feeds from authenticated publishers. While these feeds discuss threat actors, cybersecurity researchers, and victim organizations:
- **Strict Data Minimization:** We index article titles, metadata, and brief descriptive summaries.
- **Prohibition on Leaked Credentials:** We strictly prohibit and actively filter raw password dumps, unredacted compromised credentials, financial account numbers, or personal identifying records of individual breach victims.
- **Researcher & Author Attribution:** We process names of security authors and analysts only as necessary to attribute original reporting.

## 3. Lawful Bases for Processing (EU / UK GDPR)
Where EU or UK data protection legislation applies, we rely on the following lawful bases:
- **Legitimate Interests (Art. 6(1)(f) GDPR):** Operating, securing, and optimizing a threat intelligence discovery service; defending against DDoS and automated scraping; providing cybersecurity awareness and news indexing.
- **Contractual Necessity (Art. 6(1)(b) GDPR):** Fulfilling user service requests and maintaining authenticated accounts (where commercial subscriptions are enabled).
- **Legal Obligation (Art. 6(1)(c) GDPR):** Complying with statutory notice-and-takedown demands, law enforcement subpoenas, and regulatory requirements.

## 4. How We Use Personal Data
We use collected data to:
- Deliver, maintain, and optimize user experience on the web application.
- Authenticate and manage administrative actions and API rate limits.
- Detect and prevent security threats, unauthorized scraping, and malicious behavior.
- Comply with applicable legal responsibilities and respond to copyright or privacy inquiries.

## 5. Third-Party Processors and International Transfers
We utilize trusted third-party service providers ("Sub-processors") to operate our infrastructure:
- **Cloud Infrastructure & CDN:** Vercel Inc. (Global edge hosting), Supabase Inc. (Database management).
- **AI Model Providers:** Google Cloud (Gemini API) and OpenAI Inc., utilized strictly for automated article classification and summarization under enterprise terms that disallow model training on customer payloads.
- **Security & DNS:** Cloudflare / edge proxies for DDoS defense.

Where personal data is transferred outside the European Economic Area (EEA) or the UK, we ensure adequate safeguards are in place, including Standard Contractual Clauses (SCCs) and International Data Transfer Agreements (IDTAs).

## 6. Data Retention
- **Server Access Logs:** Retained for up to 90 days for diagnostic and cybersecurity purposes, then purged or aggregated.
- **Aggregated News Archive:** Article headlines, metadata, and brief snippets are retained indefinitely as an informational index, subject to publisher removal requests or data subject erasure requests.
- **Disputed Content & Takedown Records:** Retained for the statutory limitation period to defend against legal claims.

## 7. Your Data Subject Rights
Depending on your jurisdiction, you may exercise the following rights regarding your personal data:
- **Access & Portability:** Request confirmation of processing and a copy of your personal data.
- **Rectification:** Request correction of inaccurate or incomplete personal data.
- **Erasure ("Right to be Forgotten"):** Request deletion of personal data where retention is no longer justified.
- **Restriction & Objection:** Object to processing based on legitimate interests or request restricted processing.
- **Opt-Out of Sale / Sharing (CCPA):** We do not sell or share personal information for cross-context behavioral advertising.

To exercise any right, submit your request to: **[OPERATOR_INPUT_REQUIRED: Privacy contact email]**. We respond within statutory timelines (30 days under GDPR; 45 days under CCPA).

## 8. Security Measures
We implement appropriate technical and organizational safeguards:
- Strict HTTPS/TLS encryption in transit across all endpoints.
- Server-side Server-Side Request Forgery (SSRF) filters preventing loopback, private IP, and cloud metadata inspection.
- Role-based access controls on administrative triggers and database credentials.
- Continuous dependency vulnerability scanning and secure coding standards.

## 9. Updates to this Notice
We may amend this Privacy Notice to reflect evolving regulatory requirements or platform capabilities. Material revisions will be posted with an updated effective date.

## 10. Supervisory Authority Complaints
If you reside in the EEA or UK, you have the right to lodge a complaint with your competent supervisory authority (e.g., the UK Information Commissioner's Office or your local European Data Protection Authority).
