import { copyFileSync, mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync, appendFileSync, chmodSync, unlinkSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface InstallOptions {
  dir: string;
  modesDir?: string;
  force?: boolean;
  local?: boolean;
  claudeMdPath?: string;
  settingsPath?: string;
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
  const modesDestDir = options.modesDir ? resolve(options.modesDir.replace('~', homedir())) : destDir;
  const srcDir = join(__dirname, '../commands');
  const version = getPackageVersion();

  mkdirSync(destDir, { recursive: true });
  if (modesDestDir !== destDir) mkdirSync(modesDestDir, { recursive: true });

  // Remove starter-kit leftovers that should not coexist with the standalone package
  const leftovers = ['install-mdd.md'];
  for (const f of leftovers) {
    const legacy = join(destDir, f);
    if (existsSync(legacy)) {
      try { unlinkSync(legacy); } catch { /* ignore */ }
    }
  }

  const files = readdirSync(srcDir)
    .filter(f => f.endsWith('.md'))
    .sort((a, b) => {
      if (a === 'mdd.md') return -1;
      if (b === 'mdd.md') return 1;
      return a.localeCompare(b);
    });

  const results: FileResult[] = [];

  for (const file of files) {
    const src = join(srcDir, file);
    const isModeFile = file !== 'mdd.md';
    const targetDir = isModeFile ? modesDestDir : destDir;
    const dest = join(targetDir, file);

    // Clean up legacy location: if mode file exists in commands dir but we're now using a separate modesDir, remove it
    if (isModeFile && modesDestDir !== destDir) {
      const legacyDest = join(destDir, file);
      if (existsSync(legacyDest)) {
        try { unlinkSync(legacyDest); } catch { /* ignore */ }
      }
    }

    try {
      if (existsSync(dest) && !options.force) {
        if (file === 'mdd.md') {
          const srcContent = readFileSync(src, 'utf-8');
          const srcVer = getMddVersion(srcContent);
          const destContent = readFileSync(dest, 'utf-8');
          const destVer = getMddVersion(destContent);
          const scope = options.local ? 'local' : 'global';
          if (srcVer <= destVer) {
            // mdd_version unchanged — still re-stamp description if npm version changed
            const reStamped = stampDescription(destContent, scope, version);
            if (reStamped !== destContent) {
              writeFileSync(dest, reStamped, 'utf-8');
              results.push({ file, status: 'updated', reason: `description stamped ${version}` });
            } else {
              results.push({ file, status: 'skipped', reason: `v${version} already up to date` });
            }
            continue;
          }
          writeFileSync(dest, stampDescription(srcContent, scope, version), 'utf-8');
          results.push({ file, status: 'updated', fromVersion: destVer, toVersion: srcVer });
        } else {
          copyFileSync(src, dest);
          results.push({ file, status: 'updated' });
        }
      } else {
        if (file === 'mdd.md') {
          const srcContent = readFileSync(src, 'utf-8');
          writeFileSync(dest, stampDescription(srcContent, options.local ? 'local' : 'global', version), 'utf-8');
        } else {
          copyFileSync(src, dest);
        }
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

  if (options.local) {
    console.log('  Tip: add .claude/commands/ to your .gitignore to keep these files out of git.\n');
  }

  if (options.claudeMdPath) {
    const claudeResult = injectClaudeGuidance(resolve(options.claudeMdPath.replace('~', homedir())), options.local);
    const icon = claudeResult.status === 'error' ? '✗' : claudeResult.status === 'skipped' ? '·' : '✓';
    console.log(`  ${icon} CLAUDE.md — ${claudeResult.message}`);
    console.log('');
  }

  if (options.settingsPath) {
    const hookScriptSrc = join(srcDir, 'mdd-branch-guard.sh');
    const hooksDir = join(resolve(options.settingsPath.replace('~', homedir()), '..'), 'hooks');
    const hookScriptDest = join(hooksDir, 'mdd-branch-guard.sh');
    const hookResult = installHook({
      hookScriptSrc,
      hookScriptDest,
      settingsPath: resolve(options.settingsPath.replace('~', homedir())),
      local: options.local ?? false,
    });
    const icon = hookResult.status === 'error' ? '✗' : hookResult.status === 'skipped' ? '·' : '✓';
    console.log(`  ${icon} Branch Guard hook — ${hookResult.message}`);
    console.log('');
  }

  console.log('Open Claude Code and run /mdd to get started.\n');
}

function stampDescription(content: string, scope: 'global' | 'local', version: string): string {
  return content.replace(
    /^(description:\s*"?)(?:\((?:global|local) v[^)]+\) )?/m,
    `$1(${scope} v${version}) `
  );
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

const CLAUDE_GUIDANCE_MARKER = '## MDD — Manual-First Development';
const PROJECT_CLAUDE_GUIDANCE_MARKER = '## MDD — Build Approach';

const CLAUDE_GUIDANCE_BLOCK = `
## MDD — Manual-First Development

If a \`.mdd/\` directory exists in the current project, apply this logic whenever
the user asks you to implement, build, modify, deploy, or automate something —
and they have NOT used \`/mdd\` to initiate the request:

**Step 1 — Does it already exist?**
Scan \`.mdd/.startup.md\` (Features AND Ops Runbooks sections). Do any tags or
names match what the user is asking about?
→ Feature match: "This looks related to \`<NN>-<feature-name>\`. Want to use
  \`/mdd update <NN>\` to modify it, or \`/mdd audit <NN>\` to review it first?"
→ Ops match: "You already have a \`<slug>\` runbook for this. Want to run it
  with \`/mdd runop <slug>\` or update it with \`/mdd update-op <slug>\`?"

**Step 2 — What kind of request is it?**

Infrastructure or ops? (deploy, CI/CD, Docker, commit hooks, pipelines,
cron jobs, webhooks, DNS, SSL, rollback, health checks, server config)
→ "This sounds like an ops procedure. Want to document it as a repeatable
  runbook with \`/mdd ops <description>\`?"

Feature work touching 3+ independent concerns?
→ "This looks initiative-scale. Want to plan it with \`/mdd plan-initiative\`?"

Single feature or bounded change?
→ "Want me to use \`/mdd <description>\` to build this with docs and tests first?"

Always ask — never auto-invoke. If the user says no, proceed as normal.

Skip entirely for: bug fixes, typos, config tweaks, single-line changes,
one-off shell commands.
`;

const PROJECT_CLAUDE_GUIDANCE_BLOCK = `
## MDD — Build Approach

This project uses MDD (Manual-Driven Development). Always start a session with \`/mdd\`
to load project context. Each feature is documented before it is built — use
\`/mdd <description>\` for a single feature, or \`/mdd plan-initiative\` to coordinate
multiple features in waves. When an initiative is active, build in wave order and
do not skip waves.

The \`.mdd/docs/\` directory contains one feature doc per feature. Each doc is the
authoritative source of truth for what to build. Read it fully before writing any code.

**Learning from mistakes**
All code in this project is built via the MDD workflow. Whenever a bug, flaw, or gap
is found — or if a feature doc changes or gains new frontmatter fields — document why
it happened and how it could have been prevented. When a fix is identified, ask the user if you should open a GitHub issue on their
behalf at https://github.com/TheDecipherist/mdd/issues with a clear description of
the problem and a suggested fix so it can be patched in the workflow for all users
(best practices, security hardening, performance optimization).

**After an MDD patch is published**
Run \`mdd update\` (global) or \`mdd update --install-local\` (project) to sync this
project to the latest version.
`;

interface HookInstallOptions {
  hookScriptSrc: string;
  hookScriptDest: string;
  settingsPath: string;
  local: boolean;
}

function installHook(opts: HookInstallOptions): { status: 'installed' | 'skipped' | 'error'; message: string } {
  try {
    // Install the hook script
    mkdirSync(dirname(opts.hookScriptDest), { recursive: true });
    copyFileSync(opts.hookScriptSrc, opts.hookScriptDest);
    chmodSync(opts.hookScriptDest, 0o755);

    // Derive hook command — local uses relative path, global uses $HOME
    const hookCommand = opts.local
      ? 'bash .claude/hooks/mdd-branch-guard.sh'
      : 'bash $HOME/.claude/hooks/mdd-branch-guard.sh';

    const HOOK_MARKER = 'mdd-branch-guard';

    // Read existing settings.json or start fresh
    let settings: Record<string, unknown> = {};
    if (existsSync(opts.settingsPath)) {
      try {
        settings = JSON.parse(readFileSync(opts.settingsPath, 'utf-8')) as Record<string, unknown>;
      } catch {
        // Unparseable settings — leave existing file alone to avoid corruption
        return { status: 'error', message: `could not parse ${opts.settingsPath}` };
      }
    }

    // Check if hook already registered
    const hooksSection = settings['hooks'] as Record<string, unknown[]> | undefined;
    const preToolUse = (hooksSection?.['PreToolUse'] ?? []) as Array<Record<string, unknown>>;
    const alreadyInstalled = preToolUse.some(group => {
      const hooks = group['hooks'] as Array<Record<string, unknown>> | undefined;
      return hooks?.some(h => String(h['command'] ?? '').includes(HOOK_MARKER));
    });

    if (alreadyInstalled) {
      return { status: 'skipped', message: 'already registered in settings.json' };
    }

    // Merge hook entry into PreToolUse
    const newEntry = {
      matcher: 'Write|Edit|NotebookEdit',
      hooks: [{ type: 'command', command: hookCommand }],
    };
    settings['hooks'] = {
      ...(hooksSection ?? {}),
      PreToolUse: [...preToolUse, newEntry],
    };

    writeFileSync(opts.settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
    return { status: 'installed', message: `hook registered in ${opts.settingsPath}` };
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
}

function injectClaudeGuidance(claudeMdPath: string, local?: boolean): { status: 'injected' | 'skipped' | 'error'; message: string } {
  try {
    const marker = local ? PROJECT_CLAUDE_GUIDANCE_MARKER : CLAUDE_GUIDANCE_MARKER;
    const block = local ? PROJECT_CLAUDE_GUIDANCE_BLOCK : CLAUDE_GUIDANCE_BLOCK;

    if (existsSync(claudeMdPath)) {
      const existing = readFileSync(claudeMdPath, 'utf-8');
      if (existing.includes(CLAUDE_GUIDANCE_MARKER) || existing.includes(PROJECT_CLAUDE_GUIDANCE_MARKER)) {
        return { status: 'skipped', message: 'guidance already present' };
      }
      appendFileSync(claudeMdPath, block, 'utf-8');
    } else {
      writeFileSync(claudeMdPath, block.trimStart(), 'utf-8');
    }
    return { status: 'injected', message: `${marker} injected` };
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
}
