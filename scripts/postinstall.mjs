#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Only auto-deploy on global installs — skip during local dev `npm install`
if (process.env.npm_config_global === 'true') {
  const result = spawnSync(
    'node',
    [join(__dirname, '../dist/cli.js'), 'install'],
    { stdio: 'inherit' }
  );
  process.exit(result.status ?? 0);
}
