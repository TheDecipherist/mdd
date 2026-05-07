#!/usr/bin/env node
import { Command } from 'commander';
import { install } from './install.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')) as { version: string };

const program = new Command();

program
  .name('mdd')
  .description('MDD — Manual-Driven Development workflow for Claude Code')
  .version(pkg.version);

program
  .command('install')
  .description('Install MDD Claude commands to ~/.claude/commands/')
  .option('--dir <path>', 'Custom install directory (default: ~/.claude/commands)', '~/.claude/commands')
  .option('--force', 'Overwrite existing files even if already up to date', false)
  .action(install);

program
  .command('update')
  .description('Update MDD commands to latest version (alias for install --force)')
  .option('--dir <path>', 'Custom install directory', '~/.claude/commands')
  .action((options: { dir: string }) => install({ ...options, force: true }));

program.parse();
