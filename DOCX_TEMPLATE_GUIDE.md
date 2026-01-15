# DOCX Template Guide for m365-assess

## Overview

The m365-assess tool has been migrated from Markdown+pandoc to **native DOCX generation** using `docxtemplater`. This means reports are now generated directly from a Word template file using JSON data, without any intermediate Markdown step.

## What Changed

### Removed
- ❌ Markdown template (`report_template_v2.md`)
- ❌ Nunjucks dependency  
- ❌ Pandoc invocation
- ❌ `lib/render-md.js` (markdown rendering)
- ❌ `lib/render-docx.js` (pandoc wrapper)

### Added
- ✅ `docxtemplater` - Native DOCX templating library
- ✅ `pizzip` - ZIP manipulation for DOCX files
- ✅ `lib/render-docx-native.js` - Direct DOCX generator
- ✅ New DOCX template: `templates/report_template.docx`

## Creating the DOCX Template

### 1. Template Location

The template must be located at:
```
templates/report_template.docx
```

### 2. Template Tags

Use `{variable}` syntax for simple variables and `{#section}...{/section}` for loops.

#### Available Variables

**Basic Information:**
- `{customer_name}` - Customer name
- `{tenant_id}` - Microsoft 365 tenant ID
- `{assessment_date}` - Date of assessment (YYYY-MM-DD)
- `{team_name}` - Assessment team name
- `{run_id}` - Unique run identifier

**Scoring:**
- `{security_score}` - Overall security score (0-100)
- `{risk_level}` - Risk level text (e.g., "Critical - Immediate Action Required")
- `{assessment_summary}` - Dynamic summary based on score

**Score Movement:**
- `{has_score_movement}` - Boolean: true if prior assessment exists
- `{score_movement_message}` - Message about score change
- `{previous_score}` - Previous assessment score
- `{current_score}` - Current assessment score
- `{score_delta}` - Score change (e.g., "+5", "-3")
- `{previous_date}` - Date of previous assessment

**Risk Counts:**
- `{critical_count}` - Number of critical severity findings
- `{high_count}` - Number of high severity findings
- `{medium_count}` - Number of medium severity findings
- `{low_count}` - Number of low severity findings

**Control Counts:**
- `{total_findings}` - Total controls assessed
- `{passed_count}` - Controls passing
- `{failed_count}` - Controls failing
- `{na_count}` - Controls not applicable

**Business Impact:**
- `{has_high_risks}` - Boolean: true if critical/high risks exist
- `{show_positive_posture}` - Boolean: true if no high risks

### 3. Looping Through Collections

**Priority Themes:**
```
{#priority_themes}
- {title}: {failed_count} findings at {risk_level} risk
{/priority_themes}
```

**Roadmap:**
```
{#roadmap}
Priority: {priority}
Theme: {theme}
Timeline: {window}
Risk Level: {risk_level}
Findings: {failed_count}
{/roadmap}
```

**Detailed Themes:**
```
{#themes}
Theme: {title}
Priority: {priority} ({window})
Risk Level: {risk_level}
Pass Rate: {pass_rate}%

Why This Matters:
{business_rationale}

Business Impact:
{business_impact}

Recommendation:
{recommendation_summary}

Remediation Steps:
{#remediation_steps}
{.}
{/remediation_steps}

Failed Findings:
{#failed_findings}
- {title}
  Control ID: {control_id}
  Risk Level: {severity}
  Details: {evidence.details}
{/failed_findings}
{/themes}
```

### 4. Conditional Content

**Show content only if score movement exists:**
```
{#has_score_movement}
Previous Score: {previous_score}%
Current Score: {current_score}%
Change: {score_delta} points
{/has_score_movement}
```

**Show content only if high risks exist:**
```
{#has_high_risks}
Critical Risks Identified:
- Data breach risk
- Compliance violations
- Business disruption
{/has_high_risks}
```

**Show content only if posture is good:**
```
{#show_positive_posture}
The organization has addressed most critical security risks.
{/show_positive_posture}
```

### 5. Theme Object Structure

Each theme in the `{#themes}` loop contains:

```javascript
{
  theme_id: "THEME.IDENTITY.ATO_REDUCTION",
  title: "Account Takeover Reduction",
  description: "...",
  priority: "Now",
  window: "0-30 days",
  priority_rank: 1,
  risk_level: "high",
  
  // Findings
  findings: [...],           // All findings for this theme
  failed_findings: [...],    // Only failed findings
  pass_rate: 45,            // Percentage passing
  
  // Counts
  failed_count: 11,
  passed_count: 3,
  total_count: 15,
  
  // Business context
  business_rationale: "...",
  business_impact: "...",
  recommendation_summary: "...",
  remediation_steps: ["Step 1", "Step 2", ...],
  operational_notes: ["Note 1", "Note 2", ...],
  
  is_initial_access: true   // Attack vector flag
}
```

### 6. Finding Object Structure

Each finding in `{#failed_findings}` contains:

