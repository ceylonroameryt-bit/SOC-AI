# Copyright Complaint & Takedown Removal Process

**Last Updated:** [OPERATOR_INPUT_REQUIRED: Date, e.g., September 26, 2026]  
**Platform:** SOC-AI / NO ENTRY (https://soc-ai-six.vercel.app/)  
**Designated Agent:** [OPERATOR_INPUT_REQUIRED: Designated DMCA/Copyright Agent Name or Legal Department]  
**Agent Address:** [OPERATOR_INPUT_REQUIRED: Physical Address for Legal Notices]  
**Agent Email:** [OPERATOR_INPUT_REQUIRED: Dedicated Copyright Email, e.g., dmca@soc-ai.example.com]

---

## 1. Overview
NO ENTRY / SOC-AI respects the intellectual property rights of content creators, authors, and news organizations. In accordance with the United States Digital Millennium Copyright Act (17 U.S.C. § 512), the European Union Digital Services Act (Regulation (EU) 2022/2065), and the UK Electronic Commerce (EC Directive) Regulations 2002, we maintain an expedited Notice-and-Takedown procedure for copyright holders.

## 2. Fast-Track Publisher Opt-Out
If you are a publisher whose RSS feed is currently indexed in our candidate or approved catalogue and you prefer that your feed be excluded from aggregation:
- **No Formal Legal Claim Required:** You do not need to file a formal DMCA claim to opt out. Simply email us at **[OPERATOR_INPUT_REQUIRED: dedicated email]** with your publication domain and feed URL.
- **Immediate Quarantine:** Upon receipt, your feed will be placed into the `quarantined` state within 24 hours, worker ingestion will immediately cease, and all indexed excerpts will be purged or suppressed from public search.

## 3. Formal Notice of Claimed Infringement
If you believe that content hosted or linked on SOC-AI infringes your copyright and you wish to file a formal legal takedown notice, please provide our Designated Copyright Agent with a written communication containing the following:

1. **Identification of Copyrighted Work:** A description of the copyrighted work that you claim has been infringed, or a representative list if multiple works are involved.
2. **Identification of Allegedly Infringing Material:** The specific URL, article title, or source identifier on our platform where the material is located, sufficient for our engineering team to locate and verify the record.
3. **Contact Information:** Your full legal name, mailing address, telephone number, and email address.
4. **Statement of Good Faith:** A statement that you have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law (including fair use).
5. **Statement of Accuracy:** A statement that the information in the notification is accurate, and under penalty of perjury, that you are the copyright owner or authorized to act on the owner's behalf.
6. **Signature:** A physical or electronic signature of the authorized copyright owner or agent.

## 4. Takedown & Response Procedure
Upon receipt of a valid notice:
1. **Verification & Logging:** The notice is date-stamped and logged in our audit registry within 4 business hours.
2. **Temporary Suppression:** Access to the reported content is promptly disabled or removed from public search across all endpoints.
3. **Worker Quarantine:** If the notice concerns feed syndication permissions, the feed is immediately disabled in `sources_registry.json` (`enabled: false`, `reviewState: 'quarantined'`) to prevent re-ingestion.
4. **Notice to Source Provider:** If applicable, we notify the relevant publisher or author regarding the action taken.

## 5. Counter-Notification Procedure
If content was removed due to mistake or misidentification, the affected content provider may submit a counter-notice containing:
1. Identification of the material that was removed and the location where it appeared before removal.
2. A statement under penalty of perjury that the subscriber has a good faith belief that the material was removed or disabled as a result of mistake or misidentification.
3. The subscriber's name, address, telephone number, and consent to jurisdiction of federal/local courts in the relevant venue.
4. A physical or electronic signature.

If a valid counter-notice is received, our Designated Agent will forward it to the original complaining party. Unless the copyright owner files a court action seeking an injunction within 10–14 business days, we may restore the removed material.

## 6. Repeat Infringer Policy
In compliance with 17 U.S.C. § 512(i), we terminate or permanently blacklist feed endpoints, sources, or user accounts associated with repeat or persistent copyright infringement.
