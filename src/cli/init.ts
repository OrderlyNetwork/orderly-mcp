#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Command } from 'commander';
import deepmerge from 'deepmerge';
import { execa } from 'execa';
import fsExtra from 'fs-extra';
import kleur from 'kleur';
import prompts from 'prompts';
import { z } from 'zod';
import { CLIENTS, DEPENDENCIES, getClientConfig } from './clients.js';
import { createMcpServer } from '../server.js';

const PACKAGE_NAME = '@orderly.network/mcp-server';
const { bold, cyan, green, red, yellow } = kleur;

const mcpInitOptionsSchema = z.object({
  client: z.enum(['claude', 'cursor', 'vscode', 'codex', 'opencode']),
  cwd: z.string(),
});

/* eslint-disable no-console */
function logger(message: string): void {
  console.log(message);
}

function logSuccess(message: string): void {
  console.log(green('✓'), message);
}

function logInfo(message: string): void {
  console.log(cyan('ℹ'), message);
}

function logError(message: string): void {
  console.error(red('✗'), message);
}

function logBreak(): void {
  console.log();
}
/* eslint-enable no-console */

async function getPackageManager(cwd: string): Promise<'npm' | 'yarn' | 'pnpm' | 'bun'> {
  const files = await fs.readdir(cwd).catch(() => []);
  const lockFiles: string[] = files;

  if (lockFiles.includes('pnpm-lock.yaml')) return 'pnpm';
  if (lockFiles.includes('yarn.lock')) return 'yarn';
  if (lockFiles.includes('bun.lockb') || lockFiles.includes('bun.lock')) return 'bun';
  if (lockFiles.includes('package-lock.json')) return 'npm';

  return 'npm';
}

async function installDependencies(cwd: string, dependencies: string[]): Promise<void> {
  const packageManager = await getPackageManager(cwd);
  const installCommand = packageManager === 'npm' ? 'install' : 'add';
  const devFlag = packageManager === 'npm' ? '--save-dev' : '-D';

  logInfo(`Installing dependencies with ${packageManager}...`);

  await execa(packageManager, [installCommand, devFlag, ...dependencies], {
    cwd,
    stdio: 'inherit',
  });
}

const overwriteMerge = (_: unknown[], sourceArray: unknown[]) => sourceArray;

async function writeConfigFile(
  configPath: string,
  config: Record<string, unknown> | string,
  isToml = false
): Promise<void> {
  await fsExtra.ensureDir(path.dirname(configPath));

  if (isToml && typeof config === 'string') {
    // For TOML files, we need to merge differently
    let existingContent = '';
    try {
      existingContent = await fs.readFile(configPath, 'utf-8');
    } catch {
      // File doesn't exist
    }

    if (existingContent) {
      // Simple merge for TOML - just append if not exists
      if (!existingContent.includes('[mcp_servers.orderly]')) {
        await fs.writeFile(configPath, `${existingContent}\n${config}`, 'utf-8');
      }
    } else {
      await fs.writeFile(configPath, config, 'utf-8');
    }
  } else {
    // JSON files
    let existingConfig: Record<string, unknown> = {};
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      existingConfig = JSON.parse(content);
    } catch {
      // File doesn't exist or is invalid
    }

    const mergedConfig = deepmerge(existingConfig, config as Record<string, unknown>, {
      arrayMerge: overwriteMerge,
    });

    await fs.writeFile(configPath, `${JSON.stringify(mergedConfig, null, 2)}\n`, 'utf-8');
  }
}

async function runMcpInit(options: z.infer<typeof mcpInitOptionsSchema>): Promise<string> {
  const { client, cwd } = options;

  const clientInfo = getClientConfig(client);
  if (!clientInfo) {
    throw new Error(
      `Unknown client: ${client}. Available clients: ${CLIENTS.map((c) => c.name).join(', ')}`
    );
  }

  const configPath = path.join(cwd, clientInfo.configPath);
  await writeConfigFile(configPath, clientInfo.config, clientInfo.isToml);

  return clientInfo.configPath;
}

export async function handleInit(opts: { client?: string }, command: Command): Promise<void> {
  try {
    // Get the cwd from parent command
    const parentOpts = (command.parent?.opts() as { cwd?: string }) || {};
    const cwd = parentOpts.cwd || process.cwd();

    let client = opts.client;

    if (!client) {
      const response = await prompts({
        type: 'select',
        name: 'client',
        message: 'Which MCP client are you using?',
        choices: CLIENTS.map((c) => ({
          title: c.label,
          value: c.name,
        })),
      });

      if (!response.client) {
        logBreak();
        process.exit(1);
      }

      client = response.client;
    }

    const options = mcpInitOptionsSchema.parse({
      client,
      cwd,
    });

    logBreak();
    logInfo('Configuring MCP server...');

    // Handle Codex special case
    if (options.client === 'codex') {
      logBreak();
      logger(yellow('Codex requires manual configuration:'));
      logBreak();
      logger('1. Open or create the file ~/.codex/config.toml');
      logger('2. Add the following configuration:');
      logBreak();
      logger(bold('[mcp_servers.orderly]'));
      logger(bold('command = "npx"'));
      logger(bold(`args = ["${PACKAGE_NAME}@latest"]`));
      logBreak();
      logger('3. Restart Codex to load the MCP server');
      logBreak();
      process.exit(0);
    }

    const configPath = await runMcpInit(options);
    logSuccess(`Configuration saved to ${configPath}`);

    // Install dependencies
    logInfo('Installing dependencies...');
    await installDependencies(cwd, DEPENDENCIES);
    logSuccess('Dependencies installed');

    logBreak();
    logger(bold(green('✓ MCP server initialized successfully!')));
    logBreak();
    logger('Next steps:');
    logger(`1. Restart your ${getClientConfig(options.client)?.label} client`);
    logger('2. Try asking: "How do I connect to Orderly Network?"');
    logBreak();
  } catch (error) {
    logBreak();
    if (error instanceof Error) {
      logError(error.message);
    } else {
      logError('An unknown error occurred');
    }
    process.exit(1);
  }
}

export async function handleMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Orderly Network MCP Server running on stdio');
}
