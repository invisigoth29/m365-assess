/**
 * ScubaGear execution wrapper
 * Runs ScubaGear via PowerShell and captures output
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logStage, logError, logSuccess, appendLog, fileExists, dirExists } from './utils.js';

/**
 * Find the most recent ScubaGear results JSON in a directory
 * ScubaGear outputs to a timestamped folder, so we need to discover it
 * @param {string} outputDir - Directory where ScubaGear wrote output
 * @returns {string|null} Path to results JSON or null
 */
function findScubaGearResults(outputDir) {
  if (!dirExists(outputDir)) {
    return null;
  }

  // Look for ScubaResults*.json or similar patterns
  const patterns = [
    /ScubaResults.*\.json$/i,
    /results.*\.json$/i,
    /.*Report.*\.json$/i,
    /.*Output.*\.json$/i,
  ];

  // Get all files recursively
  function walkDir(dir, results = []) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath, results);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          results.push(fullPath);
        }
      }
    } catch {
      // Ignore permission errors
    }
    return results;
  }

  const allJsonFiles = walkDir(outputDir);

  // Sort by modification time (most recent first)
  const sortedFiles = allJsonFiles
    .map(f => ({ path: f, mtime: fs.statSync(f).mtime }))
    .sort((a, b) => b.mtime - a.mtime);

  // Find first matching file
  for (const { path: filePath } of sortedFiles) {
    const filename = path.basename(filePath);
    for (const pattern of patterns) {
      if (pattern.test(filename)) {
        return filePath;
      }
    }
  }

  // If no pattern matches, return the most recent JSON
  if (sortedFiles.length > 0) {
    return sortedFiles[0].path;
  }

  return null;
}

/**
 * Build the PowerShell command to run ScubaGear
 * @param {object} options - Options object
 * @returns {string} PowerShell command
 */
function buildPowerShellCommand(options) {
  const { modulePath, tenantId, outputPath } = options;
  const moduleDir = path.dirname(modulePath);

  // Build the PowerShell script
  // Uses Invoke-SCuBA which is the main entry point for ScubaGear
  const script = `
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'

# Import the ScubaGear module
Import-Module "${modulePath}" -Force -WarningAction SilentlyContinue

# Create output directory if needed
if (-not (Test-Path "${outputPath}")) {
    New-Item -ItemType Directory -Path "${outputPath}" -Force | Out-Null
}

# Run ScubaGear assessment
# Note: Interactive auth is supported - this will prompt if needed
try {
    # Expand tilde in OPAPath for PowerShell
    $opaPath = [System.IO.Path]::Combine($env:HOME, ".scubagear", "Tools")
    
    # Run with -DisconnectOnExit to clean up connections
    # -SilenceBODWarnings suppresses BOD 22-01 compliance warnings (not needed for commercial use)
    Invoke-SCuBA \`
        -ProductNames "*" \`
        -M365Environment "commercial" \`
        -OutPath "${outputPath}" \`
        -OPAPath $opaPath \`
        -LogIn:$true \`
        -DisconnectOnExit \`
        -SilenceBODWarnings \`
        -WarningAction SilentlyContinue
    
    Write-Host "ScubaGear assessment completed successfully"
    exit 0
} catch {
    Write-Error "ScubaGear assessment failed: $_"
    exit 1
}
`;

  return script;
}

/**
 * Run ScubaGear and capture results
 * @param {object} config - Configuration object
 * @param {object} paths - Paths object from createRunFolder
 * @param {string} modulePath - Path to ScubaGear module manifest
 * @returns {Promise<string>} Path to results JSON
 */
