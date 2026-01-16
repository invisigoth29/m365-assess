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

## install-scubagear-deps.sh

Installs PowerShell module dependencies for full ScubaGear product coverage.

**Usage:**
```bash
bash scripts/install-scubagear-deps.sh
```

**What it installs:**
- Microsoft.PowerApps.PowerShell - For PowerPlatform assessments
- Microsoft.Online.SharePoint.PowerShell - For SharePoint Online assessments

**When to use:**
- Initial setup
- When seeing warnings about missing PowerPlatform or SharePoint modules
- To enable full M365 product coverage

