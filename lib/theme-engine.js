/**
 * Theme engine for grouping and prioritizing findings
 * Maps findings to security themes and generates report-ready data
 */

import { logStage, logSuccess } from './utils.js';

/**
 * Theme definitions with static content for v0
 * Easily extensible for future versions
 */
const THEME_DEFINITIONS = {
  'THEME.IDENTITY.ATO_REDUCTION': {
    id: 'THEME.IDENTITY.ATO_REDUCTION',
    title: 'Account Takeover Reduction',
    business_rationale: 'Account takeover (ATO) attacks are a primary vector for unauthorized access to organizational resources. Implementing strong authentication controls significantly reduces the attack surface and protects sensitive data from credential-based attacks.',
    business_impact: 'Successful account takeover can lead to data breaches, financial fraud, lateral movement within the organization, and regulatory compliance violations. The average cost of a credential-based breach continues to rise year over year.',
    recommendation_summary: 'Implement and enforce multi-factor authentication across all user accounts, eliminate legacy authentication protocols, and deploy conditional access policies to protect against credential theft and replay attacks.',
    remediation_steps: [
      'Enable MFA for all users, prioritizing administrators and privileged accounts',
      'Block legacy authentication protocols that bypass MFA',
      'Configure conditional access policies requiring compliant devices',
      'Implement password protection and banned password lists',
      'Enable sign-in risk policies to detect anomalous authentication attempts',
    ],
    operational_notes: [
      'Plan MFA rollout in phases to minimize user disruption',
      'Communicate changes to users with clear instructions and support resources',
      'Monitor authentication logs for failed MFA attempts and blocked legacy auth',
      'Establish break-glass accounts with documented procedures',
    ],
    is_initial_access: true,
  },
  'THEME.IDENTITY.PRIVILEGED_ACCESS_GOVERNANCE': {
    id: 'THEME.IDENTITY.PRIVILEGED_ACCESS_GOVERNANCE',
    title: 'Privileged Access Governance',
    business_rationale: 'Privileged accounts pose the highest risk when compromised due to their elevated permissions. Proper governance ensures that administrative access is granted only when needed and monitored continuously.',
    business_impact: 'Compromised admin accounts can result in complete tenant takeover, data exfiltration at scale, persistence establishment, and destruction of audit trails. Recovery from admin-level breaches is significantly more costly and time-consuming.',
    recommendation_summary: 'Implement just-in-time privileged access, minimize standing admin permissions, and establish robust monitoring for administrative activities.',
    remediation_steps: [
      'Deploy Privileged Identity Management (PIM) for just-in-time access',
      'Audit and minimize permanent global administrator assignments',
      'Implement role-based access control with least privilege',
      'Configure alerts for privileged role activations',
      'Review and restrict application consent permissions',
    ],
    operational_notes: [
      'Document all privileged role holders and their business justification',
      'Conduct quarterly access reviews for privileged roles',
      'Ensure PIM approval workflows include appropriate stakeholders',
      'Maintain emergency access accounts outside of PIM with monitoring',
    ],
    is_initial_access: true,
  },
  'THEME.EMAIL.PHISHING_RESILIENCE': {
    id: 'THEME.EMAIL.PHISHING_RESILIENCE',
    title: 'Phishing Resilience',
    business_rationale: 'Email remains the primary delivery mechanism for phishing attacks, malware, and business email compromise. Strengthening email security controls directly reduces the likelihood of successful social engineering attacks.',
    business_impact: 'Phishing attacks can result in credential theft, malware installation, financial fraud through business email compromise, and initial access for ransomware operators. Email-borne threats are consistently among the top incident types.',
    recommendation_summary: 'Implement comprehensive email authentication (SPF, DKIM, DMARC), deploy advanced threat protection for links and attachments, and configure anti-impersonation policies.',
    remediation_steps: [
      'Configure SPF, DKIM, and DMARC with enforcement policies',
      'Enable Safe Links and Safe Attachments policies',
      'Configure anti-phishing policies with impersonation protection',
      'Implement external sender tagging and warnings',
      'Review and optimize spam and malware filter policies',
    ],
    operational_notes: [
      'Monitor DMARC reports to identify authentication failures',
      'Review quarantine regularly and tune policies to reduce false positives',
      'Conduct phishing simulations to measure user awareness',
      'Establish clear procedures for users to report suspicious emails',
    ],
    is_initial_access: true,
  },
  'THEME.GOVERNANCE.AUDIT_AND_VISIBILITY': {
    id: 'THEME.GOVERNANCE.AUDIT_AND_VISIBILITY',
    title: 'Audit and Visibility',
    business_rationale: 'Comprehensive logging and monitoring capabilities are essential for detecting security incidents, conducting investigations, and maintaining compliance. Without proper audit trails, threat detection and incident response are severely hampered.',
    business_impact: 'Insufficient logging results in blind spots that attackers exploit to operate undetected. Lack of visibility prolongs dwell time, increases breach impact, and may result in regulatory penalties for non-compliance with audit requirements.',
    recommendation_summary: 'Enable unified audit logging across all workloads, configure appropriate retention periods, and establish alerting for high-risk activities.',
    remediation_steps: [
      'Enable Unified Audit Log with appropriate retention',
      'Configure mailbox auditing for all mailboxes',
      'Enable sign-in and audit logs in Azure AD',
      'Set up alerts for suspicious activities and high-risk events',
      'Review and enable diagnostic settings for key services',
    ],
    operational_notes: [
      'Determine retention requirements based on compliance and operational needs',
      'Consider SIEM integration for centralized monitoring',
      'Document log sources and what activities each captures',
      'Test log availability by conducting periodic audit log queries',
    ],
    is_initial_access: false,
  },
};

