/**
 * Word document renderer
 * Uses pandoc to convert Markdown to DOCX with custom template
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logStage, logSuccess, logError, appendLog, fileExists } from './utils.js';

/**
 * Convert Markdown to Word document using pandoc
 * @param {string} markdownPath - Path to source Markdown file
 * @param {string} docxPath - Path for output DOCX file
 * @param {string} templatePath - Path to Word reference template
 * @param {string} logPath - Path to log file
 * @returns {Promise<string>} Path to generated DOCX
 */
export async function renderDocx(markdownPath, docxPath, templatePath, logPath) {
  logStage('Render DOCX', 'Converting Markdown to Word document...');

  // Validate inputs
  if (!fileExists(markdownPath)) {
    throw new Error(`Markdown file not found: ${markdownPath}`);
  }

  if (!fileExists(templatePath)) {
    throw new Error(`Word template not found: ${templatePath}`);
  }

  appendLog(logPath, 'Starting DOCX conversion');
  appendLog(logPath, `Input: ${markdownPath}`);
  appendLog(logPath, `Output: ${docxPath}`);
  appendLog(logPath, `Template: ${templatePath}`);

  return new Promise((resolve, reject) => {
    // Build pandoc command arguments
    const args = [
      markdownPath,
      '-o', docxPath,
      '--reference-doc=' + templatePath,
      '--from=markdown',
      '--to=docx',
      '--standalone',
      // Additional options for better formatting
      '--wrap=auto',
      '--columns=80',
    ];

    appendLog(logPath, `Pandoc command: pandoc ${args.join(' ')}`);
    logStage('Render DOCX', `Running: pandoc ${args.slice(0, 4).join(' ')}...`);

    const pandoc = spawn('pandoc', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    pandoc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pandoc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pandoc.on('close', (code) => {
      if (stdout) {
        appendLog(logPath, `[PANDOC STDOUT] ${stdout.trim()}`);
      }
      if (stderr) {
        appendLog(logPath, `[PANDOC STDERR] ${stderr.trim()}`);
      }
      appendLog(logPath, `Pandoc exited with code: ${code}`);

      if (code !== 0) {
        logError('Render DOCX', `Pandoc failed with exit code ${code}`);
        if (stderr) {
          logError('Render DOCX', stderr.trim());
        }
        reject(new Error(`Pandoc conversion failed (exit code ${code}): ${stderr || 'Unknown error'}`));
        return;
      }

      // Verify output file was created
      if (!fileExists(docxPath)) {
        logError('Render DOCX', 'DOCX file was not created');
        reject(new Error('Pandoc completed but DOCX file was not created'));
        return;
      }

      // Get file size for confirmation
      const stats = fs.statSync(docxPath);
      const fileSizeKB = Math.round(stats.size / 1024);

      logSuccess('Render DOCX', `Word document created: ${docxPath} (${fileSizeKB} KB)`);
      appendLog(logPath, `DOCX created successfully: ${docxPath} (${fileSizeKB} KB)`);

      resolve(docxPath);
    });

    pandoc.on('error', (err) => {
      logError('Render DOCX', `Failed to start pandoc: ${err.message}`);
      appendLog(logPath, `ERROR: Failed to start pandoc: ${err.message}`);

      if (err.code === 'ENOENT') {
        reject(new Error('Pandoc is not installed or not in PATH. Install with: brew install pandoc'));
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Render DOCX using paths from config
 * @param {object} config - Configuration object
 * @param {object} paths - Paths object
 * @returns {Promise<string>} Path to generated DOCX
 */
export async function renderDocxFromPaths(config, paths) {
  const templatePath = path.join(config.templatesDir, 'M365_Security_Assessment_Template.docx');

  return renderDocx(
    paths.reportMdPath,
    paths.reportDocxPath,
    templatePath,
    paths.logPath
  );
}
