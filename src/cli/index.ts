#!/usr/bin/env node

import { Command } from 'commander';
import { handleInit, handleMcpServer } from './init.js';

const program = new Command();

program
  .name('orderly-mcp')
  .description('Orderly Network MCP Server CLI')
  .version('0.1.0')
  .option(
    '-c, --cwd <cwd>',
    'the working directory. defaults to the current directory.',
    process.cwd()
  );

program
  .command('init')
  .description('Initialize MCP configuration for your client')
  .option('--client <client>', 'MCP client (claude, cursor, vscode, codex, opencode)')
  .action(async (opts, command) => {
    await handleInit(opts, command);
  });

program
  .command('mcp', { isDefault: true })
  .description('Start the MCP server (default command)')
  .action(async () => {
    await handleMcpServer();
  });

// Check if no command was provided (just run the MCP server)
const args = process.argv.slice(2);
if (
  args.length === 0 ||
  (args[0] && !args[0].startsWith('-') && !['init', 'mcp'].includes(args[0]))
) {
  // If no command or unrecognized command (not starting with -), run the MCP server
  handleMcpServer().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} else {
  program.parse();
}
