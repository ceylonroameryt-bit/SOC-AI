# Cookie Notice & Local Storage Policy

**Last Updated:** [OPERATOR_INPUT_REQUIRED: Date, e.g., September 26, 2026]  
**Platform:** SOC-AI / NO ENTRY (https://soc-ai-six.vercel.app/)  
**Operator:** [OPERATOR_INPUT_REQUIRED: Legal Business Entity Name]  
**Contact:** [OPERATOR_INPUT_REQUIRED: Legal/Privacy Email, e.g., privacy@soc-ai.example.com]

---

## 1. What are Cookies and Local Storage?
Cookies are small text files stored on your device by your web browser when visiting a website. Local storage and session storage are modern web standards that allow client-side web applications to store preferences and temporary session data directly within your browser.

## 2. Technologies We Use
The SOC-AI application uses cookies and browser local storage strictly to ensure reliable operation, remember display preferences, and protect platform integrity.

### 2.1 Strictly Necessary Storage
These tokens and storage keys are essential for platform functionality and security. They cannot be switched off without impairing basic features:
- **`timezone_preference` (Local Storage):** Stores your selected local timezone (e.g., `UTC`, `America/New_York`, `Europe/London`) so that the Explore and Intelligence pages can accurately align article publication timestamps to your local midnight boundaries.
- **`auth_token` / `session_id` (Cookie / Session Storage):** Authenticates verified administrative or subscriber sessions and protects administrative refresh endpoints against Cross-Site Request Forgery (CSRF).
- **`theme_preference` (Local Storage):** Remembers dark/light interface appearance settings.

### 2.2 Performance and Diagnostic Telemetry
- **API Cache Headers (`ETag`, `Last-Modified`):** In-browser HTTP caching mechanisms utilized to prevent redundant network fetches of feed registries and telemetry snapshots, conserving bandwidth and device resources.
- **Aggregated Telemetry (Local Storage / In-Memory):** Temporarily stores feed count snapshots and pagination states during your active browsing session.

### 2.3 Third-Party Advertising & Cross-Site Tracking
- **We do NOT use third-party behavioral advertising cookies or cross-site retargeting pixels.**
- Ingested articles link directly to original publisher websites via standard anchor tags; visiting external publisher links may subject you to the cookie policies of those third-party sites.

## 3. Cookie Management & Consent Controls
When visiting the platform from jurisdictions requiring consent for non-essential cookies (such as the EU/UK under the ePrivacy Directive):
- Only strictly necessary local storage keys are initialized prior to user interaction.
- You can clear local storage and delete cookies at any time via your browser settings:
  - **Google Chrome:** Settings → Privacy and Security → Clear Browsing Data → Cookies and other site data.
  - **Mozilla Firefox:** Settings → Privacy & Security → Cookies and Site Data → Clear Data.
  - **Apple Safari:** Preferences → Privacy → Manage Website Data → Remove All.
  - **Microsoft Edge:** Settings → Cookies and Site Permissions → Manage and delete cookies.

## 4. Updates to this Notice
We may periodically update this Cookie Notice to reflect additions to platform functionality. Changes will be published here with an updated revision date.
