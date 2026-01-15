# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

m365-assess is a Node.js CLI tool that wraps ScubaGear (PowerShell-based M365 security scanner) to automate the complete assessment workflow: running ScubaGear, normalizing findings into a canonical JSON format, computing weighted security scores, mapping findings to security themes, and generating professional Word reports using pandoc. The entire workflow executes with a single command.

## Essential Commands

### Development
```bash
# Run the tool (basic usage)
node audit.js --customer "Acme Corp" --tenant-id "12345678-1234-1234-1234-123456789abc"

# Run with all options
node audit.js \
  --customer "Acme Corp" \
  --tenant-id "12345678-1234-1234-1234-123456789abc" \
  --team-name "Security Advisory Team" \
  --previous "./reports/2024-01-15_acme-corp_RUN-abc123/bundle.scored.json" \
  --output-dir "./reports" \
  --scubagear-path "./ScubaGear"

# Install dependencies
npm install

# View help
node audit.js --help
```

### Testing and Debugging
```bash
# Test with existing ScubaGear results (skip actual scan)
node audit.js --customer "Test" --tenant-id "12345678-1234-1234-1234-123456789abc" \
  --skip-scubagear --scubagear-results "./path/to/results.json"

# Check logs from a run
cat ./reports/YYYY-MM-DD_customer-name_RUN-xxxxx/logs/run.log

# Validate JSON outputs
jq . ./reports/YYYY-MM-DD_customer-name_RUN-xxxxx/bundle.scored.json
```

### Prerequisites Verification
```bash
# Verify PowerShell 7+
pwsh --version

# Verify pandoc
pandoc --version

# Check ScubaGear is cloned
ls -la ./ScubaGear/PowerShell/ScubaGear/ScubaGear.psd1
```

## Architecture

### Execution Flow
The tool follows a strict 7-stage pipeline (see `audit.js:main()`):

1. **Preflight checks** (`lib/preflight.js`) - Validates all dependencies (pwsh, pandoc, ScubaGear, templates)
2. **Run ScubaGear** (`lib/run-scubagear.js`) - Spawns PowerShell process to execute ScubaGear module
3. **Map to bundle** (`lib/map-to-bundle.js`) - Transforms raw ScubaGear JSON into normalized findings format with theme assignments
4. **Calculate score** (`lib/score.js`) - Computes weighted pass ratio (Critical=10, High=7, Medium=4, Low=1)
5. **Score movement** (`lib/score-movement.js`) - Compares current vs previous scores if `--previous` provided
6. **Process themes** (`lib/theme-engine.js`) - Groups findings by security themes and assigns priorities
7. **Render outputs** (`lib/render-md.js`, `lib/render-docx.js`) - Generates Markdown using Nunjucks templates, then converts to DOCX via pandoc

### Key Concepts

**Bundle Format**: Canonical JSON structure (`bundle.json`) containing:
- `run` metadata (customer, tenant, timestamps)
- `findings[]` array with normalized status/severity
- `summary` with counts and scoring
- Each finding has: `finding_id`, `control_id`, `title`, `description`, `status`, `severity`, `theme_id`, `capabilities`, `product`, `source`, `evidence`

**Security Themes**: Findings are automatically mapped to themes using keyword matching:
- `THEME.IDENTITY.ATO_REDUCTION` - Account takeover prevention (MFA, conditional access)
- `THEME.IDENTITY.PRIVILEGED_ACCESS_GOVERNANCE` - Admin access controls (PIM, least privilege)
- `THEME.EMAIL.PHISHING_RESILIENCE` - Email security (SPF/DKIM/DMARC, Safe Links)
- `THEME.GOVERNANCE.AUDIT_AND_VISIBILITY` - Logging and monitoring

**Theme Priority Logic** (`lib/theme-engine.js:determinePriority()`):
- **Now** (0-30 days): Critical/High severity OR identity/email themes with failures
- **Next** (30-60 days): Medium severity findings
- **Later** (60-90 days): Low/Info severity findings

**Scoring Methodology**: Weighted pass ratio where score = (passed_weight / total_weight) × 100
- Statuses: `pass`, `fail`, `not_applicable`, `info`
- Only `pass` contributes to numerator; `not_applicable` excluded from denominator
- Zero-weight severities (info/unknown) excluded from calculation

### Critical Files
- `audit.js` - Main entry point and orchestration
- `lib/theme-engine.js` - Theme definitions (THEME_DEFINITIONS object) and mapping logic
- `lib/map-to-bundle.js` - Theme assignment via keyword matching (THEME_KEYWORD_RULES)
- `lib/score.js` - Scoring algorithm (SEVERITY_WEIGHTS constant)
- `templates/report_template_v2.md` - Nunjucks template for Markdown report
- `templates/M365_Security_Assessment_Template.docx` - Word reference document for pandoc

