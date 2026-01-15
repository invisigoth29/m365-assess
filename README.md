# m365-assess

Microsoft 365 Security Assessment CLI - A wrapper/orchestrator around ScubaGear that produces customer-ready Word reports with a single command.

## Overview

This tool automates the entire M365 security assessment workflow:

1. Runs ScubaGear (with interactive authentication)
2. Captures and normalizes JSON output
3. Maps findings to canonical security themes
4. Computes weighted security scores
5. Generates a professional Markdown report
6. Converts to Word document using your branded template

**One command. One finished report.**

## Prerequisites

### Required Software

- **Node.js** >= 18.0.0
- **PowerShell 7+** (pwsh) - [Install Guide](https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell)
- **Pandoc** - [Install Guide](https://pandoc.org/installing.html)

### macOS Installation

```bash
# Install PowerShell
brew install powershell/tap/powershell

# Install Pandoc
brew install pandoc

# Verify installations
pwsh --version
pandoc --version
```

### ScubaGear Setup

Clone ScubaGear to your working directory (where you'll run assessments):

```bash
git clone https://github.com/cisagov/ScubaGear.git
```

Or specify a custom path with `--scubagear-path`.

## Installation

```bash
git clone https://github.com/invisigoth29/m365-assess.git
cd m365-assess
npm install
```

## Setup

### Word Template (Required)

Place your branded Word template at:

```
templates/M365_Security_Assessment_Template.docx
```

This template is used by pandoc as the reference document for styling. Create a Word document with your company branding, headers, footers, and styles - pandoc will apply these to the generated report.

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
│       └── results.json          # Raw ScubaGear output
├── bundle.json                    # Normalized findings bundle
├── bundle.scored.json             # Bundle with security scores
├── report.md                      # Generated Markdown report
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

**"pandoc not found"**
```bash
brew install pandoc
```

**"ScubaGear module not found"**
- Ensure ScubaGear is cloned to `./ScubaGear` in your working directory
- Or specify the path with `--scubagear-path`

**"Template not found"**
- Ensure `M365_Security_Assessment_Template.docx` exists in `templates/`

### Logs

Check `logs/run.log` in the output folder for detailed execution logs including ScubaGear stdout/stderr.

## License

MIT
