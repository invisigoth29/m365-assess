/**
 * Score movement calculation
 * Compares current score with previous assessment
 */

import { readJson, logStage, logSuccess, fileExists } from './utils.js';

/**
 * Calculate score movement between current and previous assessments
 * @param {object} currentBundle - Current scored bundle
 * @param {string|null} previousPath - Path to previous bundle.scored.json
 * @returns {object} Score movement object
 */
export function calculateScoreMovement(currentBundle, previousPath) {
  logStage('Score Movement', 'Calculating score delta...');

  const currentScore = currentBundle.summary?.security_score?.score_percent;

  // No previous assessment provided
  if (!previousPath) {
    logStage('Score Movement', 'No previous assessment provided');
    return {
      available: false,
      message: 'Not available (no prior assessment provided).',
      current_score: currentScore,
      previous_score: null,
      previous_assessment_date: null,
      delta: null,
      delta_signed: null,
    };
  }

  // Check if previous file exists
  if (!fileExists(previousPath)) {
    logStage('Score Movement', `Previous bundle not found: ${previousPath}`);
    return {
      available: false,
      message: `Previous assessment not found at: ${previousPath}`,
      current_score: currentScore,
      previous_score: null,
      previous_assessment_date: null,
      delta: null,
      delta_signed: null,
    };
  }

  try {
    const previousBundle = readJson(previousPath);

    // Extract previous score
    const previousScore = previousBundle.summary?.security_score?.score_percent;
    if (typeof previousScore !== 'number') {
      logStage('Score Movement', 'Previous bundle does not contain a valid score');
      return {
        available: false,
        message: 'Previous assessment does not contain a valid security score.',
        current_score: currentScore,
        previous_score: null,
        previous_assessment_date: null,
        delta: null,
        delta_signed: null,
      };
    }

    // Extract previous assessment date
    const previousDate = previousBundle.run?.completed_at
      || previousBundle.run?.started_at
      || 'previous assessment';

    // Format date if it's an ISO string
    let displayDate = previousDate;
    if (previousDate && previousDate !== 'previous assessment') {
      try {
        const d = new Date(previousDate);
        displayDate = d.toISOString().split('T')[0]; // YYYY-MM-DD
      } catch {
        displayDate = previousDate;
      }
    }

    // Calculate delta
    const delta = currentScore - previousScore;
    let deltaSigned;
    if (delta > 0) {
      deltaSigned = `+${delta}`;
    } else if (delta < 0) {
      deltaSigned = `${delta}`;
    } else {
      deltaSigned = '0';
    }

    // Determine trend description
    let trendDescription;
    if (delta > 0) {
      trendDescription = `Improved by ${delta} points since ${displayDate}`;
    } else if (delta < 0) {
      trendDescription = `Decreased by ${Math.abs(delta)} points since ${displayDate}`;
    } else {
      trendDescription = `No change since ${displayDate}`;
    }

    logSuccess('Score Movement', `Score delta: ${deltaSigned} (${previousScore}% → ${currentScore}%)`);

    return {
      available: true,
      message: trendDescription,
      current_score: currentScore,
      previous_score: previousScore,
      previous_assessment_date: displayDate,
      delta: delta,
      delta_signed: deltaSigned,
    };
  } catch (err) {
    logStage('Score Movement', `Error reading previous bundle: ${err.message}`);
    return {
      available: false,
      message: `Error reading previous assessment: ${err.message}`,
      current_score: currentScore,
      previous_score: null,
      previous_assessment_date: null,
      delta: null,
      delta_signed: null,
    };
  }
}
