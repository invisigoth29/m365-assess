# m365-assess

Microsoft 365 Security Assessment CLI - A wrapper/orchestrator around ScubaGear that produces customer-ready Word reports with a single command.

## Overview

This tool automates the entire M365 security assessment workflow:

1. Runs ScubaGear (with interactive authentication)
2. Captures and normalizes JSON output
3. Maps findings to canonical security themes
4. Computes weighted security scores
5. Generates a professional Word report using native DOCX templating

**One command. One finished report.**

## Prerequisites

### Required Software

- **Node.js** >= 18.0.0
- **PowerShell 7+** (pwsh) - [Install Guide](https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell)

### macOS Installation

```bash
# Install PowerShell
brew install powershell/tap/powershell

# Verify installation
pwsh --version
```

### ScubaGear Setup

Clone ScubaGear to your working directory (where you'll run assessments):

```bash
git clone https://github.com/cisagov/ScubaGear.git
```

Or specify a custom path with `--scubagear-path`.

#### Install ScubaGear Dependencies (Recommended)

For full M365 product coverage (PowerPlatform and SharePoint), install additional PowerShell modules:

```bash
bash scripts/install-scubagear-deps.sh
```

Or install manually:

```bash
pwsh -Command "Install-Module -Name Microsoft.PowerApps.PowerShell -Force -AllowClobber -Scope CurrentUser"
pwsh -Command "Install-Module -Name Microsoft.Online.SharePoint.PowerShell -Force -AllowClobber -Scope CurrentUser"
```

Without these modules, PowerPlatform and SharePoint will be omitted from assessments.

## Installation

```bash
git clone https://github.com/invisigoth29/m365-assess.git
cd m365-assess
npm install
```

## Setup

### Word Template

The tool includes a pre-built Word template with docxtemplater tags at:

```
templates/report_template.docx
```

**Template Customization:**
- Edit the template directly in Microsoft Word for styling changes (fonts, colors, headers, footers)
- Be careful not to modify the docxtemplater tags (text in curly braces like `{customer_name}`)

**Regenerating Template:**
If the template becomes corrupted or you need structural changes:

```bash
pip3 install python-docx
python3 scripts/create_template.py
```

This generates a fresh template with all required docxtemplater tags.

## Usage

### Basic Command

```bash
node audit.js --customer "Acme Corp" --tenant-id "12345678-1234-1234-1234-123456789abc"
```

### Full Options

```bash
node audit.js \
  --customer "Acme Corp" \
  --tenant-id "12345678-1234-1234-1234-123456789abc" \
  --team-name "Security Advisory Team" \
  --previous "./reports/2024-01-15_acme-corp_RUN-abc123/bundle.scored.json" \
  --output-dir "./reports" \
  --scubagear-path "./ScubaGear"
```

### CLI Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--customer`, `-c` | Yes | Customer name for the report |
| `--tenant-id`, `-t` | Yes | Microsoft 365 Tenant ID (GUID) |
| `--team-name` | No | Team name in report (default: "Security Team") |
| `--previous`, `-p` | No | Path to previous bundle.scored.json for score comparison |
| `--output-dir`, `-o` | No | Output directory (default: ./reports) |
| `--scubagear-path` | No | Path to ScubaGear clone (default: ./ScubaGear) |
| `--templates-dir` | No | Path to templates (default: ./templates in tool dir) |

## Output Structure

Each run creates a timestamped folder:

```
reports/YYYY-MM-DD_<customer-slug>_RUN-<shortid>/
├── raw/
│   └── scubagear/
│       ├── results.json          # Raw ScubaGear JSON output
│       └── scuba_output/         # ScubaGear HTML reports and other files
│           └── M365BaselineConformance_YYYY_MM_DD_HH_MM_SS/
│               ├── BaselineReports.html
│               ├── IndividualReports/
│               └── ...
├── bundle.json                    # Normalized findings bundle
├── bundle.scored.json             # Bundle with security scores
├── report.docx                    # Final Word document
└── logs/
    └── run.log                    # Execution logs
```

## Scoring Methodology

### Weighted Pass Ratio

Each finding is weighted by risk severity:

| Severity | Weight |
|----------|--------|
| Critical | 10 |
| High | 7 |
| Medium | 4 |
| Low | 1 |
| Info/Unknown | 0 |

**Formula:**
```
Score = (Sum of weights for PASSED controls / Sum of weights for ALL applicable controls) × 100
```

**Rules:**
- Only `status == "pass"` counts toward the numerator
- `status == "not_applicable"` is excluded from the denominator
- Score is rounded to the nearest integer

### Score Movement

When `--previous` is provided, the tool calculates:
- Previous score percentage
- Delta (current - previous)
- Signed delta display (+12, -3, 0)

## Security Themes

Findings are grouped into actionable themes:

| Theme ID | Description |
|----------|-------------|
| `THEME.IDENTITY.ATO_REDUCTION` | Account takeover prevention |
| `THEME.IDENTITY.PRIVILEGED_ACCESS_GOVERNANCE` | Admin access controls |
| `THEME.EMAIL.PHISHING_RESILIENCE` | Email security hardening |
| `THEME.GOVERNANCE.AUDIT_AND_VISIBILITY` | Logging and monitoring |

### Priority Assignment

- **Now (0-30 days):** Critical/High findings OR identity/email initial access themes
- **Next (30-60 days):** Predominantly medium severity findings
- **Later (60-90 days):** Only low/info severity findings

## Troubleshooting

### Common Issues

**"pwsh not found"**
```bash
brew install powershell/tap/powershell
```

**"ScubaGear module not found"**
- Ensure ScubaGear is cloned to `./ScubaGear` in your working directory
- Or specify the path with `--scubagear-path`

**"PowerPlatform/SharePoint will be omitted"**
- Install missing PowerShell modules: `bash scripts/install-scubagear-deps.sh`
- Or install manually (see ScubaGear Setup section)

**"Template not found"**
- Ensure `report_template.docx` exists in `templates/`
- Regenerate if needed: `python3 scripts/create_template.py`

### Logs

Check `logs/run.log` in the output folder for detailed execution logs including ScubaGear stdout/stderr.

## License

MIT
