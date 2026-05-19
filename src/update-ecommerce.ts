import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
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

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJson;
  const all: Record<string, string> = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
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

export function updateEcommerce(): void {
  const dir = cwd();
  const pkgPath = join(dir, 'package.json');

  if (!existsSync(pkgPath)) {
    console.log('No package.json found in current directory.');
    process.exit(1);
  }

  const before = readEcommercePackages(dir);

  if (Object.keys(before).length === 0) {
    console.log('No @thedecipherist/mdd-ecommerce-* packages found in package.json.');
    return;
  }

  const pm = detectPackageManager(dir);
  const packageNames = Object.keys(before);

  console.log(`\nUpdating ${packageNames.length} @thedecipherist/mdd-ecommerce-* package(s) with ${pm}...\n`);

  const updateArgs = packageNames.join(' ');
  const updateCmd = `${pm} update ${updateArgs}`;

  try {
    execSync(updateCmd, { cwd: dir, stdio: 'inherit' });
  } catch (err) {
    console.log(`\nUpdate command failed: ${String(err)}`);
    process.exit(1);
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

  console.log('\n--- Update Summary ---\n');

  if (changed.length === 0) {
    console.log('  All packages already up to date. No changes applied.');
    console.log('');
    return;
  }

  const breakingChanges: UpdateResult[] = [];

  for (const result of changed) {
    console.log(`  ✓ ${result.name}  ${result.from} -> ${result.to}`);

    if (isMajorBump(result.from, result.to)) {
      breakingChanges.push(result);
    }
  }

  console.log('');

  if (breakingChanges.length > 0) {
    console.log('  Warnings:');
    for (const result of breakingChanges) {
      const hasDocs = hasDocsDirectory(result.name, dir);
      console.log(`  ! Breaking change possible - check site.config.ts slot wiring for ${result.name}`);
      if (hasDocs) {
        const docsPath = join('node_modules', result.name, '.mdd', 'docs');
        console.log(`    Docs available: ${docsPath}`);
      }
    }
    console.log('');
  } else {
    console.log('  All updates applied. No breaking changes detected.');
    console.log('');
  }
}
