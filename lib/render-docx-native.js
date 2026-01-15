/**
 * Native DOCX renderer using docxtemplater
 * Generates Word documents directly from JSON context
 */

import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { logStage, logSuccess, logError, appendLog, fileExists, getDateStamp } from './utils.js';

/**
 * Build the context object for DOCX template rendering
 * @param {object} bundle - Scored bundle
 * @param {object} themeData - Theme engine output
 * @param {object} scoreMovement - Score movement data
 * @param {object} config - Configuration object
 * @returns {object} Template context
 */
function buildDocxContext(bundle, themeData, scoreMovement, config) {
  const assessmentDate = getDateStamp();
  const securityScore = bundle.summary?.security_score?.score_percent || 0;

  // Helper to get risk level text
  const getRiskLevel = (score) => {
    if (score >= 80) return 'Low - Good Security Posture';
    if (score >= 60) return 'Moderate - Improvement Needed';
    if (score >= 40) return 'High - Significant Gaps';
    return 'Critical - Immediate Action Required';
  };

  // Helper to get assessment summary text
  const getAssessmentSummary = (score) => {
    if (score >= 80) {
      return 'The organization demonstrates a strong security posture with most controls properly configured. Focus remediation efforts on the remaining high-priority items identified below.';
    }
    if (score >= 60) {
      return 'The organization has foundational security controls in place but significant gaps remain that could be exploited by threat actors. Prioritized remediation is recommended.';
    }
    if (score >= 40) {
      return "The organization's security posture requires substantial improvement. Multiple critical and high-severity gaps were identified that pose significant risk.";
    }
    return "The organization's Microsoft 365 environment has critical security gaps that require immediate attention. The current configuration leaves the environment vulnerable to common attack vectors.";
  };

  // Calculate control counts
  const totalFindings = bundle.findings?.length || 0;
  const failedCount = bundle.findings?.filter(f => f.status === 'fail').length || 0;
  const passedCount = bundle.findings?.filter(f => f.status === 'pass').length || 0;
  const naCount = totalFindings - passedCount - failedCount;

  // Business impact flags
  const hasHighRisks = (themeData.counts?.critical || 0) > 0 || (themeData.counts?.high || 0) > 0;

  return {
    // Basic info
    customer_name: config.customer,
    tenant_id: config.tenantId,
    assessment_date: assessmentDate,
    team_name: config.teamName || 'Security Team',
    
    // Scoring
    security_score: securityScore,
    risk_level: getRiskLevel(securityScore),
    assessment_summary: getAssessmentSummary(securityScore),
    
    // Score movement
    has_score_movement: scoreMovement?.available || false,
    score_movement_message: scoreMovement?.message || 'Not available (no prior assessment provided).',
    previous_score: scoreMovement?.previous_score || 0,
    current_score: scoreMovement?.current_score || securityScore,
    score_delta: scoreMovement?.delta_signed || '',
    previous_date: scoreMovement?.previous_assessment_date || '',
    
    // Risk summary counts
    critical_count: themeData.counts?.critical || 0,
    high_count: themeData.counts?.high || 0,
    medium_count: themeData.counts?.medium || 0,
    low_count: themeData.counts?.low || 0,
    
    // Controls assessment
    total_findings: totalFindings,
    passed_count: passedCount,
    failed_count: failedCount,
    na_count: naCount,
    
    // Business impact
    has_high_risks: hasHighRisks,
    show_positive_posture: !hasHighRisks,
    
    // Priority areas
    priority_themes: themeData.priority_themes || [],
    
    // Roadmap
    roadmap: themeData.roadmap || [],
    
    // Detailed themes
    themes: themeData.themes || [],
    
    // Run metadata
    run_id: bundle.run?.id || '',
  };
}

/**
 * Render DOCX document directly from JSON using docxtemplater
 * @param {object} bundle - Scored bundle
 * @param {object} themeData - Theme engine output
 * @param {object} scoreMovement - Score movement data
 * @param {object} config - Configuration object
 * @param {object} paths - Paths object
 * @returns {Promise<string>} Path to generated DOCX
 */
export async function renderDocxNative(bundle, themeData, scoreMovement, config, paths) {
  logStage('Render DOCX', 'Generating Word document from template...');

  const templatePath = path.join(config.templatesDir, 'report_template.docx');

  // Check if template exists
  if (!fileExists(templatePath)) {
    throw new Error(`DOCX template not found: ${templatePath}`);
  }

  try {
    // Load the template
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    
    // Create docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });

    // Build context
    const context = buildDocxContext(bundle, themeData, scoreMovement, config);

    // Render the document
    doc.render(context);

    // Generate buffer
    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    // Write to file
    fs.writeFileSync(paths.reportDocxPath, buf);

    // Log success
    const stats = fs.statSync(paths.reportDocxPath);
    const fileSizeKB = Math.round(stats.size / 1024);
    
    logSuccess('Render DOCX', `Word document created: ${paths.reportDocxPath} (${fileSizeKB} KB)`);
    
    if (paths.logPath) {
      appendLog(paths.logPath, `DOCX created successfully: ${paths.reportDocxPath} (${fileSizeKB} KB)`);
    }

    return paths.reportDocxPath;
  } catch (err) {
    logError('Render DOCX', `Failed to generate DOCX: ${err.message}`);
    
    // Provide helpful error messages for common issues
    if (err.properties && err.properties.errors) {
      const errors = err.properties.errors;
      errors.forEach((error) => {
        logError('Render DOCX', `  ${error.message} at ${error.offset}`);
      });
    }
    
    throw new Error(`Failed to render DOCX template: ${err.message}`);
  }
}
