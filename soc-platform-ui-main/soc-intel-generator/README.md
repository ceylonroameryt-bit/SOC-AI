# SOC-INTEL Weekly Report Generator
**NO ENTRY SOC Platform | Sujampathi Rathnayaka — Security Analyst**

Automatically generates a professional, formatted Word (.docx) intelligence report every week from a simple JSON data file.

---

## Folder structure

```
soc-intel-generator/
  generate.py          <- Main generator script (never edit)
  weekly_data.json     <- BLANK TEMPLATE — copy this each week
  wk36_data.json       <- Example: WK36 completed data
  reports/             <- Generated .docx files saved here
  README.md            <- This file
```

---

## Your weekly workflow (10 minutes)

### Step 1 — Copy the template

Each week, copy `weekly_data.json` and name it with the week number:

```
Copy: weekly_data.json
Name: wk37_data.json
```

> **Tip:** Get the current ISO week number by running:
> ```
> python -c "import datetime; print(datetime.date.today().isocalendar()[1])"
> ```

---

### Step 2 — Fill in your data

Open your new `wk37_data.json` and update these sections:

#### `meta` — Week info
```json
"meta": {
  "week_num": 37,
  "date_range": "September 15-21, 2026",
  "published_date": "September 21, 2026",
  "title": "Your headline phrase for the week"
}
```

#### `stats` — Pull from NO ENTRY platform dashboard
```json
"stats": {
  "articles_ingested": 754,
  "mitre_categorized": 381,
  "tactic_coverage": "14 / 14",
  "active_zero_days": 1
}
```

#### `headlines` — 2–3 major stories this week
- Set `"severity"` to one of: `critical` | `high` | `medium` | `user_risk`
- Add CVE rows only if applicable (leave `"cves": []` if none)
- Add `"action"` text for recommended remediation steps

#### `tactic_volume` — Top 3 tactics from NO ENTRY heatmap
Pull the 3 highest event counts from the MITRE ATT&CK News Matrix screen.

#### `techniques` — Hottest technique per tactic from heatmap
Pull the top technique per tactic from the MITRE Heatmap screen.

**Hit bar percentage formula:**
```
hit_bar_pct = round((this_technique_hits / max_hits_this_week) * 100)
```
Example: if max hits = 19, and this technique has 14 hits → `round(14/19*100)` = 74

#### `breaches` — Major incidents disclosed this week
Add/remove rows as needed. Usually 2–4 per week.

#### `actions` — 5 weekend action items
Tailor these each week to the specific threats and techniques observed.

---

### Step 3 — Generate the report

```bash
cd soc-intel-generator

# Generate using your weekly data file
python generate.py --data wk37_data.json

# Generate and auto-open in Word
python generate.py --data wk37_data.json --open

# Specify a custom output folder
python generate.py --data wk37_data.json --out C:\Users\Sujampathi\Desktop
```

The file is saved as:
```
reports/SOC-INTEL-WK37-2026.docx
```

---

### Step 4 — Export to PDF (for LinkedIn)

1. Open the generated `.docx` in **Microsoft Word**
2. `File` → `Export` → **Create PDF/XPS**
3. Save — done. Share on LinkedIn as a document post.

---

## All command options

| Flag | Description |
|------|-------------|
| `--data <file>` | Path to your weekly JSON data file |
| `--out <folder>` | Where to save the .docx (default: `./reports/`) |
| `--open` | Auto-open the file in Word after generating |

---

## Archive of generated reports

All past reports are saved in `reports/` with the format:
```
SOC-INTEL-WK36-2026.docx
SOC-INTEL-WK37-2026.docx
SOC-INTEL-WK38-2026.docx
...
```

---

## Requirements

- Python 3.8+
- `python-docx` library (`pip install python-docx`)

---

*SOC-INTEL Weekly Report Generator · NO ENTRY SOC Platform*