## Development Guidelines

### Code Style
- ES6 modules (`"type": "module"` in package.json)
- Use JSDoc comments for all exported functions
- Descriptive logging with `logStage()`, `logSuccess()`, `logError()` prefixes
- All paths resolved to absolute using `path.resolve()`
- Normalize external data early (see `normalizeStatus()`, `normalizeSeverity()` in utils.js)

### Adding New Themes
1. Add theme definition to `THEME_DEFINITIONS` in `lib/theme-engine.js`
2. Add keyword rules to `THEME_KEYWORD_RULES` in `lib/map-to-bundle.js`
3. Set `is_initial_access: true/false` to influence priority assignment
4. Update template if new sections needed

### Modifying Scoring
- Severity weights defined in `lib/score.js:SEVERITY_WEIGHTS`
- Excluded statuses in `lib/score.js:EXCLUDED_STATUSES`
- Score calculation is pure function: `calculateScore(findings)` returns score object
- Always test with sample bundles to verify changes

### Template Customization
- Markdown template uses Nunjucks syntax (variables: `{{ customer }}`, loops: `{% for %}`)
- Word template styling applied via pandoc's `--reference-doc` flag
- Edit Word template styles/headers/footers in DOCX, not in code
- Test pandoc conversion after template changes: `pandoc report.md -o test.docx --reference-doc=template.docx`

### Error Handling
- Preflight checks fail-fast with clear error messages and installation instructions
- All file I/O wrapped in try-catch with descriptive errors
- ScubaGear failures captured in logs (`logs/run.log`) with stdout/stderr
- Pandoc errors include full stderr output for debugging

### Working with ScubaGear
- ScubaGear is an external PowerShell module (cloned separately, not in node_modules)
- Tool spawns `pwsh` process and imports module dynamically
- ScubaGear outputs vary by version—parser handles multiple formats in `lib/map-to-bundle.js:extractControls()`
- Test against different ScubaGear output structures when updating parser

## Environment-Specific Notes

### macOS (Primary Platform)
- PowerShell installed via Homebrew: `brew install powershell/tap/powershell`
- Pandoc installed via Homebrew: `brew install pandoc`
- ScubaGear runs under pwsh (not Windows PowerShell)

### Prerequisites
This tool requires external dependencies not managed by npm:
- **PowerShell 7+** (pwsh) - Required to execute ScubaGear
- **Pandoc** - Required to convert Markdown to DOCX
- **ScubaGear** - PowerShell module cloned separately (default: `./ScubaGear`)

### File Locations
- Tool templates: `<tool-dir>/templates/` (where tool is installed)
- Output reports: `./reports/` (in working directory where tool is run)
- ScubaGear: `./ScubaGear/` (in working directory, or custom via `--scubagear-path`)
- Logs: `./reports/<run-folder>/logs/run.log`

## Output Structure

Each run creates a timestamped folder with complete audit trail:
```
reports/YYYY-MM-DD_<customer-slug>_RUN-<id>/
├── raw/scubagear/results.json  # Raw ScubaGear output
├── bundle.json                  # Normalized findings
├── bundle.scored.json           # Scored bundle (save for --previous)
├── report.md                    # Generated Markdown
├── report.docx                  # Final Word document
└── logs/run.log                 # Execution logs
```

## Common Patterns

### Reading and Normalizing External Data
```javascript
import { readJson, normalizeStatus, normalizeSeverity } from './utils.js';

const rawData = readJson(inputPath);
const status = normalizeStatus(rawData.status); // 'pass' | 'fail' | 'not_applicable' | 'info'
const severity = normalizeSeverity(rawData.severity); // 'critical' | 'high' | 'medium' | 'low' | 'info'
```

### Stable ID Generation
```javascript
import { hashString } from './utils.js';

const idSource = `${product}-${controlId}-${title}`.toLowerCase();
const findingId = `FIND-${hashString(idSource)}`;
```

### Spawning External Processes
```javascript
import { spawn } from 'child_process';
import { appendLog } from './utils.js';

const process = spawn('command', args, { stdio: ['ignore', 'pipe', 'pipe'] });

process.stdout.on('data', (data) => appendLog(logPath, `[STDOUT] ${data}`));
process.stderr.on('data', (data) => appendLog(logPath, `[STDERR] ${data}`));
process.on('close', (code) => {
  if (code !== 0) throw new Error(`Process failed with exit code ${code}`);
});
```

### Creating Timestamped Folders
```javascript
import { createRunFolder } from './utils.js';

const paths = createRunFolder(config.outputDir, config.customer);
// Returns: { runFolder, runId, bundlePath, scoredBundlePath, reportMdPath, reportDocxPath, logPath, ... }
```
