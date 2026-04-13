#!/usr/bin/env node
import { findMddDir, loadWorkspace } from './commands/dashboard.js';
import { runApp } from './ui/app.js';
import type { MddWorkspace } from './types/index.js';

const args = process.argv.slice(2);
const subcommand = args[0];
const DASHBOARD_ALIASES = [undefined, 'dashboard', 'status'];

if (!DASHBOARD_ALIASES.includes(subcommand)) {
  console.error(`Unknown command: ${subcommand}`);
  process.exit(1);
}

const mddDir = findMddDir(process.cwd());
if (!mddDir) {
  console.error('\n  No MDD workspace found.\n  Run /mdd <feature> in Claude Code first.\n');
  process.exit(1);
}

loadWorkspace(mddDir).then((ws: MddWorkspace) => {
  runApp(ws, (cb: (newWs: MddWorkspace) => void) => {
    loadWorkspace(mddDir as string).then(cb);
  });
});
