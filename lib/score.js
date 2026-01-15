/**
 * Security score calculation
 * Implements weighted pass ratio scoring methodology
 */

import { logStage, logSuccess, writeJson } from './utils.js';

/**
 * Weight configuration for severity levels
 */
const SEVERITY_WEIGHTS = {
  critical: 10,
  high: 7,
  medium: 4,
  low: 1,
  info: 0,
  unknown: 0,
};

/**
 * Statuses to exclude from score calculation
 */
const EXCLUDED_STATUSES = ['not_applicable'];

/**
 * Calculate the weighted security score
 * @param {object[]} findings - Array of finding objects
 * @returns {object} Score result object
 */
export function calculateScore(findings) {
  let totalWeight = 0;
  let passedWeight = 0;

  for (const finding of findings) {
    const severity = (finding.severity || 'info').toLowerCase();
    const status = (finding.status || 'info').toLowerCase();
    const weight = SEVERITY_WEIGHTS[severity] || 0;

    // Skip excluded statuses (not_applicable) from total
    if (EXCLUDED_STATUSES.includes(status)) {
      continue;
    }

    // Skip zero-weight findings (info/unknown severity)
    if (weight === 0) {
      continue;
    }

    totalWeight += weight;

    // Only passed controls count toward the numerator
    if (status === 'pass') {
      passedWeight += weight;
    }
  }

  // Calculate percentage (avoid division by zero)
  const scorePercent = totalWeight > 0
    ? Math.round((passedWeight / totalWeight) * 100)
    : 100; // If no applicable controls, score is 100%

  return {
    method: 'weighted_pass_ratio',
    weights: { ...SEVERITY_WEIGHTS },
    excluded_statuses: [...EXCLUDED_STATUSES],
    total_weight: totalWeight,
    passed_weight: passedWeight,
    score_percent: scorePercent,
  };
}

/**
 * Calculate severity-specific counts (excluding not_applicable)
 * @param {object[]} findings - Array of finding objects
 * @returns {object} Counts by severity
 */
export function calculateCounts(findings) {
  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const finding of findings) {
    const status = (finding.status || 'info').toLowerCase();
    const severity = (finding.severity || 'info').toLowerCase();

    // Exclude not_applicable
    if (status === 'not_applicable') {
      continue;
    }

    // Only count failures for risk counts
    if (status === 'fail') {
      if (counts.hasOwnProperty(severity)) {
        counts[severity]++;
      }
    }
  }

  return counts;
}

/**
 * Apply scoring to a bundle
 * @param {object} bundle - Bundle object
 * @param {object} paths - Paths object
 * @returns {object} Scored bundle
 */
export function scoreBundle(bundle, paths) {
  logStage('Scoring', 'Calculating security score...');

  const scoreResult = calculateScore(bundle.findings);
  const counts = calculateCounts(bundle.findings);

  // Add score to bundle summary
  bundle.summary.security_score = scoreResult;
  bundle.summary.risk_counts = counts;

  // Update completion timestamp
  bundle.run.completed_at = new Date().toISOString();

  // Save scored bundle
  writeJson(paths.scoredBundlePath, bundle);

  logSuccess('Scoring', `Security Score: ${scoreResult.score_percent}%`);
  logStage('Scoring', `Passed weight: ${scoreResult.passed_weight} / Total weight: ${scoreResult.total_weight}`);
  logStage('Scoring', `Failed findings - Critical: ${counts.critical}, High: ${counts.high}, Medium: ${counts.medium}, Low: ${counts.low}`);
  logSuccess('Scoring', `Scored bundle saved to: ${paths.scoredBundlePath}`);

  return bundle;
}
