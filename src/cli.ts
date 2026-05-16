#!/usr/bin/env node
import { Command } from 'commander';
import { install, getSelfImprovementPref } from './install.js';
import { readFileSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { join, dirname, resolve } from 'path';
import { cwd } from 'process';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')) as { version: string };

async function promptSelfImprovement(settingsPath: string | undefined): Promise<boolean | undefined> {
  if (!settingsPath) return undefined;
  const resolved = resolve(settingsPath.replace('~', homedir()));
  const existing = getSelfImprovementPref(resolved);
  if (existing !== null) return undefined; // already set — don't overwrite
  if (!process.stdin.isTTY) return undefined; // non-interactive — skip, leave unset

  return new Promise((res) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\n  Help improve MDD by suggesting GitHub issues when audits find workflow gaps? [y/N] ', (answer) => {
      rl.close();
      res(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

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
  .action(async function (this: Command, options: { dir: string; installLocal: boolean; force?: boolean }) {
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
    const selfImprovement = await promptSelfImprovement(settingsPath);
    install({ dir: effectiveDir, modesDir, force: options.force, local, claudeMdPath, settingsPath, selfImprovement });
  });

program
  .command('update')
  .description('Update MDD commands to latest version (alias for install --force)')
  .option('--dir <path>', 'Custom install directory', '~/.claude/commands')
  .option('--install-local', 'Update the local project install instead of global', false)
  .action(async function (this: Command, options: { dir: string; installLocal: boolean }) {
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
    const selfImprovement = await promptSelfImprovement(settingsPath);
    install({ dir: effectiveDir, modesDir, force: true, local, claudeMdPath, settingsPath, selfImprovement });
  });

program.parseAsync();
