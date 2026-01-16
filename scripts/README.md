# Template Generation Scripts

This directory contains utility scripts for m365-assess.

## create_template.py

Generates the DOCX template with docxtemplater tags for the m365-assess report.

**Usage:**
```bash
python3 scripts/create_template.py
```

**Requirements:**
- python-docx library (`pip3 install python-docx`)

**Output:**
- Creates/overwrites `templates/report_template.docx`

**When to use:**
- Initial template creation
- Rebuilding template after structural changes
- Fixing corrupted templates

