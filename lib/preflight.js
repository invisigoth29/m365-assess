/**
 * Preflight checks for m365-assess
 * Validates all prerequisites before running the assessment
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logStage, logError, logSuccess, fileExists, dirExists } from './utils.js';

/**
 * Check if a command exists in PATH
 * @param {string} command - Command to check
 * @returns {boolean} True if command exists
 */
function commandExists(command) {
  try {
    execSync(`which ${command}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get version of a command
 * @param {string} command - Command to check
 * @param {string} versionFlag - Flag to get version (default: --version)
 * @returns {string|null} Version string or null
 */
function getVersion(command, versionFlag = '--version') {
  try {
    const result = execSync(`${command} ${versionFlag}`, { stdio: 'pipe', encoding: 'utf8' });
    return result.trim().split('\n')[0];
  } catch {
    return null;
  }
}

/**
 * Check if a PowerShell module is installed
 * @param {string} moduleName - Name of the PowerShell module
 * @returns {boolean} True if module is installed
 */
function isPowerShellModuleInstalled(moduleName) {
  try {
    const result = execSync(`pwsh -NoProfile -Command "Get-Module -ListAvailable -Name ${moduleName} | Select-Object -First 1 -ExpandProperty Name"`, {
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return result.trim() === moduleName;
  } catch {
    return false;
  }
}

/**
 * Install PowerShell modules required for full M365 coverage
 * @param {string[]} modules - Array of module names to install
 * @returns {boolean} True if installation succeeded
 */
function installPowerShellModules(modules) {
  try {
    for (const moduleName of modules) {
      execSync(`pwsh -NoProfile -Command "Install-Module -Name ${moduleName} -Force -AllowClobber -Scope CurrentUser -ErrorAction Stop"`, {
        stdio: 'pipe',
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Find ScubaGear module manifest
 * @param {string} scubagearPath - Path to ScubaGear clone
 * @returns {string|null} Path to module manifest or null
 */
function findScubaGearModule(scubagearPath) {
  // Common locations for ScubaGear module manifest
  const possiblePaths = [
    path.join(scubagearPath, 'PowerShell', 'ScubaGear', 'ScubaGear.psd1'),
    path.join(scubagearPath, 'ScubaGear.psd1'),
    path.join(scubagearPath, 'src', 'ScubaGear.psd1'),
  ];

  for (const p of possiblePaths) {
    if (fileExists(p)) {
      return p;
    }
  }

  // Search recursively for ScubaGear.psd1
  try {
    const result = execSync(`find "${scubagearPath}" -name "ScubaGear.psd1" -type f 2>/dev/null | head -1`, {
      stdio: 'pipe',
      encoding: 'utf8',
    });
    const found = result.trim();
    if (found && fileExists(found)) {
      return found;
    }
  } catch {
    // Ignore find errors
  }

  return null;
}

/**
 * Run all preflight checks
 * @param {object} config - Configuration object from args
 * @returns {object} Preflight results including discovered paths
 */
export function runPreflightChecks(config) {
  logStage('Preflight', 'Running prerequisite checks...');

  const errors = [];
  const warnings = [];
  const results = {
    scubagearModulePath: null,
    docxTemplatePath: null,
  };

  // Check PowerShell 7+
  if (!commandExists('pwsh')) {
    errors.push('PowerShell 7+ (pwsh) is not installed. Install with: brew install powershell/tap/powershell');
  } else {
    const version = getVersion('pwsh');
    logStage('Preflight', `Found pwsh: ${version}`);
  }

  // Pandoc no longer required - using native DOCX generation

  // Check ScubaGear clone exists
  if (!dirExists(config.scubagearPath)) {
    errors.push(`ScubaGear not found at: ${config.scubagearPath}`);
    errors.push('Clone ScubaGear with: git clone https://github.com/cisagov/ScubaGear.git');
  } else {
    // Find ScubaGear module
    const modulePath = findScubaGearModule(config.scubagearPath);
    if (!modulePath) {
      errors.push(`ScubaGear module manifest (ScubaGear.psd1) not found in: ${config.scubagearPath}`);
    } else {
      results.scubagearModulePath = modulePath;
      logStage('Preflight', `Found ScubaGear module: ${modulePath}`);
    }
  }

  // Check templates directory
  if (!dirExists(config.templatesDir)) {
    errors.push(`Templates directory not found: ${config.templatesDir}`);
  } else {
    // Check DOCX template (used for direct generation)
    const docxTemplate = path.join(config.templatesDir, 'report_template.docx');
    if (!fileExists(docxTemplate)) {
      errors.push(`DOCX template not found: ${docxTemplate}`);
      errors.push('The template should be a Word document with docxtemplater tags');
    } else {
      results.docxTemplatePath = docxTemplate;
      logStage('Preflight', `Found DOCX template: ${docxTemplate}`);
    }
  }

  // Check PowerShell modules for full product coverage
  const optionalModules = [
    { name: 'Microsoft.PowerApps.PowerShell', purpose: 'PowerPlatform' },
    { name: 'Microsoft.Online.SharePoint.PowerShell', purpose: 'SharePoint Online' },
  ];

  const missingModules = [];
  for (const module of optionalModules) {
    if (!isPowerShellModuleInstalled(module.name)) {
      missingModules.push(module);
    }
  }

  if (missingModules.length > 0) {
    // Attempt to install missing modules
    const moduleNames = missingModules.map(m => m.name);
    installPowerShellModules(moduleNames);
    
    // Recheck after install attempt
    const stillMissing = [];
    for (const module of missingModules) {
      if (!isPowerShellModuleInstalled(module.name)) {
        stillMissing.push(module);
      }
    }
    
    if (stillMissing.length > 0) {
      const skipped = stillMissing.map(m => m.purpose).join(', ');
      logStage('Preflight', `Optional modules unavailable (${skipped}) - these products will be skipped`);
    } else {
      logSuccess('Preflight', 'All M365 product modules installed - full coverage enabled');
    }
  } else {
    logSuccess('Preflight', 'All M365 product modules present - full coverage enabled');
  }

  // Check previous bundle if specified
  if (config.previousPath) {
    if (!fileExists(config.previousPath)) {
      warnings.push(`Previous bundle not found: ${config.previousPath} - Score movement will not be available`);
    } else {
      logStage('Preflight', `Found previous bundle: ${config.previousPath}`);
    }
  }

  // Create output directory if it doesn't exist
  if (!dirExists(config.outputDir)) {
    try {
      fs.mkdirSync(config.outputDir, { recursive: true });
      logStage('Preflight', `Created output directory: ${config.outputDir}`);
    } catch (err) {
      errors.push(`Failed to create output directory: ${config.outputDir} - ${err.message}`);
    }
  }

  // Report warnings
  for (const warning of warnings) {
    console.warn(`\x1b[33m[Preflight] WARNING: ${warning}\x1b[0m`);
  }

  // Report errors and exit if any
  if (errors.length > 0) {
    logError('Preflight', 'Prerequisite checks failed:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  logSuccess('Preflight', 'All prerequisite checks passed');

  return results;
}
