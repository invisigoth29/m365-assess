/**
 * Map ScubaGear results to canonical bundle format
 * Transforms raw ScubaGear JSON into normalized findings
 */

import {
  readJson,
  writeJson,
  logStage,
  logSuccess,
  normalizeSeverity,
  normalizeStatus,
  hashString,
  getIsoTimestamp,
} from './utils.js';

/**
 * Theme mapping rules based on keywords in control names/descriptions
 * Maps keywords to theme IDs
 */
const THEME_KEYWORD_RULES = [
  // Identity - Account Takeover Reduction
  {
    themeId: 'THEME.IDENTITY.ATO_REDUCTION',
    keywords: [
      'mfa', 'multi-factor', 'multifactor', 'authentication', 'password',
      'sign-in', 'signin', 'login', 'logon', 'credential', 'conditional access',
      'legacy auth', 'block legacy', 'brute force', 'lockout', 'strong auth',
      'passwordless', 'fido', 'authenticator', 'otp', 'totp', 'sms',
    ],
  },
  // Identity - Privileged Access Governance
  {
    themeId: 'THEME.IDENTITY.PRIVILEGED_ACCESS_GOVERNANCE',
    keywords: [
      'admin', 'global admin', 'privileged', 'pim', 'pam', 'role',
      'least privilege', 'just-in-time', 'jit', 'elevation', 'permanent',
      'standing access', 'break glass', 'emergency', 'service account',
      'application permissions', 'consent', 'app registration', 'delegated',
    ],
  },
  // Email - Phishing Resilience
  {
    themeId: 'THEME.EMAIL.PHISHING_RESILIENCE',
    keywords: [
      'phish', 'spf', 'dkim', 'dmarc', 'anti-spam', 'anti-phish',
      'safe link', 'safe attachment', 'atp', 'defender for office',
      'mail flow', 'transport rule', 'external sender', 'impersonation',
      'spoofing', 'spoof', 'email authentication', 'quarantine',
      'malware', 'malicious', 'attachment', 'zap', 'zero-hour',
    ],
  },
  // Governance - Audit and Visibility
  {
    themeId: 'THEME.GOVERNANCE.AUDIT_AND_VISIBILITY',
    keywords: [
      'audit', 'log', 'logging', 'monitor', 'alert', 'unified audit',
      'mailbox audit', 'sign-in log', 'activity', 'retention',
      'compliance', 'ediscovery', 'legal hold', 'dlp', 'data loss',
      'sensitivity label', 'classification', 'information protection',
      'microsoft purview', 'security center', 'sentinel',
    ],
  },
];

/**
 * Determine theme ID based on control title/description
 * @param {string} title - Control title
 * @param {string} description - Control description
 * @param {string} product - Product name (e.g., 'AAD', 'EXO')
 * @returns {string} Theme ID
 */
function determineThemeId(title, description, product) {
  const searchText = `${title} ${description} ${product}`.toLowerCase();

  // Check each theme's keywords
  for (const rule of THEME_KEYWORD_RULES) {
    for (const keyword of rule.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return rule.themeId;
      }
    }
  }

  // Default assignment based on product
  const productLower = (product || '').toLowerCase();
  if (productLower.includes('aad') || productLower.includes('entra') || productLower.includes('azure ad')) {
    return 'THEME.IDENTITY.ATO_REDUCTION';
  }
  if (productLower.includes('exo') || productLower.includes('exchange') || productLower.includes('defender')) {
    return 'THEME.EMAIL.PHISHING_RESILIENCE';
  }

  // Ultimate fallback
  return 'THEME.GOVERNANCE.AUDIT_AND_VISIBILITY';
}

/**
 * Extract capabilities/tags from control
 * @param {string} title - Control title
 * @param {string} product - Product name
 * @returns {string[]} Array of capability tags
 */