/**
 * Severity ranking for comparison
 */
const SEVERITY_RANK = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

/**
 * Determine the maximum severity among findings
 * @param {object[]} findings - Array of findings
 * @returns {string} Maximum severity
 */
function getMaxSeverity(findings) {
  let maxRank = -1;
  let maxSeverity = 'info';

  for (const finding of findings) {
    const severity = (finding.severity || 'info').toLowerCase();
    const rank = SEVERITY_RANK[severity] || 0;
    if (rank > maxRank) {
      maxRank = rank;
      maxSeverity = severity;
    }
  }

  return maxSeverity;
}

/**
 * Count severities among failed findings
 * @param {object[]} findings - Array of findings
 * @returns {object} Severity counts
 */
function countSeverities(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) {
    if (finding.status === 'fail') {
      const sev = (finding.severity || 'info').toLowerCase();
      if (counts.hasOwnProperty(sev)) {
        counts[sev]++;
      }
    }
  }
  return counts;
}

/**
 * Determine priority (Now/Next/Later) based on theme and findings
 * @param {object} themeDef - Theme definition
 * @param {object[]} findings - Theme's findings
 * @returns {string} Priority level
 */
function determinePriority(themeDef, findings) {
  const maxSeverity = getMaxSeverity(findings.filter(f => f.status === 'fail'));
  const isInitialAccess = themeDef.is_initial_access;

  // Now: Critical/High findings OR identity/email initial access themes
  if (maxSeverity === 'critical' || maxSeverity === 'high' || isInitialAccess) {
    // Check if there are actual failures
    const hasFailures = findings.some(f => f.status === 'fail');
    if (hasFailures) {
      return 'Now';
    }
    // If no failures but is initial access theme, still prioritize but lower
    if (isInitialAccess) {
      return 'Next';
    }
  }

  // Next: Mostly medium severity
  if (maxSeverity === 'medium') {
    return 'Next';
  }

  // Later: Only low/info
  return 'Later';
}

/**
 * Map priority to time window
 * @param {string} priority - Priority level
 * @returns {string} Time window
 */
function priorityToWindow(priority) {
  switch (priority) {
    case 'Now': return '0-30 days';
    case 'Next': return '30-60 days';
    case 'Later': return '60-90 days';
    default: return '60-90 days';
  }
}

/**
 * Process findings and generate themed report data
 * @param {object} bundle - Scored bundle
 * @returns {object} Theme engine output
 */
