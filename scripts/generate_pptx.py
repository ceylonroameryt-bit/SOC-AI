import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_non_tech_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Executive Theme Colors (Clean, Modern, Non-Intimidating)
    BG_DARK = RGBColor(15, 23, 42)        # Slate 900 #0F172A
    CARD_BG = RGBColor(30, 41, 59)        # Slate 800 #1E293B
    CARD_BORDER = RGBColor(51, 65, 85)    # Slate 700 #334155
    CYAN_ACCENT = RGBColor(56, 189, 248)  # Sky Blue #38BDF8
    GREEN_ACCENT = RGBColor(52, 211, 153) # Emerald #34D399
    AMBER_ACCENT = RGBColor(251, 191, 36) # Amber #FBBF24
    RED_ACCENT = RGBColor(248, 113, 113)  # Coral Red #F87171
    TEXT_WHITE = RGBColor(248, 250, 252)  # Crisp White #F8FAFC
    TEXT_MUTED = RGBColor(203, 213, 225)  # Light Slate #CBD5E1

    blank_layout = prs.slide_layouts[6]

    def add_bg(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_DARK
        bg.line.fill.background()
        return bg

    def add_header(slide, title_text, category="BUSINESS & STRATEGY BRIEFING"):
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.45), Inches(11.7), Inches(0.35))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category.upper()
        p_cat.font.size = Pt(11)
        p_cat.font.bold = True
        p_cat.font.color.rgb = CYAN_ACCENT

        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.78), Inches(11.7), Inches(0.65))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        p_title = tf_title.paragraphs[0]
        p_title.text = title_text
        p_title.font.size = Pt(24)
        p_title.font.bold = True
        p_title.font.color.rgb = TEXT_WHITE

    # -------------------------------------------------------------
    # SLIDE 1: Title Slide (Clear, Business-Focused)
    # -------------------------------------------------------------
    s1 = prs.slides.add_slide(blank_layout)
    add_bg(s1)

    line = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.8), Inches(0.9), Inches(0.08))
    line.fill.solid()
    line.fill.fore_color.rgb = CYAN_ACCENT
    line.line.fill.background()

    t_box = s1.shapes.add_textbox(Inches(0.8), Inches(2.1), Inches(11.5), Inches(2.8))
    tf1 = t_box.text_frame
    tf1.word_wrap = True

    p1 = tf1.paragraphs[0]
    p1.text = "SOC-AI  (NO ENTRY)"
    p1.font.size = Pt(44)
    p1.font.bold = True
    p1.font.color.rgb = TEXT_WHITE

    p2 = tf1.add_paragraph()
    p2.text = "Intelligent Early-Warning Radar for Enterprise Cyber Defense"
    p2.font.size = Pt(22)
    p2.font.color.rgb = CYAN_ACCENT
    p2.space_before = Pt(10)

    p3 = tf1.add_paragraph()
    p3.text = "Transforming overwhelming global cyber alerts into clear, automated business protection."
    p3.font.size = Pt(15)
    p3.font.color.rgb = TEXT_MUTED
    p3.space_before = Pt(14)

    badge_box = s1.shapes.add_textbox(Inches(0.8), Inches(5.6), Inches(11.5), Inches(1.0))
    tf_b = badge_box.text_frame
    p_b = tf_b.paragraphs[0]
    p_b.text = "EXECUTIVE PROPOSAL & PLATFORM OVERVIEW  |  NON-TECHNICAL & MANAGEMENT GUIDE"
    p_b.font.size = Pt(11)
    p_b.font.bold = True
    p_b.font.color.rgb = GREEN_ACCENT

    # -------------------------------------------------------------
    # SLIDE 2: The Real-World Problem (Everyday Analogy)
    # -------------------------------------------------------------
    s2 = prs.slides.add_slide(blank_layout)
    add_bg(s2)
    add_header(s2, "The Everyday Challenge: Finding a Needle in a Digital Haystack", "THE BUSINESS PROBLEM")

    cards_s2 = [
        ("Too Much Information", "Over 500 security advisories and cyber news reports publish daily. It's like receiving 500 urgent emails every morning.", RED_ACCENT),
        ("80% Repetitive Noise", "Most websites simply copy each other's articles. Security teams waste hours re-reading the exact same story from different blogs.", AMBER_ACCENT),
        ("Slow Human Reaction", "Reading, translating, and understanding a single technical report takes 30 to 60 minutes. Cyber attacks happen in seconds.", RED_ACCENT),
        ("Critical Warnings Get Missed", "When humans are exhausted by hundreds of alerts, the real danger slips through unnoticed until systems get locked.", RED_ACCENT)
    ]

    for i, (title, desc, color) in enumerate(cards_s2):
        x = Inches(0.8 + (i % 2) * 5.9)
        y = Inches(1.8 + (i // 2) * 2.5)
        card = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(5.6), Inches(2.2))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = CARD_BORDER

        tb = s2.shapes.add_textbox(x + Inches(0.3), y + Inches(0.25), Inches(5.0), Inches(1.7))
        tf = tb.text_frame
        tf.word_wrap = True
        pt = tf.paragraphs[0]
        pt.text = f"[!] {title}"
        pt.font.size = Pt(17)
        pt.font.bold = True
        pt.font.color.rgb = color

        pd = tf.add_paragraph()
        pd.text = desc
        pd.font.size = Pt(13)
        pd.font.color.rgb = TEXT_MUTED
        pd.space_before = Pt(8)

    # -------------------------------------------------------------
    # SLIDE 3: The Business Cost of Doing Nothing
    # -------------------------------------------------------------
    s3 = prs.slides.add_slide(blank_layout)
    add_bg(s3)
    add_header(s3, "What Happens When Critical Warnings Are Missed?", "BUSINESS IMPACT")

    risks = [
        ("$4.45 Million", "Average cost of an enterprise data breach including recovery, lawsuits, and regulatory penalties."),
        ("21+ Days Downtime", "Average operational shutdown when ransomware strikes, paralyzing sales, billing, and customer service."),
        ("Loss of Customer Trust", "A publicly disclosed breach damages brand reputation and client confidence overnight."),
        ("Wasted Payroll Hours", "High-paid security experts spend 30% of their day manually reading blogs instead of protecting the company.")
    ]

    for i, (metric, desc) in enumerate(risks):
        x = Inches(0.8 + (i % 2) * 5.9)
        y = Inches(1.8 + (i // 2) * 2.5)
        card = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(5.6), Inches(2.2))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = CARD_BORDER

        tb = s3.shapes.add_textbox(x + Inches(0.3), y + Inches(0.25), Inches(5.0), Inches(1.7))
        tf = tb.text_frame
        tf.word_wrap = True
        pt = tf.paragraphs[0]
        pt.text = metric
        pt.font.size = Pt(22)
        pt.font.bold = True
        pt.font.color.rgb = RED_ACCENT

        pd = tf.add_paragraph()
        pd.text = desc
        pd.font.size = Pt(13)
        pd.font.color.rgb = TEXT_MUTED
        pd.space_before = Pt(8)

    # -------------------------------------------------------------
    # SLIDE 4: The Solution: What is SOC-AI?
    # -------------------------------------------------------------
    s4 = prs.slides.add_slide(blank_layout)
    add_bg(s4)
    add_header(s4, "The Solution: Meet SOC-AI (Your 24/7 Digital Guard Dog)", "WHAT IS SOC-AI?")

    c_box = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(11.7), Inches(5.0))
    c_box.fill.solid()
    c_box.fill.fore_color.rgb = CARD_BG
    c_box.line.color.rgb = CYAN_ACCENT

    tb_c = s4.shapes.add_textbox(Inches(1.2), Inches(2.1), Inches(10.9), Inches(4.4))
    tf_c = tb_c.text_frame
    tf_c.word_wrap = True

    p_c1 = tf_c.paragraphs[0]
    p_c1.text = "Think of SOC-AI as an intelligent 24/7 security assistant."
    p_c1.font.size = Pt(20)
    p_c1.font.bold = True
    p_c1.font.color.rgb = CYAN_ACCENT

    p_c2 = tf_c.add_paragraph()
    p_c2.text = (
        "Instead of humans spending hours scanning websites, SOC-AI reads hundreds of global cybersecurity "
        "sources around the clock, instantly filters out the junk, highlights the dangerous threats, and explains "
        "in plain language what our team must do right now to keep the business safe."
    )
    p_c2.font.size = Pt(14)
    p_c2.font.color.rgb = TEXT_WHITE
    p_c2.space_before = Pt(10)

    bullets = [
        "Watches 500+ global security channels automatically every 15 minutes.",
        "Throws away 80% duplicate and promotional clutter so teams only see real threats.",
        "Translates complex cyber jargon into clear executive summaries and action checklists.",
        "Tells defenders exactly which lock to turn before attackers can break in."
    ]
    for b in bullets:
        p = tf_c.add_paragraph()
        p.text = f"✔  {b}"
        p.font.size = Pt(13.5)
        p.font.color.rgb = GREEN_ACCENT
        p.space_before = Pt(8)

    # -------------------------------------------------------------
    # SLIDE 5: How It Works in 3 Simple Steps
    # -------------------------------------------------------------
    s5 = prs.slides.add_slide(blank_layout)
    add_bg(s5)
    add_header(s5, "How It Works: 3 Simple Steps from Noise to Protection", "HOW IT WORKS")

    steps = [
        ("Step 1: Listen & Collect", "24/7 Automated Radar", "Scans 500+ trusted government, vendor, and research feeds continuously. Never sleeps, never gets tired.", CYAN_ACCENT),
        ("Step 2: Clean & Analyze", "The Smart Filter", "Throws away copycat articles, removes marketing junk, and pinpoints exactly which software is in danger.", AMBER_ACCENT),
        ("Step 3: Alert & Guide", "Instant Action Plan", "Delivers a 1-page executive summary to leadership and step-by-step instructions to the IT team.", GREEN_ACCENT)
    ]

    for i, (title, sub, desc, color) in enumerate(steps):
        x = Inches(0.8 + i * 4.0)
        card = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(1.8), Inches(3.7), Inches(5.0))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = CARD_BORDER

        tb = s5.shapes.add_textbox(x + Inches(0.25), Inches(2.1), Inches(3.2), Inches(4.4))
        tf = tb.text_frame
        tf.word_wrap = True

        pt = tf.paragraphs[0]
        pt.text = title
        pt.font.size = Pt(18)
        pt.font.bold = True
        pt.font.color.rgb = color

        ps = tf.add_paragraph()
        ps.text = sub
        ps.font.size = Pt(13)
        ps.font.bold = True
        ps.font.color.rgb = TEXT_WHITE
        ps.space_before = Pt(6)

        pd = tf.add_paragraph()
        pd.text = desc
        pd.font.size = Pt(12)
        pd.font.color.rgb = TEXT_MUTED
        pd.space_before = Pt(14)

    # -------------------------------------------------------------
    # SLIDE 6: The AI "Smart Filter" (Eliminating Noise)
    # -------------------------------------------------------------
    s6 = prs.slides.add_slide(blank_layout)
    add_bg(s6)
    add_header(s6, "The Smart Filter: Cutting Through 80% of the Noise", "NOISE ELIMINATION")

    left_box = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(5.6), Inches(5.0))
    left_box.fill.solid()
    left_box.fill.fore_color.rgb = CARD_BG
    left_box.line.color.rgb = CARD_BORDER

    tb_l = s6.shapes.add_textbox(Inches(1.1), Inches(2.1), Inches(5.0), Inches(4.4))
    tf_l = tb_l.text_frame
    tf_l.word_wrap = True
    pl_t = tf_l.paragraphs[0]
    pl_t.text = "Without SOC-AI (The Old Way)"
    pl_t.font.size = Pt(18)
    pl_t.font.bold = True
    pl_t.font.color.rgb = RED_ACCENT

    old_points = [
        "1,000+ unfiltered articles per week across 50 bookmarks.",
        "The same headline repeated 15 times by different blogs.",
        "Important zero-day alerts buried under promotional press releases.",
        "Security team exhausted by alert fatigue and missing real threats."
    ]
    for p_text in old_points:
        p = tf_l.add_paragraph()
        p.text = f"❌  {p_text}"
        p.font.size = Pt(12.5)
        p.font.color.rgb = TEXT_MUTED
        p.space_before = Pt(10)

    right_box = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.9), Inches(1.8), Inches(5.6), Inches(5.0))
    right_box.fill.solid()
    right_box.fill.fore_color.rgb = CARD_BG
    right_box.line.color.rgb = CARD_BORDER

    tb_r = s6.shapes.add_textbox(Inches(7.2), Inches(2.1), Inches(5.0), Inches(4.4))
    tf_r = tb_r.text_frame
    tf_r.word_wrap = True
    pr_t = tf_r.paragraphs[0]
    pr_t.text = "With SOC-AI (The Smart Way)"
    pr_t.font.size = Pt(18)
    pr_t.font.bold = True
    pr_t.font.color.rgb = GREEN_ACCENT

    new_points = [
        "Only unique, validated stories reach the dashboard.",
        "Repetitive stories are automatically combined into single summaries.",
        "Noise is cut by 80%—allowing analysts to focus only on critical risks.",
        "Defenders immediately know if our software is vulnerable."
    ]
    for p_text in new_points:
        p = tf_r.add_paragraph()
        p.text = f"✔  {p_text}"
        p.font.size = Pt(12.5)
        p.font.color.rgb = TEXT_MUTED
        p.space_before = Pt(10)

    # -------------------------------------------------------------
    # SLIDE 7: Executive Intelligence in 2 Minutes
    # -------------------------------------------------------------
    s7 = prs.slides.add_slide(blank_layout)
    add_bg(s7)
    add_header(s7, "Executive Intelligence: 2-Minute Daily Briefings", "EXECUTIVE VALUE")

    exec_cards = [
        ("No Technical Jargon", "Clear, high-level summaries written in business English so leadership can make fast, informed decisions.", CYAN_ACCENT),
        ("Active Threats Highlighted", "Know instantly if criminal syndicates or ransomware groups are targeting our industry or partners.", GREEN_ACCENT),
        ("Immediate Action List", "A simple 1-2-3 checklist telling IT managers exactly what patches or firewall rules are needed today.", AMBER_ACCENT),
        ("Board-Ready Reporting", "Downloadable summaries ready to share with CEOs, board members, auditors, or cyber insurance providers.", CYAN_ACCENT)
    ]

    for i, (title, desc, color) in enumerate(exec_cards):
        x = Inches(0.8 + (i % 2) * 5.9)
        y = Inches(1.8 + (i // 2) * 2.5)
        card = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(5.6), Inches(2.2))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = CARD_BORDER

        tb = s7.shapes.add_textbox(x + Inches(0.3), y + Inches(0.25), Inches(5.0), Inches(1.7))
        tf = tb.text_frame
        tf.word_wrap = True
        pt = tf.paragraphs[0]
        pt.text = title
        pt.font.size = Pt(16)
        pt.font.bold = True
        pt.font.color.rgb = color

        pd = tf.add_paragraph()
        pd.text = desc
        pd.font.size = Pt(12.5)
        pd.font.color.rgb = TEXT_MUTED
        pd.space_before = Pt(8)

    # -------------------------------------------------------------
    # SLIDE 8: 1-Click Action Playbooks (Guiding the Team)
    # -------------------------------------------------------------
    s8 = prs.slides.add_slide(blank_layout)
    add_bg(s8)
    add_header(s8, "Automated Response: 4 Steps from Alert to Resolution", "STEP-BY-STEP PLAYBOOKS")

    play_steps = [
        ("Phase 1: Spot the Threat", "Confirm if any of our company computers or servers are talking to the bad actor's systems.", CYAN_ACCENT),
        ("Phase 2: Block & Contain", "Instantly lock down affected computers and block malicious internet addresses at the firewall.", AMBER_ACCENT),
        ("Phase 3: Clean & Repair", "Remove malicious software, patch security holes, and reset compromised user passwords.", GREEN_ACCENT),
        ("Phase 4: Verify & Recover", "Confirm all systems are clean, restore normal business operations, and update defenses.", CYAN_ACCENT)
    ]

    for i, (title, desc, color) in enumerate(play_steps):
        col = i % 2
        row = i // 2
        x = Inches(0.8 + col * 5.9)
        y = Inches(1.8 + row * 2.5)
        card = s8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(5.6), Inches(2.2))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = CARD_BORDER

        tb = s8.shapes.add_textbox(x + Inches(0.3), y + Inches(0.25), Inches(5.0), Inches(1.7))
        tf = tb.text_frame
        tf.word_wrap = True
        pt = tf.paragraphs[0]
        pt.text = title
        pt.font.size = Pt(16)
        pt.font.bold = True
        pt.font.color.rgb = color

        pd = tf.add_paragraph()
        pd.text = desc
        pd.font.size = Pt(12.5)
        pd.font.color.rgb = TEXT_MUTED
        pd.space_before = Pt(8)

    # -------------------------------------------------------------
    # SLIDE 9: Visual, User-Friendly Dashboard
    # -------------------------------------------------------------
    s9 = prs.slides.add_slide(blank_layout)
    add_bg(s9)
    add_header(s9, "A Modern, Visual Command Center (Like a Weather Radar)", "USER INTERFACE")

    features = [
        ("Color-Coded Threat Map", "Visual red, amber, and green heatmaps show where attacks are concentrating globally."),
        ("Live Threat Feed", "Real-time scrolling ticker of emerging threats, clearly organized by severity."),
        ("One-Click Search Syntax", "Pre-written search commands ready to paste into security tools—no coding required."),
        ("Mobile & Tablet Ready", "Managers and analysts can review alerts from phones or tablets anywhere, anytime.")
    ]

    for i, (title, desc) in enumerate(features):
        x = Inches(0.8 + (i % 2) * 5.9)
        y = Inches(1.8 + (i // 2) * 2.5)
        card = s9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(5.6), Inches(2.2))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = CARD_BORDER

        tb = s9.shapes.add_textbox(x + Inches(0.3), y + Inches(0.25), Inches(5.0), Inches(1.7))
        tf = tb.text_frame
        tf.word_wrap = True
        pt = tf.paragraphs[0]
        pt.text = f"★ {title}"
        pt.font.size = Pt(16)
        pt.font.bold = True
        pt.font.color.rgb = CYAN_ACCENT

        pd = tf.add_paragraph()
        pd.text = desc
        pd.font.size = Pt(12.5)
        pd.font.color.rgb = TEXT_MUTED
        pd.space_before = Pt(8)

    # -------------------------------------------------------------
    # SLIDE 10: Measurable Business ROI & Cost Savings
    # -------------------------------------------------------------
    s10 = prs.slides.add_slide(blank_layout)
    add_bg(s10)
    add_header(s10, "Measurable Return on Investment (ROI)", "BUSINESS VALUE")

    roi_items = [
        ("70% Time Saved", "Security analysts cut hours of manual blog reading, redirecting 15+ hours weekly toward actively securing company systems.", GREEN_ACCENT),
        ("Zero-Day Prevention", "Catches vulnerabilities before they are used against us, preventing costly operational shutdowns.", CYAN_ACCENT),
        ("Reduced Cyber Insurance", "Demonstrating proactive 24/7 threat intelligence helps lower insurance premiums and audit fees.", GREEN_ACCENT),
        ("Zero Extra Headcount", "Enables our existing IT and security team to handle the threat workload of a team twice their size.", CYAN_ACCENT)
    ]

    for i, (metric, desc, color) in enumerate(roi_items):
        x = Inches(0.8 + (i % 2) * 5.9)
        y = Inches(1.8 + (i // 2) * 2.5)
        card = s10.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(5.6), Inches(2.2))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = CARD_BORDER

        tb = s10.shapes.add_textbox(x + Inches(0.3), y + Inches(0.2), Inches(5.0), Inches(1.8))
        tf = tb.text_frame
        tf.word_wrap = True
        pt = tf.paragraphs[0]
        pt.text = metric
        pt.font.size = Pt(18)
        pt.font.bold = True
        pt.font.color.rgb = color

        pd = tf.add_paragraph()
        pd.text = desc
        pd.font.size = Pt(12)
        pd.font.color.rgb = TEXT_MUTED
        pd.space_before = Pt(6)

    # -------------------------------------------------------------
    # SLIDE 11: Enterprise Safety: How We Keep Things Safe
    # -------------------------------------------------------------
    s11 = prs.slides.add_slide(blank_layout)
    add_bg(s11)
    add_header(s11, "Built with Security First: Zero Risk to Our Network", "TRUST & SAFETY")

    safety_cards = [
        ("Isolated Sandboxing", "Every external feed is inspected in a secure digital bubble. A broken or malicious website cannot harm our systems.", CYAN_ACCENT),
        ("Internal Network Guard", "Built-in protection prevents external sources from scanning or probing internal company computers.", GREEN_ACCENT),
        ("Ethical Compliance", "Monitors and respects source permissions, ensuring our scanning is fully compliant with copyright and licensing.", GREEN_ACCENT),
        ("Tested & Proven", "100% pass rate across 50 rigorous automated tests. Built for uninterrupted 24/7 enterprise operation.", CYAN_ACCENT)
    ]

    for i, (title, desc, color) in enumerate(safety_cards):
        x = Inches(0.8 + (i % 2) * 5.9)
        y = Inches(1.8 + (i // 2) * 2.5)
        card = s11.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(5.6), Inches(2.2))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = CARD_BORDER

        tb = s11.shapes.add_textbox(x + Inches(0.3), y + Inches(0.25), Inches(5.0), Inches(1.7))
        tf = tb.text_frame
        tf.word_wrap = True
        pt = tf.paragraphs[0]
        pt.text = title
        pt.font.size = Pt(16)
        pt.font.bold = True
        pt.font.color.rgb = color

        pd = tf.add_paragraph()
        pd.text = desc
        pd.font.size = Pt(12.5)
        pd.font.color.rgb = TEXT_MUTED
        pd.space_before = Pt(8)

    # -------------------------------------------------------------
    # SLIDE 12: Phased Rollout Plan
    # -------------------------------------------------------------
    s12 = prs.slides.add_slide(blank_layout)
    add_bg(s12)
    add_header(s12, "Low-Risk Phased Rollout Plan", "IMPLEMENTATION ROADMAP")

    roadmap_steps = [
        ("Phase 1: Build & Verify (Completed)", "Core engine built, tested, and verified with 50 automated tests passing at 100%.", GREEN_ACCENT),
        ("Phase 2: Live Pilot (Current)", "Live testing across 500+ global sources with our security team testing the dashboard.", CYAN_ACCENT),
        ("Phase 3: Automated Notifications (Next 30 Days)", "Automated threat alerts sent directly into Slack or Microsoft Teams for rapid notification.", TEXT_WHITE),
        ("Phase 4: Direct Firewall Push (Next 60 Days)", "Connecting threat feeds directly into company firewalls for hands-free automated blocking.", TEXT_MUTED)
    ]

    for i, (title, desc, color) in enumerate(roadmap_steps):
        y = Inches(1.8 + i * 1.25)
        card = s12.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), y, Inches(11.7), Inches(1.1))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = CARD_BORDER

        tb = s12.shapes.add_textbox(Inches(1.1), y + Inches(0.12), Inches(11.1), Inches(0.85))
        tf = tb.text_frame
        tf.word_wrap = True
        pt = tf.paragraphs[0]
        pt.text = title
        pt.font.size = Pt(14)
        pt.font.bold = True
        pt.font.color.rgb = color

        pd = tf.add_paragraph()
        pd.text = desc
        pd.font.size = Pt(11.5)
        pd.font.color.rgb = TEXT_MUTED
        pd.space_before = Pt(4)

    # -------------------------------------------------------------
    # SLIDE 13: Summary & Bottom Line
    # -------------------------------------------------------------
    s13 = prs.slides.add_slide(blank_layout)
    add_bg(s13)
    add_header(s13, "Bottom Line for Decision Makers", "SUMMARY")

    c_box = s13.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.5), Inches(1.9), Inches(10.3), Inches(4.8))
    c_box.fill.solid()
    c_box.fill.fore_color.rgb = CARD_BG
    c_box.line.color.rgb = CYAN_ACCENT

    tb_c = s13.shapes.add_textbox(Inches(2.0), Inches(2.2), Inches(9.3), Inches(4.2))
    tf_c = tb_c.text_frame
    tf_c.word_wrap = True

    pc1 = tf_c.paragraphs[0]
    pc1.text = "SOC-AI gives our business 24/7 visibility into cyber threats."
    pc1.font.size = Pt(21)
    pc1.font.bold = True
    pc1.font.color.rgb = TEXT_WHITE
    pc1.alignment = PP_ALIGN.CENTER

    pc2 = tf_c.add_paragraph()
    pc2.text = "Instead of reacting after an attack happens, we anticipate threats before they reach our systems."
    pc2.font.size = Pt(14)
    pc2.font.color.rgb = CYAN_ACCENT
    pc2.space_before = Pt(10)
    pc2.alignment = PP_ALIGN.CENTER

    takeaways = [
        "Eliminates 80% repetitive noise and saves 70% of analyst reading time",
        "Translates complex technical feeds into clear 2-minute executive sitreps",
        "Provides 1-click step-by-step action plans to stop threats immediately",
        "Fully tested, low-risk, and ready for immediate operational pilot"
    ]
    for b in takeaways:
        p = tf_c.add_paragraph()
        p.text = f"✔  {b}"
        p.font.size = Pt(13)
        p.font.color.rgb = TEXT_MUTED
        p.space_before = Pt(8)
        p.alignment = PP_ALIGN.CENTER

    p_end = tf_c.add_paragraph()
    p_end.text = "Thank You — Questions & Live Walkthrough"
    p_end.font.size = Pt(16)
    p_end.font.bold = True
    p_end.font.color.rgb = GREEN_ACCENT
    p_end.space_before = Pt(16)
    p_end.alignment = PP_ALIGN.CENTER

    output_filename = "SOC_AI_Executive_Presentation.pptx"
    prs.save(output_filename)
    print(f"Executive presentation saved successfully to: {output_filename}")
    try:
        prs.save("SOC_AI_Presentation.pptx")
        print("Updated SOC_AI_Presentation.pptx as well")
    except Exception:
        print("SOC_AI_Presentation.pptx is currently open in PowerPoint by user, saved as SOC_AI_Executive_Presentation.pptx")

if __name__ == "__main__":
    create_non_tech_deck()
