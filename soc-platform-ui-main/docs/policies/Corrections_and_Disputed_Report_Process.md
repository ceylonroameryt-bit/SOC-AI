# Corrections & Disputed Report Process

**Last Updated:** [OPERATOR_INPUT_REQUIRED: Date, e.g., September 26, 2026]  
**Platform:** SOC-AI / NO ENTRY (https://soc-ai-six.vercel.app/)  
**Operator:** [OPERATOR_INPUT_REQUIRED: Legal Business Entity Name]  
**Contact:** [OPERATOR_INPUT_REQUIRED: Editorial/Corrections Email, e.g., corrections@soc-ai.example.com]

---

## 1. Purpose & Scope
SOC-AI aggregates cybersecurity news and utilizes heuristic algorithms and generative AI to classify threat reports, extract entity metadata, and associate MITRE ATT&CK® techniques. Because automated systems may produce false associations or inherit errors from syndication feeds, we maintain this formal process for receiving, investigating, and resolving disputes and correction requests.

## 2. Types of Disputes Handled
We address three categories of corrections:

### 2.1 Algorithmic & Heuristic Mapping Errors
- Erroneous MITRE ATT&CK tactic or technique mapping (e.g., classifying a routine credential reset as T1078 Valid Accounts without evidence).
- Erroneous threat category assignment (e.g., misclassifying academic cryptography research as an active "Ransomware" attack).
- Incorrect severity scoring.

### 2.2 Entity & Attribution Misidentification
- Incorrect attribution of an incident or vulnerability to an innocent organization or vendor.
- Erroneous extraction of CVE identifiers or threat actor aliases.

### 2.3 Publisher Retractions & Source Corrections
- When an original publisher issues a correction, clarification, or full retraction of a syndicated report.

*Note: For disputes regarding the factual substance of an article authored by a third-party publisher, complainants should simultaneously notify the primary publisher, as our platform indexes external reports.*

## 3. How to Submit a Correction Request
Please email **[OPERATOR_INPUT_REQUIRED: corrections email address]** with the subject line `[CORRECTION REQUEST] Article Title / Identifier` and provide:

1. **Reporter Information:** Your name, organizational affiliation (e.g., affected vendor, security researcher, original author), and professional email.
2. **Identification of Report:** The exact title, article ID, or URL as displayed on SOC-AI.
3. **Nature of the Discrepancy:** A concise explanation of the error (e.g., why an automated MITRE tag or extracted CVE is erroneous).
4. **Supporting Evidence:** Authoritative documentation supporting the correction (e.g., vendor advisory, CVE record, publisher retraction link, official security disclosure).

## 4. Investigation & Interim Safeguards
Upon receiving a verified dispute:
1. **Acknowledgement:** An acknowledgement is sent to the reporter within 24–48 business hours.
2. **Interim Suppression (High Severity):** If a dispute involves severe factual misidentification (e.g., falsely asserting an active data breach at an organization), editorial staff will immediately apply an interim suppression flag (`status: 'disputed'`), temporarily hiding the record from search until the review concludes.
3. **Investigation:** Our intelligence team audits the raw XML feed, compares the extracted text against the original publisher URL, and inspects the MITRE mapping heuristics.

## 5. Resolution & Corrective Actions
Within 5 business days of review:
- **Heuristic Adjustment:** If the mapping or summary was an automated artifact, our engineers correct the database record, update heuristic confidence thresholds, and record the adjustment in the audit log.
- **Correction Annotation:** A prominent badge `[CORRECTION APPLIED]` or explanatory note is affixed to the report detailing the date and nature of the revision.
- **Publisher Retraction Alignment:** If the primary publisher retracted the article, our system purges the item from the active index and flags the canonical URL as retracted.
- **Outcome Notice:** A written explanation of the decision is sent to the complainant.

## 6. Feed-Level Suspension During Ongoing Disputes
If a specific syndicated source repeatedly publishes unverified or defamatory claims without prompt retractions, our platform administrators will pause scheduled ingestion for that feed (`reviewState: 'quarantined'`, `enabled: false`) pending formal publisher review.