export function processThemes(bundle) {
  logStage('Themes', 'Processing findings into themes...');

  const findings = bundle.findings || [];

  // Group findings by theme
  const themeGroups = {};
  for (const finding of findings) {
    const themeId = finding.theme_id || 'THEME.GOVERNANCE.AUDIT_AND_VISIBILITY';
    if (!themeGroups[themeId]) {
      themeGroups[themeId] = [];
    }
    themeGroups[themeId].push(finding);
  }

  // Process each theme
  const themes = [];
  const roadmap = [];
  const priorityThemes = [];

  for (const [themeId, themeFindings] of Object.entries(themeGroups)) {
    // Get theme definition (use default if not found)
    const themeDef = THEME_DEFINITIONS[themeId] || {
      id: themeId,
      title: themeId.replace(/^THEME\./i, '').replace(/[._]/g, ' '),
      business_rationale: 'Security controls in this category help protect organizational assets.',
      business_impact: 'Gaps in this area may expose the organization to security risks.',
      recommendation_summary: 'Review and remediate findings in this category according to severity.',
      remediation_steps: ['Review each finding', 'Implement recommended controls', 'Validate remediation'],
      operational_notes: ['Monitor for compliance drift', 'Schedule periodic reviews'],
      is_initial_access: false,
    };

    const sevCounts = countSeverities(themeFindings);
    const maxSeverity = getMaxSeverity(themeFindings.filter(f => f.status === 'fail'));
    const priority = determinePriority(themeDef, themeFindings);
    const window = priorityToWindow(priority);

    // Calculate pass rate for theme
    const applicable = themeFindings.filter(f => f.status !== 'not_applicable');
    const passed = applicable.filter(f => f.status === 'pass');
    const passRate = applicable.length > 0
      ? Math.round((passed.length / applicable.length) * 100)
      : 100;

    const theme = {
      id: themeId,
      title: themeDef.title,
      risk_level: maxSeverity === 'info' ? 'low' : maxSeverity,
      priority: priority,
      window: window,
      effort: 'Medium', // Default for v0
      pass_rate: passRate,
      business_rationale: themeDef.business_rationale,
      business_impact: themeDef.business_impact,
      recommendation_summary: themeDef.recommendation_summary,
      remediation_steps: themeDef.remediation_steps,
      operational_notes: themeDef.operational_notes,
      severity_counts: sevCounts,
      findings: themeFindings.map(f => ({
        finding_id: f.finding_id,
        title: f.title,
        severity: f.severity,
        status: f.status,
        control_id: f.control_id,
      })),
      failed_findings: themeFindings
        .filter(f => f.status === 'fail')
        .map(f => ({
          finding_id: f.finding_id,
          title: f.title,
          severity: f.severity,
          control_id: f.control_id,
          recommendation: f.evidence?.recommendation || null,
        })),
    };

    themes.push(theme);

    // Add to roadmap
    roadmap.push({
      priority: priority,
      theme: themeDef.title,
      theme_id: themeId,
      window: window,
      risk_level: theme.risk_level,
      failed_count: theme.failed_findings.length,
    });

    // Track priority themes for exec summary
    if (priority === 'Now' || priority === 'Next') {
      priorityThemes.push({
        title: themeDef.title,
        priority: priority,
        risk_level: theme.risk_level,
        failed_count: theme.failed_findings.length,
      });
    }
  }

  // Sort themes by priority (Now first, then Next, then Later)
  const priorityOrder = { 'Now': 0, 'Next': 1, 'Later': 2 };
  themes.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  roadmap.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  priorityThemes.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Calculate overall counts (excluding not_applicable)
  const applicableFindings = findings.filter(f => f.status !== 'not_applicable');
  const failedFindings = findings.filter(f => f.status === 'fail');
  const counts = {
    critical: failedFindings.filter(f => f.severity === 'critical').length,
    high: failedFindings.filter(f => f.severity === 'high').length,
    medium: failedFindings.filter(f => f.severity === 'medium').length,
    low: failedFindings.filter(f => f.severity === 'low').length,
  };

  logSuccess('Themes', `Processed ${themes.length} themes`);
  logStage('Themes', `Priority breakdown - Now: ${roadmap.filter(r => r.priority === 'Now').length}, Next: ${roadmap.filter(r => r.priority === 'Next').length}, Later: ${roadmap.filter(r => r.priority === 'Later').length}`);

  return {
    themes,
    roadmap,
    priority_themes: priorityThemes,
    counts,
  };
}
