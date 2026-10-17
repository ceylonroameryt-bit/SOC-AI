# TacticLens Risk Scoring Methodology

> **Reference:** `CLAUDE.md` §8  
> **Source Engine:** `soc-platform-ui-main/server/services/riskScore.js`

TacticLens uses a deterministic 0–100 risk score for every threat cluster evaluated against an organization's profile.

---

## The Formula

$$\text{base} = 35 \times \left(\frac{\text{CVSS}}{10}\right) + 25 \times \text{KEV} + 15 \times \text{EPSS} + 15 \times \text{stack\_match} + 10 \times \text{internet\_facing}$$

$$\text{bonus} = \min(5, \log_2(\text{article\_count}))$$

$$\text{risk} = \text{clamp}(\text{round}(\text{base} + \text{bonus}), 0, 100)$$

---

## Component Breakdown

| Factor | Weight | Source | Description |
|---|---|---|---|
| **CVSS v3.1** | Max 35 | National Vulnerability Database (NVD) | Scaled linearly: $35 \times (\text{CVSS}/10)$. 0 if no CVE is associated. |
| **CISA KEV** | 25 | CISA Known Exploited Vulnerabilities Catalog | 25 points if any CVE in the cluster is catalogued as actively exploited in the wild; 0 otherwise. |
| **FIRST EPSS** | Max 15 | FIRST Exploit Prediction Scoring System | Probability of exploitation in next 30 days ($0.0 \dots 1.0$), scaled by 15. |
| **Tech Stack Match** | Max 15 | Customer Organization `tech_stack` | **15 pts** (1.0) if product matches org's registered stack; **7.5 pts** (0.5) if matching sector only; **0 pts** if unrelated. |
| **Internet-Facing** | 10 | Customer Asset Exposure Flag | 10 points if the matched technology is marked `internet_facing: true` on the customer perimeter. |
| **Cluster Volume** | Max 5 | Ingestion cluster deduplication | $\min(5, \log_2(\text{article\_count}))$. Dampens reporting noise while capturing widespread campaigns. |

---

## Auto-Case Rule (P1 Incident)

A **P1 Incident Case** is automatically raised when:
$$\text{KEV} = 1 \quad \text{AND} \quad \text{stack\_match} = 1.0 \quad \text{AND} \quad \text{internet\_facing} = 1$$

When this condition is satisfied, the platform alerts immediately via high-priority channels and triggers SLA tracking.

---

## Non-Negotiable Ground Rules

1. **AI Never Sets Risk Scores or Severity**: AI may summarise threat text and assist with ATT&CK quotes, but severity bands and numerical scores are strictly computed via deterministic code.
2. **Missing Data Handling**: If CVSS, KEV, or EPSS data is missing or synchronizing, the platform shows `—` or `stale` with timestamps. It never fabricates fallback scores.
3. **Transparent "Why?" Reasons**: Every score returns its full component calculation in the API (`reasons` JSON) and displays a clear popover in the UI.
