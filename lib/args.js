/**
 * CLI argument parsing for m365-assess
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Get the directory where this tool is installed
 * @returns {string} Absolute path to tool directory
 */
function getToolDir() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '..');
}

/**
 * Parse and validate CLI arguments
 * @returns {object} Parsed arguments
 */
export function parseArgs() {
  const toolDir = getToolDir();
  const cwd = process.cwd();

  const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 --customer <name> --tenant-id <guid> [options]')
    .option('customer', {
      alias: 'c',
      type: 'string',
      description: 'Customer name for the report',
      demandOption: true,
    })
    .option('tenant-id', {
      alias: 't',
      type: 'string',
      description: 'Microsoft 365 Tenant ID (GUID)',
      demandOption: true,
    })
    .option('team-name', {
      type: 'string',
      description: 'Team name to display in report',
      default: 'Security Team',
    })
    .option('previous', {
      alias: 'p',
      type: 'string',
      description: 'Path to previous bundle.scored.json for score comparison',
    })
    .option('output-dir', {
      alias: 'o',
      type: 'string',
      description: 'Output directory for reports',
      default: path.join(cwd, 'reports'),
    })
    .option('scubagear-path', {
      type: 'string',
      description: 'Path to ScubaGear clone',
      default: path.join(cwd, 'ScubaGear'),
    })
    .option('templates-dir', {
      type: 'string',
      description: 'Path to templates directory',
      default: path.join(toolDir, 'templates'),
    })
    .option('skip-scubagear', {
      type: 'boolean',
      description: 'Skip ScubaGear execution (for testing with existing results)',
      default: false,
      hidden: true,
    })
    .option('scubagear-results', {
      type: 'string',
      description: 'Path to existing ScubaGear results (when using --skip-scubagear)',
      hidden: true,
    })
    .example('$0 --customer "Acme Corp" --tenant-id "12345678-1234-1234-1234-123456789abc"')
    .example('$0 -c "Acme Corp" -t "12345678-..." --previous ./reports/prev/bundle.scored.json')
    .epilogue('For more information, see README.md')
    .strict()
    .help()
    .alias('help', 'h')
    .version()
    .alias('version', 'v')
    .parseSync();

  // Validate tenant-id format (GUID)
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!guidRegex.test(argv.tenantId)) {
    console.error('Error: --tenant-id must be a valid GUID format');
    console.error('Example: 12345678-1234-1234-1234-123456789abc');
    process.exit(1);
  }

  // Resolve all paths to absolute
  return {
    customer: argv.customer,
    tenantId: argv.tenantId,
    teamName: argv.teamName,
    previousPath: argv.previous ? path.resolve(argv.previous) : null,
    outputDir: path.resolve(argv.outputDir),
    scubagearPath: path.resolve(argv.scubagearPath),
    templatesDir: path.resolve(argv.templatesDir),
    skipScubaGear: argv.skipScubagear,
    scubagearResults: argv.scubagearResults ? path.resolve(argv.scubagearResults) : null,
    toolDir,
    cwd,
  };
}
