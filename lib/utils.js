/**
 * Utility functions for m365-assess
 */

import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Generate a short random ID
 * @param {number} length - Length of the ID (default 8)
 * @returns {string} Random hex string
 */
export function generateShortId(length = 8) {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Convert a string to a URL-safe slug
 * @param {string} str - Input string
 * @returns {string} Slugified string
 */
export function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Get current date in YYYY-MM-DD format
 * @returns {string} Formatted date
 */
export function getDateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current ISO timestamp
 * @returns {string} ISO timestamp
 */
export function getIsoTimestamp() {
  return new Date().toISOString();
}

/**
 * Create a run folder with the required structure
 * @param {string} outputDir - Base output directory
 * @param {string} customerName - Customer name
 * @returns {object} Object with folder paths
 */
export function createRunFolder(outputDir, customerName) {
  const dateStamp = getDateStamp();
  const customerSlug = slugify(customerName);
  const runId = generateShortId(8);
  const folderName = `${dateStamp}_${customerSlug}_RUN-${runId}`;
  const runFolder = path.join(outputDir, folderName);

  // Create directory structure
  const dirs = [
    runFolder,
    path.join(runFolder, 'raw', 'scubagear'),
    path.join(runFolder, 'logs'),
  ];

  dirs.forEach(dir => {
    fs.mkdirSync(dir, { recursive: true });
  });

  return {
    runFolder,
    runId,
    rawScubaGearDir: path.join(runFolder, 'raw', 'scubagear'),
    logsDir: path.join(runFolder, 'logs'),
    bundlePath: path.join(runFolder, 'bundle.json'),
    scoredBundlePath: path.join(runFolder, 'bundle.scored.json'),
    reportMdPath: path.join(runFolder, 'report.md'),
    reportDocxPath: path.join(runFolder, 'report.docx'),
    logPath: path.join(runFolder, 'logs', 'run.log'),
  };
}

/**
 * Write JSON to file with pretty formatting
 * @param {string} filePath - Path to write
 * @param {object} data - Data to write
 */
export function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Read JSON from file
 * @param {string} filePath - Path to read
 * @returns {object} Parsed JSON data
 */
export function readJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Append to log file
 * @param {string} logPath - Path to log file
 * @param {string} message - Message to log
 */
export function appendLog(logPath, message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logPath, logLine, 'utf8');
}

/**
 * Console log with prefix
 * @param {string} stage - Current stage name
 * @param {string} message - Message to display
 */
export function logStage(stage, message) {
  const prefix = `[${stage}]`.padEnd(20);
  console.log(`${prefix} ${message}`);
}

/**
 * Console error with prefix
 * @param {string} stage - Current stage name
 * @param {string} message - Error message
 */
export function logError(stage, message) {
  const prefix = `[${stage}]`.padEnd(20);
  console.error(`\x1b[31m${prefix} ERROR: ${message}\x1b[0m`);
}

/**
 * Console success with prefix
 * @param {string} stage - Current stage name
 * @param {string} message - Success message
 */
export function logSuccess(stage, message) {
  const prefix = `[${stage}]`.padEnd(20);
  console.log(`\x1b[32m${prefix} ${message}\x1b[0m`);
}

/**
 * Check if a file exists
 * @param {string} filePath - Path to check
 * @returns {boolean} True if file exists
 */
export function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists
 * @param {string} dirPath - Path to check
 * @returns {boolean} True if directory exists
 */
export function dirExists(dirPath) {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get the repo root (parent of tools directory)
 * @returns {string} Absolute path to repo root
 */
export function getRepoRoot() {
  // Navigate up from tools/m365-assess to repo root
  return path.resolve(process.cwd());
}

/**
 * Normalize severity string to canonical form
 * @param {string} severity - Raw severity string
 * @returns {string} Normalized severity (critical|high|medium|low|info)
 */
export function normalizeSeverity(severity) {
  if (!severity) return 'info';
  const lower = String(severity).toLowerCase().trim();

  if (lower.includes('critical') || lower === 'crit') return 'critical';
  if (lower.includes('high')) return 'high';
  if (lower.includes('medium') || lower.includes('moderate') || lower === 'med') return 'medium';
  if (lower.includes('low')) return 'low';
  return 'info';
}

/**
 * Normalize status string to canonical form
 * @param {string} status - Raw status string
 * @returns {string} Normalized status (pass|fail|not_applicable|info)
 */
export function normalizeStatus(status) {
  if (!status) return 'info';
  const lower = String(status).toLowerCase().trim();

  if (lower === 'pass' || lower === 'passed' || lower === 'true' || lower === 'compliant') return 'pass';
  if (lower === 'fail' || lower === 'failed' || lower === 'false' || lower === 'non-compliant' || lower === 'noncompliant') return 'fail';
  if (lower === 'not_applicable' || lower === 'n/a' || lower === 'na' || lower.includes('not applicable')) return 'not_applicable';
  if (lower === 'warning' || lower === 'warn') return 'fail';
  return 'info';
}

/**
 * Create a stable hash from a string
 * @param {string} str - Input string
 * @returns {string} Hash string
 */
export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
