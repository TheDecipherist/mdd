import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { cwd } from 'process';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface PackageVersions {
  [name: string]: string;
}

interface UpdateResult {
  name: string;
  from: string;
  to: string;
}

export interface UpdateEcommerceOptions {
  log?: (msg: string) => void;
}

function detectPackageManager(dir: string): string {
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(dir, 'package-lock.json'))) return 'npm';
  return 'npm';
}

function readEcommercePackages(dir: string): PackageVersions {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) {
    return {};
  }

  const raw = JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJson;
  const all: Record<string, string> = {
    ...(raw.dependencies ?? {}),
    ...(raw.devDependencies ?? {}),
    ...(raw.peerDependencies ?? {}),
  };

  const result: PackageVersions = {};
  for (const [name, version] of Object.entries(all)) {
    if (name.startsWith('@thedecipherist/mdd-ecommerce-')) {
      result[name] = version;
    }
  }
  return result;
}

function stripRange(version: string): string {
  // Strip leading semver range chars: ^, ~, >=, <=, >, <, =
  return version.replace(/^[~^>=<]+/, '');
}

function parseMajor(version: string): number {
  const clean = stripRange(version);
  const parts = clean.split('.');
  const major = parseInt(parts[0] ?? '0', 10);
  return isNaN(major) ? 0 : major;
}

function isMajorBump(from: string, to: string): boolean {
  return parseMajor(to) > parseMajor(from);
}

function hasDocsDirectory(packageName: string, dir: string): boolean {
  const docsPath = join(dir, 'node_modules', packageName, '.mdd', 'docs');
  return existsSync(docsPath);
}

export function updateEcommerce(options?: UpdateEcommerceOptions): void {
  const log = options?.log ?? console.log;
  const dir = cwd();
  const pkgPath = join(dir, 'package.json');

  if (!existsSync(pkgPath)) {
    throw new Error('No package.json found in current directory.');
  }

  const before = readEcommercePackages(dir);

  if (Object.keys(before).length === 0) {
    log('No @thedecipherist/mdd-ecommerce-* packages found in package.json.');
    return;
  }

  const pm = detectPackageManager(dir);
  const packageNames = Object.keys(before);

  log(`\nUpdating ${packageNames.length} @thedecipherist/mdd-ecommerce-* package(s) with ${pm}...\n`);

  const result = spawnSync(pm, ['update', ...packageNames], { cwd: dir, stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    throw new Error(`${pm} update exited with code ${result.status ?? 'unknown'}`);
  }

  const after = readEcommercePackages(dir);

  const changed: UpdateResult[] = [];
  for (const name of packageNames) {
    const fromVersion = before[name] ?? 'unknown';
    const toVersion = after[name] ?? fromVersion;
    if (stripRange(fromVersion) !== stripRange(toVersion)) {
      changed.push({ name, from: fromVersion, to: toVersion });
    }
  }

  log('\n--- Update Summary ---\n');

  if (changed.length === 0) {
    log('  All packages already up to date. No changes applied.');
    log('');
    return;
  }

  const breakingChanges: UpdateResult[] = [];

  for (const updateResult of changed) {
    log(`  ✓ ${updateResult.name}  ${updateResult.from} -> ${updateResult.to}`);

    if (isMajorBump(updateResult.from, updateResult.to)) {
      breakingChanges.push(updateResult);
    }
  }

  log('');

  if (breakingChanges.length > 0) {
    log('  Warnings:');
    for (const updateResult of breakingChanges) {
      const hasDocs = hasDocsDirectory(updateResult.name, dir);
      log(`  ! Breaking change possible - check site.config.ts slot wiring for ${updateResult.name}`);
      if (hasDocs) {
        const docsPath = join('node_modules', updateResult.name, '.mdd', 'docs');
        log(`    Docs available: ${docsPath}`);
      }
    }
    log('');
  } else {
    log('  All updates applied. No breaking changes detected.');
    log('');
  }
}