```javascript
{
  finding_id: "FIND-729218e4",
  control_id: "MS.AAD.1.1v1",
  title: "Legacy authentication SHALL be blocked.",
  description: "...",
  status: "fail",           // pass, fail, not_applicable, info
  severity: "high",         // critical, high, medium, low, info
  theme_id: "THEME.IDENTITY.ATO_REDUCTION",
  product: "AAD",
  
  evidence: {
    details: "0 conditional access policies found...",
    recommendation: "Configure conditional access...",
    reference: "https://..."
  },
  
  source: {
    tool: "ScubaGear",
    original_id: "MS.AAD.1.1v1",
    raw: {...}              // Original ScubaGear data
  }
}
```

## Example Template Structure

Here's a basic template structure:

```
Microsoft 365 Security Assessment Report

Prepared For: {customer_name}
Tenant ID: {tenant_id}
Assessment Date: {assessment_date}
Prepared By: {team_name}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTIVE SUMMARY

Security Score: {security_score}%
Risk Level: {risk_level}

{assessment_summary}

{#has_score_movement}
Score Movement:
Previous: {previous_score}% ({previous_date})
Current: {current_score}%
Change: {score_delta} points
{/has_score_movement}

Risk Summary:
Critical: {critical_count}
High: {high_count}
Medium: {medium_count}
Low: {low_count}

Controls Assessment:
✓ {passed_count} Passing
✗ {failed_count} Failing
○ {na_count} Not Applicable
Total: {total_findings}

{#has_high_risks}
⚠️ CRITICAL RISKS IDENTIFIED

The current security posture exposes the organization to:
- Data breach risk
- Compliance violations
- Business disruption
- Reputational damage

Recommended Action: Prioritize remediation within 30 days
{/has_high_risks}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRIORITY AREAS

{#priority_themes}
{.index}. {title}
{failed_count} finding(s) at {risk_level} risk

{/priority_themes}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REMEDIATION ROADMAP

{#roadmap}
Priority: {priority}
Focus Area: {theme}
Timeline: {window}
Risk Level: {risk_level}
Findings: {failed_count}

{/roadmap}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DETAILED FINDINGS

{#themes}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{title}

Priority: {priority} ({window})
Risk Level: {risk_level}
Pass Rate: {pass_rate}%
Controls: {failed_count} failing / {total_count} total

Why This Matters:
{business_rationale}

Business Impact:
{business_impact}

Recommendation Summary:
{recommendation_summary}

Remediation Steps:
{#remediation_steps}
{.index}. {.}
{/remediation_steps}

Operational Considerations:
{#operational_notes}
• {.}
{/operational_notes}

━━━ Failed Controls ━━━

{#failed_findings}
{.index}. {title}

Control ID: {control_id}
Risk Level: {severity}
Status: {status}
Product: {product}

What This Control Does:
{description}

Current Finding:
{evidence.details}

{/failed_findings}

{/themes}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Assessment ID: {run_id}
Generated: {assessment_date}
```

## Tips for Template Design

1. **Use Word Styles**: Apply Word styles (Heading 1, Heading 2, etc.) to format your template professionally

2. **Tables**: Create tables in Word and use tags within table cells for dynamic data

3. **Conditional Formatting**: Use `{#variable}...{/variable}` to show/hide sections based on data

4. **Nested Loops**: You can nest loops, e.g., `{#themes}{#failed_findings}...{/failed_findings}{/themes}`

5. **Index Numbers**: Use `{.index}` to get the loop index (1-based)

6. **Current Item**: Use `{.}` to access the current item in a simple array

7. **Testing**: Test your template by regenerating reports from existing bundles

## Regenerating Reports

To regenerate a report from an existing bundle without re-running ScubaGear:

```bash
node regenerate-reports.js /path/to/bundle.scored.json
```

## Troubleshooting

**Error: "DOCX template not found"**
- Ensure `templates/report_template.docx` exists
- Check the file name is exactly `report_template.docx`

**Error: "Unclosed tag"**
- Check all `{#section}` tags have matching `{/section}` tags
- Use Word's "Show all formatting marks" to find hidden tags

**Error: "Unknown tag"**
- Verify the variable name matches exactly (case-sensitive)
- Check the available variables list above

**Formatting Issues:**
- Tags inherit the formatting of surrounding text
- Apply Word formatting to the tags themselves for consistent output

## Migration Checklist

- [x] Removed Markdown template dependencies
- [x] Removed pandoc dependencies
- [x] Added docxtemplater and pizzip
- [x] Created new render-docx-native.js
- [x] Updated audit.js to use native DOCX rendering
- [x] Updated preflight.js to check for DOCX template
- [x] Updated package.json dependencies
- [ ] Create DOCX template at `templates/report_template.docx`
- [ ] Test report generation with existing bundle

## Next Steps

1. Create your `templates/report_template.docx` file using the variable reference above
2. Apply professional Word styles and formatting
3. Test with: `node regenerate-reports.js <path-to-bundle.scored.json>`
4. Iterate on template design based on output
5. Run full assessment to verify end-to-end workflow