function extractCapabilities(title, product) {
  const caps = [];

  // Add product as capability
  if (product) {
    caps.push(product);
  }

  // Extract common capability patterns
  const titleLower = title.toLowerCase();
  if (titleLower.includes('mfa') || titleLower.includes('multi-factor')) caps.push('MFA');
  if (titleLower.includes('conditional access')) caps.push('Conditional Access');
  if (titleLower.includes('password')) caps.push('Password Policy');
  if (titleLower.includes('audit') || titleLower.includes('log')) caps.push('Auditing');
  if (titleLower.includes('admin') || titleLower.includes('privileged')) caps.push('Admin Security');
  if (titleLower.includes('phish') || titleLower.includes('safe')) caps.push('Anti-Phishing');

  // Limit to 3 capabilities
  return [...new Set(caps)].slice(0, 3);
}

/**
 * Map a single ScubaGear control to canonical finding format
 * @param {object} control - Raw ScubaGear control object
 * @param {string} product - Product name
 * @param {number} index - Index for ID generation
 * @returns {object} Canonical finding object
 */
function mapControl(control, product, index) {
  // ScubaGear control structure may vary - handle multiple formats
  // Note: ScubaGear uses field names with spaces like "Control ID", "Result"
  const controlId = control['Control ID'] || control.Control || control.ControlId || control.PolicyId || `CTRL-${index}`;
  const title = control.Requirement || control['Control ID'] || control.ControlName || control.Description || controlId;
  const description = control.Description || control.Requirement || title;
  const rawStatus = control.Result || control.Status || control.Compliance || 'info';
  const rawSeverity = control.Criticality || control.Severity || control.Impact || 'medium';

  const status = normalizeStatus(rawStatus);
  const severity = normalizeSeverity(rawSeverity);
  const themeId = determineThemeId(title, description, product);

  // Generate a stable finding ID
  const idSource = `${product}-${controlId}-${title}`.toLowerCase();
  const findingId = `FIND-${hashString(idSource)}`;

  return {
    finding_id: findingId,
    control_id: controlId,
    title: title,
    description: description,
    status: status,
    severity: severity,
    theme_id: themeId,
    capabilities: extractCapabilities(title, product),
    product: product,
    source: {
      tool: 'ScubaGear',
      original_id: controlId,
      raw: control,
    },
    evidence: {
      details: control.Details || control.ActualValue || null,
      recommendation: control.Recommendation || control.Remediation || null,
      reference: control.Reference || control.PolicyLink || null,
    },
  };
}

/**
 * Parse ScubaGear results and extract controls
 * Handles different ScubaGear output formats
 * @param {object} rawResults - Raw ScubaGear JSON
 * @returns {object[]} Array of control objects with product info
 */
function extractControls(rawResults) {
  const controls = [];

  // ScubaGear outputs results organized by product
  // Common structure: { ProductName: { Controls: [...] } }
  // Or: { Results: { ProductName: [...] } }

  // Try different known structures
  if (rawResults.Results) {
    // Format: { Results: { AAD: [...], EXO: [...], ... } }
    for (const [product, productResults] of Object.entries(rawResults.Results)) {
      if (Array.isArray(productResults)) {
        // Each element might be a group with Controls array inside
        for (const item of productResults) {
          if (item.Controls && Array.isArray(item.Controls)) {
            // ScubaGear format: Groups with Controls inside
            for (const ctrl of item.Controls) {
              controls.push({ ...ctrl, _product: product, _group: item.GroupName });
            }
          } else {
            // Direct control object
            controls.push({ ...item, _product: product });
          }
        }
      } else if (productResults && typeof productResults === 'object') {
        // Nested structure
        if (productResults.Controls && Array.isArray(productResults.Controls)) {
          for (const ctrl of productResults.Controls) {
            controls.push({ ...ctrl, _product: product });
          }
        }
      }
    }
  }

  // Try direct product keys at root level
  const productKeys = ['AAD', 'EXO', 'Defender', 'OneDrive', 'SharePoint', 'Teams', 'PowerPlatform'];
  for (const product of productKeys) {
    if (rawResults[product]) {
      const productData = rawResults[product];
      if (Array.isArray(productData)) {
        for (const ctrl of productData) {
          controls.push({ ...ctrl, _product: product });
        }
      } else if (productData.Controls && Array.isArray(productData.Controls)) {
        for (const ctrl of productData.Controls) {
          controls.push({ ...ctrl, _product: product });
        }
      }
    }
  }

  // Try array at root
  if (Array.isArray(rawResults)) {
    for (const ctrl of rawResults) {
      controls.push({ ...ctrl, _product: ctrl.Product || 'Unknown' });
    }
  }

  // Try Controls array at root
  if (rawResults.Controls && Array.isArray(rawResults.Controls)) {
    for (const ctrl of rawResults.Controls) {
      controls.push({ ...ctrl, _product: ctrl.Product || 'Unknown' });
    }
  }

  // If still no controls found, try to extract from any array property
  if (controls.length === 0) {
    for (const [key, value] of Object.entries(rawResults)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
        // Looks like an array of controls
        for (const ctrl of value) {
          controls.push({ ...ctrl, _product: key });
        }
      }
    }
  }

  return controls;
}

