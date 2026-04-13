#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { findMddDir } from './commands/dashboard.js';

const args = process.argv.slice(2);
const subcommand = args[0];

// All subcommands (and bare `mdd`) launch the dashboard
const DASHBOARD_ALIASES = [undefined, 'dashboard', 'status'];

if (!DASHBOARD_ALIASES.includes(subcommand)) {
  console.error(`Unknown command: ${subcommand}`);
  console.error('Usage: mdd [dashboard|status]');
  process.exit(1);
}

const mddDir = findMddDir(process.cwd());

if (!mddDir) {
  console.error('');
  console.error('  No MDD workspace found in this directory.');
  console.error('  Run /mdd <feature> in Claude Code first to create one.');
  console.error('');
  process.exit(1);
}

render(React.createElement(App, { mddDir: mddDir as string }));
