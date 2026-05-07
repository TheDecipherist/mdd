import { copyFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface InstallOptions {
  dir: string;
  force?: boolean;
}

interface FileResult {
  file: string;
  status: 'installed' | 'updated' | 'skipped' | 'error';
  reason?: string;
  fromVersion?: number;
  toVersion?: number;
}

export function install(options: InstallOptions): void {
  const destDir = resolve(options.dir.replace('~', homedir()));
  const srcDir = join(__dirname, '../commands');
  const version = getPackageVersion();

  mkdirSync(destDir, { recursive: true });

  const files = readdirSync(srcDir)
    .filter(f => f.endsWith('.md'))
    .sort((a, b) => {
      // mdd.md first, then alphabetical
      if (a === 'mdd.md') return -1;
      if (b === 'mdd.md') return 1;
      return a.localeCompare(b);
    });

  const results: FileResult[] = [];

  for (const file of files) {
    const src = join(srcDir, file);
    const dest = join(destDir, file);

    try {
      if (existsSync(dest) && !options.force) {
        if (file === 'mdd.md') {
          const srcVer = getMddVersion(readFileSync(src, 'utf-8'));
          const destVer = getMddVersion(readFileSync(dest, 'utf-8'));
          if (srcVer <= destVer) {
            results.push({ file, status: 'skipped', reason: `v${destVer} already up to date` });
            continue;
          }
          copyFileSync(src, dest);
          results.push({ file, status: 'updated', fromVersion: destVer, toVersion: srcVer });
        } else {
          // For mode files: compare modification — just overwrite silently
          copyFileSync(src, dest);
          results.push({ file, status: 'updated' });
        }
      } else {
        copyFileSync(src, dest);
        results.push({ file, status: existsSync(dest) ? 'updated' : 'installed' });
      }
    } catch (err) {
      results.push({ file, status: 'error', reason: String(err) });
    }
  }

  console.log(`\nMDD v${version} — Claude Code workflow installer`);
  console.log(`Install directory: ${destDir}\n`);

  for (const r of results) {
    const icon = r.status === 'error' ? '✗' : r.status === 'skipped' ? '·' : '✓';
    const detail = r.status === 'updated' && r.fromVersion !== undefined
      ? ` (v${r.fromVersion} → v${r.toVersion})`
      : r.reason ? ` — ${r.reason}` : '';
    console.log(`  ${icon} ${r.file}${detail}`);
  }

  const installed = results.filter(r => r.status === 'installed' || r.status === 'updated').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const errors = results.filter(r => r.status === 'error').length;

  console.log('');
  if (errors > 0) {
    console.log(`  ${errors} error(s) — check the output above`);
  } else if (installed === 0) {
    console.log('  Already up to date.');
  } else {
    console.log(`  ${installed} file(s) installed/updated${skipped > 0 ? `, ${skipped} skipped` : ''}`);
  }

  console.log('\nOpen Claude Code and run /mdd to get started.\n');
}

function getMddVersion(content: string): number {
  const match = content.match(/^mdd_version:\s*(\d+)/m);
  return match ? parseInt(match[1], 10) : 0;
}

function getPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')) as { version: string };
    return pkg.version;
  } catch {
    return 'unknown';
  }
}
