import json
import os
import sys
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--data", default="wk37_data.json", help="Data JSON file")
args = parser.parse_args()

with open(args.data, "r", encoding="utf-8") as f:
    d = json.load(f)

meta = d["meta"]
stats = d["stats"]
headlines = d["headlines"]
tactic_volume = d["tactic_volume"]
techniques = d["techniques"]
soc_pillars = d["soc_pillars"]
breaches = d["breaches"]
actions = d["actions"]

with open("../public/soc-intel-template.html", "r", encoding="utf-8") as f:
    html = f.read()

# Replace Header & Meta
html = html.replace("[WEEK_NUM]", str(meta["week_num"]))
html = html.replace("[DATE_RANGE e.g. September 15–21, 2026]", meta["date_range"])
html = html.replace("[DATE_RANGE]", meta["date_range"])
html = html.replace("[HEADLINE_TITLE\n      e.g. \"The week persistence\n      became the priority\"]", meta["title"].replace(" ", "<br>"))
html = html.replace("[PUBLISHED_DATE]", meta["published_date"])
html = html.replace("[STAT_INGESTED]", f"{stats['articles_ingested']:,}")
html = html.replace("[STAT_CATEGORIZED]", f"{stats['mitre_categorized']:,}")

# Replace Stat Strip
html = html.replace("<p class=\"stat-value\">[000]</p>", f'<p class=\"stat-value\">{stats["articles_ingested"]:,}</p>', 1)
html = html.replace("<p class=\"stat-value blue\">[000]</p>", f'<p class=\"stat-value blue\">{stats["mitre_categorized"]:,}</p>', 1)
html = html.replace("<p class=\"stat-value\">[14 / 14]</p>", f'<p class=\"stat-value\">{stats["tactic_coverage"]}</p>', 1)
html = html.replace("<p class=\"stat-value red\">[0]</p>", f'<p class=\"stat-value red\">{stats["active_zero_days"]}</p>', 1)

# Build Section 01 Headlines
headlines_html = ""
for h in headlines:
    sev_class = h["severity"].replace("_", "-")
    badge_label = h["severity"].upper()
    cves_html = ""
    for c in h.get("cves", []):
        cves_html += f"""
          <div class="cve-row">
            <span class="cve-tag">{c['id']}</span>
            <span class="cve-desc">{c['desc']}</span>
          </div>"""
    action_html = ""
    if h.get("action"):
        action_html = f"""
          <div class="alert-action">
            <span class="action-tag">ACTION</span>
            <p class="action-text">{h['action']}</p>
          </div>"""

    headlines_html += f"""
      <div class="alert-card {sev_class}">
        <div class="alert-head">
          <p class="alert-title">{h['title']}</p>
          <span class="badge {sev_class}">{badge_label}</span>
        </div>
        <div class="alert-body">
          <p>{h['body']}</p>{cves_html}{action_html}
        </div>
      </div>"""

# Replace Headlines block
import re
html = re.sub(
    r'<!-- HEADLINE CARD 1 -->.*?<!-- ═══════════════════════════════════════════\s+SECTION 02',
    headlines_html + '\n    </div>\n\n    <!-- ═══════════════════════════════════════════\n         SECTION 02',
    html,
    flags=re.DOTALL
)

# Build Section 02 Tactic Volume & Heatmap
# Tactic volume ranks
tac_vol_html = f"""
      <div class="tactic-rank-grid">
        <div class="tactic-rank-card">
          <span class="rank-num">{tactic_volume[0]['rank']}</span>
          <p class="rank-count">{tactic_volume[0]['count']}</p>
          <p class="rank-name">{tactic_volume[0]['tactic']}</p>
        </div>
        <div class="tactic-rank-card">
          <span class="rank-num">{tactic_volume[1]['rank']}</span>
          <p class="rank-count">{tactic_volume[1]['count']}</p>
          <p class="rank-name">{tactic_volume[1]['tactic']}</p>
        </div>
        <div class="tactic-rank-card">
          <span class="rank-num">{tactic_volume[2]['rank']}</span>
          <p class="rank-count">{tactic_volume[2]['count']}</p>
          <p class="rank-name">{tactic_volume[2]['tactic']}</p>
        </div>
      </div>
      <p class="tactic-context">
        Across {stats['mitre_categorized']} categorized events, three tactics account for the overwhelming majority of observed activity. {d.get('tactic_volume_note', '')}
      </p>"""

