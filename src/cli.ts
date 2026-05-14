#!/usr/bin/env node
import { Command } from 'commander';
import { install } from './install.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { cwd } from 'process';
import { homedir } from 'os';

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
  .option('--install-local', 'Install to .claude/commands/ in the current project directory', false)
  .option('--force', 'Overwrite existing files even if already up to date', false)
  .action(function (this: Command, options: { dir: string; installLocal: boolean; force?: boolean }) {
    const dirExplicit = this.getOptionValueSource('dir') === 'cli';
    const local = options.installLocal && !dirExplicit;
    const effectiveDir = local ? join(cwd(), '.claude/commands') : options.dir;
    const claudeMdPath = dirExplicit ? undefined
      : local ? join(cwd(), 'CLAUDE.md')
      : join(homedir(), '.claude', 'CLAUDE.md');
    install({ dir: effectiveDir, force: options.force, local, claudeMdPath });
  });

program
  .command('update')
  .description('Update MDD commands to latest version (alias for install --force)')
  .option('--dir <path>', 'Custom install directory', '~/.claude/commands')
  .option('--install-local', 'Update the local project install instead of global', false)
  .action(function (this: Command, options: { dir: string; installLocal: boolean }) {
    const dirExplicit = this.getOptionValueSource('dir') === 'cli';
    const local = options.installLocal && !dirExplicit;
    const effectiveDir = local ? join(cwd(), '.claude/commands') : options.dir;
    const claudeMdPath = dirExplicit ? undefined
      : local ? join(cwd(), 'CLAUDE.md')
      : join(homedir(), '.claude', 'CLAUDE.md');
    install({ dir: effectiveDir, force: true, local, claudeMdPath });
  });

program.parse();