/**
 * Map ScubaGear results to canonical bundle format
 * @param {string} resultsPath - Path to ScubaGear results JSON
 * @param {object} config - Configuration object
 * @param {object} paths - Paths object
 * @returns {object} Bundle object
 */
export function mapToBundle(resultsPath, config, paths) {
  logStage('Mapping', 'Converting ScubaGear results to canonical format...');

  const rawResults = readJson(resultsPath);
  const startTime = getIsoTimestamp();

  // Extract controls from the raw results
  const rawControls = extractControls(rawResults);
  logStage('Mapping', `Found ${rawControls.length} controls in ScubaGear output`);

  // Map each control to canonical finding format
  const findings = rawControls.map((ctrl, index) => {
    return mapControl(ctrl, ctrl._product, index);
  });

  // Build the bundle
  const bundle = {
    schema_version: '1.0.0',
    run: {
      id: paths.runId || `run-${Date.now()}`,
      customer: config.customer,
      tenant_id: config.tenantId,
      tenant_display_name: config.customer, // May be overridden if we can extract from results
      started_at: startTime,
      completed_at: null, // Will be set later
      executed_from: 'macos',
      mode: 'interactive',
      tool: {
        name: 'ScubaGear',
        wrapper: 'm365-assess',
        wrapper_version: '1.0.0',
      },
    },
    findings: findings,
    summary: {
      total_findings: findings.length,
      by_status: {
        pass: findings.filter(f => f.status === 'pass').length,
        fail: findings.filter(f => f.status === 'fail').length,
        not_applicable: findings.filter(f => f.status === 'not_applicable').length,
        info: findings.filter(f => f.status === 'info').length,
      },
      by_severity: {
        critical: findings.filter(f => f.severity === 'critical').length,
        high: findings.filter(f => f.severity === 'high').length,
        medium: findings.filter(f => f.severity === 'medium').length,
        low: findings.filter(f => f.severity === 'low').length,
        info: findings.filter(f => f.severity === 'info').length,
      },
      by_theme: {},
      security_score: null, // Will be computed by score.js
    },
  };

  // Compute by_theme counts
  const themeGroups = {};
  for (const finding of findings) {
    if (!themeGroups[finding.theme_id]) {
      themeGroups[finding.theme_id] = [];
    }
    themeGroups[finding.theme_id].push(finding);
  }
  for (const [themeId, themeFindings] of Object.entries(themeGroups)) {
    bundle.summary.by_theme[themeId] = themeFindings.length;
  }

  // Save the bundle
  writeJson(paths.bundlePath, bundle);
  logSuccess('Mapping', `Bundle saved to: ${paths.bundlePath}`);
  logStage('Mapping', `Mapped ${findings.length} findings across ${Object.keys(themeGroups).length} themes`);

  return bundle;
}