# Techniques table
tech_rows = ""
for t in techniques:
    tech_rows += f"""
          <tr>
            <td class="tactic-col">{t['tactic']}</td>
            <td class="tech-name">{t['technique']}</td>
            <td class="tech-id">{t['attck_id']}</td>
            <td class="hits-col">{t['hits']}</td>
            <td class="bar-col"><div class="hit-bar" style="width: {t['hit_bar_pct']}%;"></div></td>
          </tr>"""

tech_table_html = f"""
      <div class="tech-table-wrap">
        <table class="tech-table">
          <thead>
            <tr>
              <th style="width: 26%;">Tactic</th>
              <th style="width: 38%;">Observed technique</th>
              <th style="width: 14%;">ATT&amp;CK ID</th>
              <th style="width: 8%;">Hits</th>
              <th style="width: 14%;">Volume</th>
            </tr>
          </thead>
          <tbody>{tech_rows}
          </tbody>
        </table>
      </div>"""

html = re.sub(
    r'<div class="tactic-rank-grid">.*?<!-- ═══════════════════════════════════════════\s+SECTION 03',
    tac_vol_html + '\n' + tech_table_html + '\n    </div>\n\n    <!-- ═══════════════════════════════════════════\n         SECTION 03',
    html,
    flags=re.DOTALL
)

# Replace Section 03 Pillars intro and items
pillars_html = f"""
      <p class="section-intro">
        {d.get('soc_pillars_intro', '')}
      </p>
      <div class="pillars-grid">"""

for p in soc_pillars:
    pillars_html += f"""
        <div class="pillar-card">
          <div class="pillar-num">{p['num']}</div>
          <p class="pillar-label">{p['label']}</p>
          <p class="pillar-title">{p['title']}</p>
          <p class="pillar-body">{p['body']}</p>
        </div>"""
pillars_html += "\n      </div>"

html = re.sub(
    r'<p class="section-intro">.*?<!-- ═══════════════════════════════════════════\s+SECTION 04',
    pillars_html + '\n    </div>\n\n    <!-- ═══════════════════════════════════════════\n         SECTION 04',
    html,
    flags=re.DOTALL
)

# Section 04 Breaches
breach_rows = ""
for b in breaches:
    breach_rows += f"""
          <tr>
            <td class="org-name">{b['org']}</td>
            <td class="org-impact">{b['impact']}</td>
            <td class="org-type">{b['type']}</td>
          </tr>"""

breaches_html = f"""
      <div class="tech-table-wrap">
        <table class="tech-table">
          <thead>
            <tr>
              <th style="width: 28%;">Organisation</th>
              <th style="width: 40%;">Impact / Scope</th>
              <th style="width: 32%;">Incident type</th>
            </tr>
          </thead>
          <tbody>{breach_rows}
          </tbody>
        </table>
      </div>
      <p class="breach-note">
        {d.get('breach_note', '')}
      </p>"""

html = re.sub(
    r'<div class="tech-table-wrap">\s+<table class="tech-table">\s+<thead>\s+<tr>\s+<th style="width: 28%;">Organisation</th>.*?<!-- ═══════════════════════════════════════════\s+SECTION 05',
    breaches_html + '\n    </div>\n\n    <!-- ═══════════════════════════════════════════\n         SECTION 05',
    html,
    flags=re.DOTALL
)

# Section 05 Actions
actions_html = '<div class="actions-list">'
for a in actions:
    actions_html += f"""
        <div class="action-item">
          <div class="action-check"></div>
          <div class="action-content">
            <span class="action-bold">{a['title']}</span>
            <span class="action-desc">{a['detail']}</span>
          </div>
        </div>"""
actions_html += "\n      </div>"

html = re.sub(
    r'<div class="actions-list">.*?<!-- ═══════════════════════════════════════════\s+FOOTER',
    actions_html + '\n    </div>\n\n    <!-- ═══════════════════════════════════════════\n         FOOTER',
    html,
    flags=re.DOTALL
)

# Output to public/soc-intel-wk{week_num}.html
output_path = f"../public/soc-intel-wk{meta['week_num']}.html"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(html)

print("Rendered HTML report to:", output_path)
