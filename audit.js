#!/usr/bin/env node

/**
 * m365-assess - Microsoft 365 Security Assessment CLI
 *
 * A wrapper/orchestrator around ScubaGear that produces
 * customer-ready Word reports with a single command.
 *
 * Usage:
 *   node tools/m365-assess/index.js --customer "Acme Corp" --tenant-id "<GUID>"
 */

import { parseArgs } from './lib/args.js';
import { runPreflightChecks } from './lib/preflight.js';
import { createRunFolder, logStage, logSuccess, logError, appendLog, getIsoTimestamp } from './lib/utils.js';
import { runScubaGear, useExistingResults } from './lib/run-scubagear.js';
import { mapToBundle } from './lib/map-to-bundle.js';
import { scoreBundle } from './lib/score.js';
import { calculateScoreMovement } from './lib/score-movement.js';
import { processThemes } from './lib/theme-engine.js';
import { renderDocxNative } from './lib/render-docx-native.js';

/**
 * Print banner
 */
function printBanner() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           m365-assess - M365 Security Assessment             ║
║         Automated ScubaGear Wrapper with Reporting           ║
╚══════════════════════════════════════════════════════════════╝
`);
}

/**
 * Print final summary
 * @param {object} paths - Paths object
 * @param {object} bundle - Scored bundle
 * @param {number} startTime - Start time in ms
 */
function printSummary(paths, bundle, startTime) {
  const duration = Math.round((Date.now() - startTime) / 1000);
  const score = bundle.summary?.security_score?.score_percent || 0;

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    Assessment Complete                       ║
╚══════════════════════════════════════════════════════════════╝

  Security Score: ${score}%

  Output Files:
  ─────────────
  📁 Run Folder:    ${paths.runFolder}
  📄 Raw Results:   ${paths.rawScubaGearDir}/results.json
  📋 Bundle:        ${paths.bundlePath}
  📋 Scored Bundle: ${paths.scoredBundlePath}
  📑 Report (DOCX): ${paths.reportDocxPath}
  📜 Log:           ${paths.logPath}

  Duration: ${duration} seconds
`);
}

/**
 * Main execution function
 */
async function main() {
  const startTime = Date.now();

  try {
    printBanner();

    // Parse CLI arguments
    logStage('Initialize', 'Parsing arguments...');
    const config = parseArgs();
    logStage('Initialize', `Customer: ${config.customer}`);
    logStage('Initialize', `Tenant ID: ${config.tenantId}`);

    // Run preflight checks
    const preflightResults = runPreflightChecks(config);

    // Create run folder structure
    logStage('Initialize', 'Creating run folder...');
    const paths = createRunFolder(config.outputDir, config.customer);
    logSuccess('Initialize', `Run folder: ${paths.runFolder}`);

    // Initialize log
    appendLog(paths.logPath, '=== m365-assess run started ===');
    appendLog(paths.logPath, `Customer: ${config.customer}`);
    appendLog(paths.logPath, `Tenant: ${config.tenantId}`);
    appendLog(paths.logPath, `Started: ${getIsoTimestamp()}`);

    // Step 1: Run ScubaGear (or use existing results)
    let resultsPath;
    if (config.skipScubaGear && config.scubagearResults) {
      resultsPath = useExistingResults(config.scubagearResults, paths);
    } else {
      resultsPath = await runScubaGear(config, paths, preflightResults.scubagearModulePath);
    }

    // Step 2: Map to canonical bundle
    const bundle = mapToBundle(resultsPath, config, paths);

    // Step 3: Calculate security score
    const scoredBundle = scoreBundle(bundle, paths);

    // Step 4: Calculate score movement
    const scoreMovement = calculateScoreMovement(scoredBundle, config.previousPath);

    // Step 5: Process themes
    const themeData = processThemes(scoredBundle);

    // Step 6: Generate Word document directly from JSON
    await renderDocxNative(scoredBundle, themeData, scoreMovement, config, paths);

    // Final log entry
    appendLog(paths.logPath, `Completed: ${getIsoTimestamp()}`);
    appendLog(paths.logPath, `Security Score: ${scoredBundle.summary?.security_score?.score_percent}%`);
    appendLog(paths.logPath, '=== m365-assess run completed successfully ===');

    // Print summary
    printSummary(paths, scoredBundle, startTime);

    process.exit(0);
  } catch (err) {
    logError('Error', err.message);
    console.error('\nStack trace:');
    console.error(err.stack);
    process.exit(1);
  }
}

// Run main function
main();
