/**
 * Markdown report renderer
 * Uses Nunjucks to render the report template
 */

import nunjucks from 'nunjucks';
import fs from 'fs';
import path from 'path';
import { logStage, logSuccess, getDateStamp } from './utils.js';

/**
 * Configure Nunjucks environment
 * @param {string} templatesDir - Path to templates directory
 * @returns {nunjucks.Environment} Configured environment
 */
function configureNunjucks(templatesDir) {
  const env = nunjucks.configure(templatesDir, {
    autoescape: false, // Don't escape markdown
    trimBlocks: true,
    lstripBlocks: true,
  });

  // Add custom filters
  env.addFilter('capitalize', (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  env.addFilter('upper', (str) => {
    if (!str) return '';
    return str.toUpperCase();
  });

  env.addFilter('severity_badge', (severity) => {
    const badges = {
      critical: '🔴 Critical',
      high: '🟠 High',
      medium: '🟡 Medium',
      low: '🟢 Low',
      info: 'ℹ️ Info',
    };
    return badges[(severity || 'info').toLowerCase()] || severity;
  });

  env.addFilter('status_badge', (status) => {
    const badges = {
      pass: '✅ Pass',
      fail: '❌ Fail',
      not_applicable: '➖ N/A',
      info: 'ℹ️ Info',
    };
    return badges[(status || 'info').toLowerCase()] || status;
  });

  env.addFilter('priority_badge', (priority) => {
    const badges = {
      'Now': '🚨 Now',
      'Next': '⚡ Next',
      'Later': '📋 Later',
    };
    return badges[priority] || priority;
  });

  return env;
}

/**
 * Build the context object for template rendering
 * @param {object} bundle - Scored bundle
 * @param {object} themeData - Theme engine output
 * @param {object} scoreMovement - Score movement data
 * @param {object} config - Configuration object
 * @returns {object} Template context
 */
function buildContext(bundle, themeData, scoreMovement, config) {
  const assessmentDate = getDateStamp();

  return {
    // Basic info
    customer_name: config.customer,
    tenant_id: config.tenantId,
    tenant_display_name: bundle.run?.tenant_display_name || config.customer,
    assessment_date: assessmentDate,
    team_name: config.teamName,

    // Scoring
    security_score: bundle.summary?.security_score?.score_percent || 0,
    score_details: bundle.summary?.security_score,
    score_movement: scoreMovement,

    // Counts
    counts: themeData.counts,
    total_findings: bundle.findings?.length || 0,
    failed_count: bundle.findings?.filter(f => f.status === 'fail').length || 0,
    passed_count: bundle.findings?.filter(f => f.status === 'pass').length || 0,

    // Themes and roadmap
    themes: themeData.themes,
    priority_themes: themeData.priority_themes,
    roadmap: themeData.roadmap,

    // Summary stats by status
    by_status: bundle.summary?.by_status || {},
    by_severity: bundle.summary?.by_severity || {},

    // Run metadata
    run: bundle.run,

    // Formatted values for display
    formatted: {
      score_color: getScoreColor(bundle.summary?.security_score?.score_percent || 0),
      score_grade: getScoreGrade(bundle.summary?.security_score?.score_percent || 0),
      now_count: themeData.roadmap.filter(r => r.priority === 'Now').length,
      next_count: themeData.roadmap.filter(r => r.priority === 'Next').length,
      later_count: themeData.roadmap.filter(r => r.priority === 'Later').length,
    },
  };
}

/**
 * Get color indicator for score
 * @param {number} score - Score percentage
 * @returns {string} Color name
 */
function getScoreColor(score) {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  if (score >= 40) return 'orange';
  return 'red';
}

/**
 * Get letter grade for score
 * @param {number} score - Score percentage
 * @returns {string} Letter grade
 */
function getScoreGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Render the Markdown report
 * @param {object} bundle - Scored bundle
 * @param {object} themeData - Theme engine output
 * @param {object} scoreMovement - Score movement data
 * @param {object} config - Configuration object
 * @param {object} paths - Paths object
 * @returns {string} Path to rendered report
 */
export function renderMarkdown(bundle, themeData, scoreMovement, config, paths) {
  logStage('Render MD', 'Generating Markdown report...');

  const templateFile = 'report_template_v2.md';
  const templatePath = path.join(config.templatesDir, templateFile);

  // Check if template exists
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  // Configure Nunjucks
  const env = configureNunjucks(config.templatesDir);

  // Build context
  const context = buildContext(bundle, themeData, scoreMovement, config);

  // Render template
  try {
    const rendered = env.render(templateFile, context);

    // Write to file
    fs.writeFileSync(paths.reportMdPath, rendered, 'utf8');

    logSuccess('Render MD', `Report saved to: ${paths.reportMdPath}`);
    return paths.reportMdPath;
  } catch (err) {
    throw new Error(`Failed to render Markdown template: ${err.message}`);
  }
}

/**
 * Create a default template if none exists (for development/testing)
 * @param {string} templatesDir - Templates directory
 */
export function createDefaultTemplate(templatesDir) {
  const templatePath = path.join(templatesDir, 'report_template_v2.md');

  if (fs.existsSync(templatePath)) {
    return; // Template exists
  }

  const defaultTemplate = `# Microsoft 365 Security Assessment Report

**Customer:** {{ customer_name }}
**Tenant ID:** {{ tenant_id }}
**Assessment Date:** {{ assessment_date }}
**Prepared By:** {{ team_name }}

---

## Executive Summary

This assessment evaluated the security posture of {{ customer_name }}'s Microsoft 365 environment against industry best practices and Microsoft security baselines.

### Security Score

**Overall Score: {{ security_score }}%** (Grade: {{ formatted.score_grade }})

{% if score_movement.available %}
### Score Movement

{{ score_movement.message }}

- Previous Score: {{ score_movement.previous_score }}%
- Current Score: {{ score_movement.current_score }}%
- Change: {{ score_movement.delta_signed }} points
{% else %}
### Score Movement

{{ score_movement.message }}
{% endif %}

### Risk Summary

| Severity | Count |
|----------|-------|
| Critical | {{ counts.critical }} |
| High | {{ counts.high }} |
| Medium | {{ counts.medium }} |
| Low | {{ counts.low }} |

### Key Findings

{% for theme in priority_themes %}
- **{{ theme.title }}** ({{ theme.priority }}): {{ theme.failed_count }} finding(s) requiring attention
{% endfor %}

---

## Remediation Roadmap

| Priority | Theme | Timeline | Risk Level | Findings |
|----------|-------|----------|------------|----------|
{% for item in roadmap %}
| {{ item.priority }} | {{ item.theme }} | {{ item.window }} | {{ item.risk_level | capitalize }} | {{ item.failed_count }} |
{% endfor %}

---

## Detailed Findings by Theme

{% for theme in themes %}
### {{ theme.title }}

**Priority:** {{ theme.priority }} ({{ theme.window }})
**Risk Level:** {{ theme.risk_level | capitalize }}
**Pass Rate:** {{ theme.pass_rate }}%

#### Business Context

{{ theme.business_rationale }}

#### Potential Impact

{{ theme.business_impact }}

#### Recommendation

{{ theme.recommendation_summary }}

#### Remediation Steps

{% for step in theme.remediation_steps %}
{{ loop.index }}. {{ step }}
{% endfor %}

#### Operational Considerations

{% for note in theme.operational_notes %}
- {{ note }}
{% endfor %}

#### Findings in This Theme

| Control | Status | Severity |
|---------|--------|----------|
{% for finding in theme.findings %}
| {{ finding.title | truncate(60) }} | {{ finding.status | capitalize }} | {{ finding.severity | capitalize }} |
{% endfor %}

{% if theme.failed_findings | length > 0 %}
##### Failed Controls Requiring Remediation

{% for finding in theme.failed_findings %}
- **{{ finding.title }}** ({{ finding.severity | capitalize }})
  {% if finding.recommendation %}- Recommendation: {{ finding.recommendation }}{% endif %}

{% endfor %}
{% endif %}

---

{% endfor %}

## Appendix

### Assessment Methodology

This assessment utilized ScubaGear to evaluate Microsoft 365 security configurations against CISA Secure Cloud Business Applications (SCuBA) baselines.

### Scoring Methodology

Security score is calculated using a weighted pass ratio:
- Critical findings: weight 10
- High findings: weight 7
- Medium findings: weight 4
- Low findings: weight 1

Score = (Passed Weight / Total Applicable Weight) × 100

### Disclaimer

This assessment provides a point-in-time view of the security configuration. Security is an ongoing process and regular reassessments are recommended.

---

*Report generated by m365-assess on {{ assessment_date }}*
`;

  fs.mkdirSync(templatesDir, { recursive: true });
  fs.writeFileSync(templatePath, defaultTemplate, 'utf8');
}
