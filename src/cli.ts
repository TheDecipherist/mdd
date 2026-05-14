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
  .description('Install MDD — mdd.md to ~/.claude/commands/, mode files to ~/.claude/mdd/')
  .option('--dir <path>', 'Custom install directory (default: ~/.claude/commands)', '~/.claude/commands')
  .option('--install-local', 'Install to .claude/commands/ in the current project directory', false)
  .option('--force', 'Overwrite existing files even if already up to date', false)
  .action(function (this: Command, options: { dir: string; installLocal: boolean; force?: boolean }) {
    const dirExplicit = this.getOptionValueSource('dir') === 'cli';
    const local = options.installLocal && !dirExplicit;
    const effectiveDir = local ? join(cwd(), '.claude/commands') : options.dir;
    const modesDir = dirExplicit ? undefined
      : local ? join(cwd(), '.claude/mdd')
      : join(homedir(), '.claude', 'mdd');
    const claudeMdPath = dirExplicit ? undefined
      : local ? join(cwd(), 'CLAUDE.md')
      : join(homedir(), '.claude', 'CLAUDE.md');
    const settingsPath = dirExplicit ? undefined
      : local ? join(cwd(), '.claude', 'settings.json')
      : join(homedir(), '.claude', 'settings.json');
    install({ dir: effectiveDir, modesDir, force: options.force, local, claudeMdPath, settingsPath });
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
    const modesDir = dirExplicit ? undefined
      : local ? join(cwd(), '.claude/mdd')
      : join(homedir(), '.claude', 'mdd');
    const claudeMdPath = dirExplicit ? undefined
      : local ? join(cwd(), 'CLAUDE.md')
      : join(homedir(), '.claude', 'CLAUDE.md');
    const settingsPath = dirExplicit ? undefined
      : local ? join(cwd(), '.claude', 'settings.json')
      : join(homedir(), '.claude', 'settings.json');
    install({ dir: effectiveDir, modesDir, force: true, local, claudeMdPath, settingsPath });
  });

program.parse();