export async function runScubaGear(config, paths, modulePath) {
  logStage('ScubaGear', 'Starting ScubaGear assessment...');
  logStage('ScubaGear', `Tenant ID: ${config.tenantId}`);
  logStage('ScubaGear', `Output: ${paths.rawScubaGearDir}`);

  // Create a temporary directory for ScubaGear's direct output
  const scubaOutputDir = path.join(paths.rawScubaGearDir, 'scuba_output');
  fs.mkdirSync(scubaOutputDir, { recursive: true });

  const psCommand = buildPowerShellCommand({
    modulePath,
    tenantId: config.tenantId,
    outputPath: scubaOutputDir,
  });

  appendLog(paths.logPath, 'Starting ScubaGear execution');
  appendLog(paths.logPath, `Module: ${modulePath}`);
  appendLog(paths.logPath, `Tenant: ${config.tenantId}`);
  appendLog(paths.logPath, '--- PowerShell Command ---');
  appendLog(paths.logPath, psCommand);
  appendLog(paths.logPath, '--- End PowerShell Command ---');

  return new Promise((resolve, reject) => {
    // Spawn PowerShell with -NoProfile for faster startup
    const pwsh = spawn('pwsh', ['-NoProfile', '-NonInteractive', '-Command', psCommand], {
      stdio: ['inherit', 'pipe', 'pipe'], // Allow interactive auth via stdin
      env: {
        ...process.env,
        // Ensure PowerShell uses UTF-8
        LANG: 'en_US.UTF-8',
      },
    });

    let stdout = '';
    let stderr = '';

    pwsh.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text); // Echo to console
      appendLog(paths.logPath, `[STDOUT] ${text.trim()}`);
    });

    pwsh.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text); // Echo to console
      appendLog(paths.logPath, `[STDERR] ${text.trim()}`);
    });

    pwsh.on('close', (code) => {
      appendLog(paths.logPath, `ScubaGear exited with code: ${code}`);

      if (code !== 0) {
        logError('ScubaGear', `ScubaGear exited with code ${code}`);
        appendLog(paths.logPath, `ERROR: ScubaGear failed with exit code ${code}`);
        reject(new Error(`ScubaGear failed with exit code ${code}`));
        return;
      }

      // Find the results file
      logStage('ScubaGear', 'Locating results file...');
      const resultsPath = findScubaGearResults(scubaOutputDir);

      if (!resultsPath) {
        // Try looking in the parent directory too
        const altResultsPath = findScubaGearResults(paths.rawScubaGearDir);
        if (altResultsPath) {
          logStage('ScubaGear', `Found results at: ${altResultsPath}`);
          // Copy to canonical location
          const canonicalPath = path.join(paths.rawScubaGearDir, 'results.json');
          fs.copyFileSync(altResultsPath, canonicalPath);
          logSuccess('ScubaGear', `Results saved to: ${canonicalPath}`);
          resolve(canonicalPath);
          return;
        }

        logError('ScubaGear', 'Could not find ScubaGear results JSON');
        appendLog(paths.logPath, 'ERROR: Could not find ScubaGear results JSON');
        reject(new Error('ScubaGear completed but no results JSON found'));
        return;
      }

      // Copy to canonical location
      const canonicalPath = path.join(paths.rawScubaGearDir, 'results.json');
      fs.copyFileSync(resultsPath, canonicalPath);
      logSuccess('ScubaGear', `Results saved to: ${canonicalPath}`);
      appendLog(paths.logPath, `Results copied from ${resultsPath} to ${canonicalPath}`);
      
      // Preserve all ScubaGear output files (HTML reports, etc.)
      // The results are in a timestamped subdirectory, so we keep the entire scuba_output folder
      const scubaOutputExists = dirExists(scubaOutputDir) && fs.readdirSync(scubaOutputDir).length > 0;
      if (scubaOutputExists) {
        logStage('ScubaGear', `Preserving ScubaGear HTML reports and other output files in: ${scubaOutputDir}`);
        appendLog(paths.logPath, `ScubaGear output preserved at: ${scubaOutputDir}`);
      }
      
      resolve(canonicalPath);
    });

    pwsh.on('error', (err) => {
      logError('ScubaGear', `Failed to start PowerShell: ${err.message}`);
      appendLog(paths.logPath, `ERROR: Failed to start PowerShell: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * Use existing ScubaGear results (for testing/development)
 * @param {string} sourcePath - Path to existing results
 * @param {object} paths - Paths object from createRunFolder
 * @returns {string} Path to copied results
 */
export function useExistingResults(sourcePath, paths) {
  logStage('ScubaGear', `Using existing results: ${sourcePath}`);

  if (!fileExists(sourcePath)) {
    throw new Error(`Results file not found: ${sourcePath}`);
  }

  const canonicalPath = path.join(paths.rawScubaGearDir, 'results.json');
  fs.copyFileSync(sourcePath, canonicalPath);
  logSuccess('ScubaGear', `Results copied to: ${canonicalPath}`);

  return canonicalPath;
}
