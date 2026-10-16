import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def add_callout_box(doc, text, title=None, border_color="0284C7", fill_color="F0F9FF"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, fill_color)
    set_cell_margins(cell, top=140, bottom=140, left=220, right=200)
    
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="none"/>'
        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>'
        f'<w:bottom w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(tcBorders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    
    if title:
        r_title = p.add_run(f"{title}\n")
        r_title.bold = True
        r_title.font.name = "Calibri"
        r_title.font.size = Pt(11)
        r_title.font.color.rgb = RGBColor(2, 132, 199)
        
    r_body = p.add_run(text)
    r_body.font.name = "Calibri"
    r_body.font.size = Pt(10.5)
    r_body.font.color.rgb = RGBColor(30, 41, 59)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def style_heading(p, font_size, bold=True, color_rgb=(15, 23, 42), space_before=14, space_after=6):
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.keep_with_next = True
    for r in p.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(font_size)
        r.bold = bold
        r.font.color.rgb = RGBColor(*color_rgb)

def generate_business_doc():
    doc = Document()

    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # ── COVER / TITLE PAGE ───────────────────────────────────────────────────
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(36)
    title_p.paragraph_format.space_after = Pt(8)
    
    run_badge = title_p.add_run("BUSINESS CASE & EXECUTIVE PROPOSAL\n")
    run_badge.font.name = "Calibri"
    run_badge.font.size = Pt(11)
    run_badge.bold = True
    run_badge.font.color.rgb = RGBColor(2, 132, 199)

    run_title = title_p.add_run("SOC-AI  (NO ENTRY)")
    run_title.font.name = "Calibri"
    run_title.font.size = Pt(32)
    run_title.bold = True
    run_title.font.color.rgb = RGBColor(15, 23, 42)

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_before = Pt(4)
    sub_p.paragraph_format.space_after = Pt(18)
    run_sub = sub_p.add_run("Intelligent Early-Warning Radar for Enterprise Cyber Defense")
    run_sub.font.name = "Calibri"
    run_sub.font.size = Pt(16)
    run_sub.bold = True
    run_sub.font.color.rgb = RGBColor(71, 85, 105)

    desc_p = doc.add_paragraph()
    desc_p.paragraph_format.space_after = Pt(36)
    desc_p.paragraph_format.line_spacing = 1.2
    run_desc = desc_p.add_run(
        "A business-oriented proposal for leadership, department heads, and non-technical stakeholders. "
        "Explains how an automated 24/7 AI threat intelligence radar shields the company from costly cyber "
        "attacks, cuts information clutter by 80%, saves hundreds of staff hours, and delivers clear daily "
        "executive briefings in plain English."
    )
    run_desc.font.name = "Calibri"
    run_desc.font.size = Pt(11)
    run_desc.font.color.rgb = RGBColor(100, 116, 139)

    # Metadata Table
    meta_table = doc.add_table(rows=5, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        ("Audience:", "Senior Leadership, Business Executives, IT Managers, Operations Leads"),
        ("Target Date:", "October 2026"),
        ("Core Theme:", "Proactive Risk Reduction, Operational Cost Savings & Business Continuity"),
        ("Technical Complexity:", "Non-Technical / Executive Friendly (Plain Language)"),
        ("Status:", "Ready for Management Review & Pilot Sign-off")
    ]
    for i, (k, v) in enumerate(meta_data):
        row = meta_table.rows[i]
        c1, c2 = row.cells[0], row.cells[1]
        c1.width = Inches(2.2)
        c2.width = Inches(4.3)
        set_cell_background(c1, "F8FAFC")
        set_cell_background(c2, "FFFFFF")
        set_cell_margins(c1, 80, 80, 100, 100)
        set_cell_margins(c2, 80, 80, 100, 100)
        
        p1 = c1.paragraphs[0]
        r1 = p1.add_run(k)
        r1.bold = True
        r1.font.name = "Calibri"
        r1.font.size = Pt(10)
        r1.font.color.rgb = RGBColor(51, 65, 85)
        
        p2 = c2.paragraphs[0]
        r2 = p2.add_run(v)
        r2.font.name = "Calibri"
        r2.font.size = Pt(10)
        r2.font.color.rgb = RGBColor(15, 23, 42)

    doc.add_page_break()

    # ── SECTION 1: EXECUTIVE SUMMARY IN PLAIN ENGLISH ────────────────────────
    h1 = doc.add_paragraph("1. Executive Summary: What is SOC-AI?")
    style_heading(h1, 20, color_rgb=(15, 23, 42), space_before=12, space_after=8)

    p_ex1 = doc.add_paragraph(
        "Imagine having a dedicated security radar that operates 24 hours a day, 7 days a week, continuously "
        "monitoring over 500 global cybersecurity warning stations, government advisories, and technology blogs. "
        "Instead of waiting for an attacker to break into our company's network, this radar alerts us days or weeks "
        "beforehand, telling our defenders exactly which digital doors need locking."
    )
    p_ex1.paragraph_format.line_spacing = 1.15
    p_ex1.paragraph_format.space_after = Pt(6)

    p_ex2 = doc.add_paragraph(
        "That is what SOC-AI ('NO ENTRY') does. It acts as an automated 24/7 digital guard dog for our organization. "
        "Today, thousands of cyber alerts are published globally every week. Most security teams drown in this flood of "
        "data, spending precious hours reading technical websites rather than protecting systems. SOC-AI uses artificial "
        "intelligence to read all of that information automatically, throw away 80% of the repetitive junk, and present "
        "leadership with clear, 2-minute daily summaries and step-by-step action plans."
    )
    p_ex2.paragraph_format.line_spacing = 1.15
    p_ex2.paragraph_format.space_after = Pt(6)

    add_callout_box(
        doc,
        "Bottom Line: SOC-AI transforms cybersecurity defense from a reactive, chaotic scramble after an incident "
        "into a calm, proactive system that stops cyber attacks before they can disrupt business operations.",
        title="WHAT THIS MEANS FOR OUR BUSINESS"
    )

    # ── SECTION 2: THE BUSINESS PROBLEM ──────────────────────────────────────
    h2 = doc.add_paragraph("2. The Business Problem: Information Overload & Costly Blind Spots")
    style_heading(h2, 20, color_rgb=(15, 23, 42), space_before=18, space_after=8)

    p_prob = doc.add_paragraph(
        "Why do companies still get hit by ransomware and data breaches when warnings were publicly available? "
        "The problem isn't a lack of information—it's having too much information in the wrong format:"
    )
    p_prob.paragraph_format.line_spacing = 1.15
    p_prob.paragraph_format.space_after = Pt(8)

    prob_cards = [
        ("The 'Digital Haystack' Problem", 
         "Every day, 500+ security advisories, vulnerability bulletins, and news articles are posted across the internet. "
         "Expecting human analysts to visit 50+ websites daily is like asking someone to read 500 urgent emails every morning "
         "before they can even start their real job."),
        
        ("80% Repetitive Noise & Clutter", 
         "Most security websites simply copy and repost each other's articles. Approximately 80% of what is published is "
         "repackaged news, promotional press releases, or identical reports. Analysts waste hours re-reading the same story."),
        
        ("Technical Jargon vs. Business Reality", 
         "Threat reports are written in dense, obscure engineering jargon. Decision-makers need to know two simple things: "
         "'Are we affected?' and 'What do we need to do right now?' Translating raw reports into action takes too long."),
        
        ("The Financial Reality of a Breach", 
         "According to IBM's global security research, the average cost of an enterprise data breach is $4.45 million, accompanied "
         "by an average of 21 days of business downtime. Missing a single critical security warning can shut down billing, "
         "sales, and operations for weeks.")
    ]

    for title, desc in prob_cards:
        p_c = doc.add_paragraph()
        p_c.paragraph_format.space_before = Pt(4)
        p_c.paragraph_format.space_after = Pt(4)
        p_c.paragraph_format.line_spacing = 1.15
        
        r_t = p_c.add_run(f"• {title}: ")
        r_t.bold = True
        r_t.font.name = "Calibri"
        r_t.font.size = Pt(11)
        r_t.font.color.rgb = RGBColor(185, 28, 28)
        
        r_d = p_c.add_run(desc)
        r_d.font.name = "Calibri"
        r_d.font.size = Pt(10.5)
        r_d.font.color.rgb = RGBColor(51, 65, 85)

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # ── SECTION 3: HOW SOC-AI WORKS ──────────────────────────────────────────
    h3 = doc.add_paragraph("3. How SOC-AI Works: 3 Simple Steps")
    style_heading(h3, 20, color_rgb=(15, 23, 42), space_before=16, space_after=8)

    p_how = doc.add_paragraph(
        "SOC-AI handles the entire intelligence workload through three intuitive stages that operate continuously in the background:"
    )
    p_how.paragraph_format.line_spacing = 1.15
    p_how.paragraph_format.space_after = Pt(8)

    table_how = doc.add_table(rows=4, cols=3)
    table_how.alignment = WD_TABLE_ALIGNMENT.CENTER
    h_titles = ["Step", "What the System Does", "The Business Benefit"]
    for j, val in enumerate(h_titles):
        cell = table_how.cell(0, j)
        set_cell_background(cell, "0F172A")
        set_cell_margins(cell, 100, 100, 120, 120)
        p = cell.paragraphs[0]
        r = p.add_run(val)
        r.bold = True
        r.font.name = "Calibri"
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(255, 255, 255)

    steps_data = [
        ("Step 1: Listen & Collect", 
         "Continuously scans 500+ trusted global cyber defense channels every 15 minutes.", 
         "Zero blind spots. We never miss an emerging vulnerability or zero-day warning."),
        
        ("Step 2: Clean & Filter", 
         "Throws away duplicate articles, eliminates marketing noise, and groups similar stories together.", 
         "Cuts out 80% of clutter so staff only review unique, high-importance items."),
        
        ("Step 3: Alert & Guide", 
         "Delivers clear 2-minute executive briefs to management and 1-click action plans to IT staff.", 
         "Instant decision-making. No delays or guesswork during critical security moments.")
    ]

    for i, row_data in enumerate(steps_data):
        row = table_how.rows[i + 1]
        bg = "F8FAFC" if i % 2 == 0 else "FFFFFF"
        for j, val in enumerate(row_data):
            cell = row.cells[j]
            set_cell_background(cell, bg)
            set_cell_margins(cell, 90, 90, 110, 110)
            p = cell.paragraphs[0]
            r = p.add_run(val)
            r.font.name = "Calibri"
            r.font.size = Pt(9.5)
            if j == 0:
                r.bold = True
                r.font.color.rgb = RGBColor(2, 132, 199)
            elif j == 2:
                r.bold = True
                r.font.color.rgb = RGBColor(5, 150, 105)
            else:
                r.font.color.rgb = RGBColor(51, 65, 85)

    doc.add_page_break()

    # ── SECTION 4: KEY FEATURES THAT MATTER TO MANAGEMENT ────────────────────
    h4 = doc.add_paragraph("4. Key Capabilities That Deliver Business Value")
    style_heading(h4, 20, color_rgb=(15, 23, 42), space_before=12, space_after=8)

    capabilities = [
        ("4.1. 2-Minute Executive Situation Reports", 
         "Rather than having to digest technical research papers, leadership receives automated daily intelligence summaries. "
         "These briefs explain which major cyber gangs are active, what software vulnerabilities are being attacked right now, "
         "and the top 3 actions our technical team should execute today. This allows the CEO, CISO, and Board to stay fully informed "
         "without getting bogged down in acronyms."),

        ("4.2. 1-Click Action Playbooks for IT Staff", 
         "When an alert is flagged as critical, SOC-AI does not just say 'warning.' It produces a 4-step checklist: "
         "(1) Check if our computers are affected, (2) Block the malicious addresses at the firewall, (3) Clean and patch any vulnerable "
         "systems, and (4) Verify normal business operations. It turns complex security engineering into clear, standardized checklists."),

        ("4.3. Color-Coded Visual Threat Heatmap", 
         "Like a weather radar tracking a hurricane, SOC-AI provides a color-coded visual heatmap showing where attacks are concentrating "
         "globally. Red indicators signify heavy adversary activity; green indicates low risk. Management can glance at the screen and "
         "immediately grasp our security posture."),

        ("4.4. Proactive Vulnerability Alerting", 
         "The platform connects directly to official government zero-day databases (such as CISA's Known Exploited Vulnerabilities catalog). "
         "The moment a piece of commercial software (e.g. Windows, VPNs, cloud systems) is being weaponized by attackers, our team is "
         "notified immediately to apply the patch before attackers scan our network."),

        ("4.5. Safe & Isolated Operation", 
         "The platform is engineered with strict digital safety boundaries. It only listens to public alerts and strictly prevents external "
         "feeds from reaching or scanning our private company network. It is entirely self-contained, low-risk, and requires no risky changes "
         "to our internal core systems.")
    ]

    for c_title, c_desc in capabilities:
        h_c = doc.add_paragraph(c_title)
        style_heading(h_c, 13, bold=True, color_rgb=(2, 132, 199), space_before=10, space_after=4)
        p_c = doc.add_paragraph(c_desc)
        p_c.paragraph_format.line_spacing = 1.15
        p_c.paragraph_format.space_after = Pt(6)

    # ── SECTION 5: FINANCIAL JUSTIFICATION & ROI ─────────────────────────────
    h5 = doc.add_paragraph("5. Measurable Financial Return on Investment (ROI)")
    style_heading(h5, 20, color_rgb=(15, 23, 42), space_before=16, space_after=8)

    p_roi = doc.add_paragraph(
        "Implementing SOC-AI delivers quantifiable time savings, operational efficiencies, and risk reduction across the organization:"
    )
    p_roi.paragraph_format.line_spacing = 1.15
    p_roi.paragraph_format.space_after = Pt(8)

    table_roi = doc.add_table(rows=5, cols=3)
    table_roi.alignment = WD_TABLE_ALIGNMENT.CENTER
    roi_headers = ["Impact Area", "How Value is Generated", "Quantifiable Business Result"]
    for j, val in enumerate(roi_headers):
        cell = table_roi.cell(0, j)
        set_cell_background(cell, "0F172A")
        set_cell_margins(cell, 100, 100, 120, 120)
        p = cell.paragraphs[0]
        r = p.add_run(val)
        r.bold = True
        r.font.name = "Calibri"
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(255, 255, 255)

    roi_data = [
        ("70% Staff Time Saved", 
         "Automating the collection and filtering of 500+ feeds frees analysts from hours of manual website reading.", 
         "Saves 15+ hours per analyst each week, redirected into hardening defenses."),
        
        ("Breach Risk Reduction", 
         "Early detection of zero-days allows IT to patch vulnerable software days before attackers can exploit it.", 
         "Avoids potential ransomware and downtime losses averaging $4.45M per incident."),
        
        ("Lower Cyber Insurance Costs", 
         "Insurance underwriters demand proof of continuous threat intelligence and rapid vulnerability mitigation.", 
         "Helps qualify for better coverage terms and lower annual cyber insurance premiums."),
        
        ("Multiplies Team Capacity", 
         "Enables our existing IT and security staff to handle the workload of a team twice their size.", 
         "Eliminates the urgent need to hire expensive outside contractors or expand headcount.")
    ]

    for i, row_data in enumerate(roi_data):
        row = table_roi.rows[i + 1]
        bg = "F8FAFC" if i % 2 == 0 else "FFFFFF"
        for j, val in enumerate(row_data):
            cell = row.cells[j]
            set_cell_background(cell, bg)
            set_cell_margins(cell, 90, 90, 110, 110)
            p = cell.paragraphs[0]
            r = p.add_run(val)
            r.font.name = "Calibri"
            r.font.size = Pt(9.5)
            if j == 0:
                r.bold = True
                r.font.color.rgb = RGBColor(15, 23, 42)
            elif j == 2:
                r.bold = True
                r.font.color.rgb = RGBColor(5, 150, 105)
            else:
                r.font.color.rgb = RGBColor(51, 65, 85)

    doc.add_page_break()

    # ── SECTION 6: IMPLEMENTATION PLAN ───────────────────────────────────────
    h6 = doc.add_paragraph("6. Low-Risk Phased Rollout Plan")
    style_heading(h6, 20, color_rgb=(15, 23, 42), space_before=12, space_after=8)

    p_plan = doc.add_paragraph(
        "To ensure zero disruption to current operations, SOC-AI follows a smooth, low-risk four-stage implementation:"
    )
    p_plan.paragraph_format.line_spacing = 1.15
    p_plan.paragraph_format.space_after = Pt(6)

    rollout_stages = [
        ("Phase 1: Build & Quality Verification (Completed)", 
         "The core system architecture has been built, hardened, and verified with 50 automated tests passing at 100%."),
        
        ("Phase 2: Operational Pilot Testing (Current Stage)", 
         "Running live across 500+ feeds in an isolated pilot environment. Our internal team is reviewing the dashboard, "
         "evaluating daily briefings, and fine-tuning alerts without touching production systems."),
        
        ("Phase 3: Automated Notifications (Next 30 Days)", 
         "Connecting threat alerts directly into company communication channels (Slack, Microsoft Teams, or email) so "
         "urgent notices reach the right person within minutes."),
        
        ("Phase 4: Direct Automated Protection (Next 60 Days)", 
         "Connecting the verified threat feeds directly into company firewalls and endpoint security tools, enabling "
         "automated blocking of known malicious internet addresses without human intervention.")
    ]

    for title, desc in rollout_stages:
        p_s = doc.add_paragraph()
        p_s.paragraph_format.space_before = Pt(4)
        p_s.paragraph_format.space_after = Pt(4)
        p_s.paragraph_format.line_spacing = 1.15
        
        r_t = p_s.add_run(f"✔  {title}: ")
        r_t.bold = True
        r_t.font.name = "Calibri"
        r_t.font.size = Pt(10.5)
        r_t.font.color.rgb = RGBColor(5, 150, 105)
        
        r_d = p_s.add_run(desc)
        r_d.font.name = "Calibri"
        r_d.font.size = Pt(10)
        r_d.font.color.rgb = RGBColor(51, 65, 85)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # ── SECTION 7: CONCLUSION & RECOMMENDATION ────────────────────────────────
    h7 = doc.add_paragraph("7. Conclusion & Executive Recommendation")
    style_heading(h7, 20, color_rgb=(15, 23, 42), space_before=16, space_after=8)

    p_final = doc.add_paragraph(
        "Cyber threats will continue to grow in volume and velocity. Relying on manual web browsing and fragmented bookmarks "
        "leaves our enterprise exposed to preventable risks and costly downtime. SOC-AI provides an intelligent, reliable, and "
        "automated early-warning radar that shields our business, saves hundreds of analyst hours, and keeps leadership fully informed."
    )
    p_final.paragraph_format.line_spacing = 1.2
    p_final.paragraph_format.space_after = Pt(12)

    add_callout_box(
        doc,
        "Recommendation for Decision Makers: Authorize the continuation of Phase 2 pilot testing and operational review. "
        "The platform is already tested, fully functional, and ready to deliver immediate risk protection to the business.",
        title="EXECUTIVE ACTION REQUEST",
        border_color="059669",
        fill_color="F0FDF4"
    )

    output_path = "SOC_AI_Business_Proposal.docx"
    doc.save(output_path)
    print(f"Executive Business Proposal saved to: {output_path}")

if __name__ == "__main__":
    generate_business_doc()
