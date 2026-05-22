---
id: 14-npm-cli
title: npm CLI - install, update, and update-ecommerce Commands
edition: MDD
depends_on: [01-mdd]
relates: [16-scripts, 17-deploy]
source_files:
  - src/cli.ts
  - src/install.ts
  - src/update-ecommerce.ts
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [npm, cli, install, update, commander, install-local, force, version-safety, hook-install, claude-guidance, self-improvement, update-ecommerce]
path: Source/CLI
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 14 - npm CLI - install, update, and update-ecommerce Commands

## Purpose

The npm CLI (`src/cli.ts` + `src/install.ts` + `src/update-ecommerce.ts`) is the thin
TypeScript wrapper that ships as the `mdd` binary. It copies the `commands/*.md` files
to the correct location, wires the branch guard hook into Claude's `settings.json`, and
injects MDD guidance into the project or global `CLAUDE.md`. It has three subcommands:
`mdd install`, `mdd update`, and `mdd update-ecommerce`.

## Architecture

```
src/cli.ts              Commander.js entrypoint — defines commands and resolves paths
src/install.ts          install() — core copy logic, hook install, CLAUDE.md inject
src/update-ecommerce.ts updateEcommerce() — updates @thedecipherist/mdd-ecommerce-* packages
```

### cli.ts - Command Definitions

Three commands:

**`mdd install`**
- `--dir <path>` — custom destination (default: `~/.claude/commands`)
- `--install-local` — sets destination to `.claude/commands/` in current project
- `--force` — overwrite even if already up to date
- Explicit `--dir` wins over `--install-local`; detection via `getOptionValueSource('dir') === 'cli'`

**`mdd update`**
- Identical to `install --force`; same flags minus `--force` (implied)

**`mdd update-ecommerce`**
- No flags; dynamically imports `update-ecommerce.ts` and calls `updateEcommerce()`

Both `install` and `update` resolve three derived paths before calling `install()`:

| Path variable | Global (`--dir` default) | Local (`--install-local`) |
|---------------|--------------------------|--------------------------|
| `effectiveDir` | `~/.claude/commands` | `<cwd>/.claude/commands` |
| `modesDir` | `~/.claude/mdd` | `<cwd>/.claude/mdd` |
| `claudeMdPath` | `~/.claude/CLAUDE.md` | `<cwd>/CLAUDE.md` |
| `settingsPath` | `~/.claude/settings.json` | `<cwd>/.claude/settings.json` |

When `--dir` is passed explicitly by the user, all three derived paths are set to
`undefined`, which skips hook install and CLAUDE.md injection.

Both commands prompt for the `selfImprovement` preference on first install (TTY only;
skipped in non-interactive shells). The preference is stored in `settings.json` under
`mdd.selfImprovement`.

### install.ts - Core Install Logic

**`install(options)`** is the primary export. It:

1. Resolves `destDir` and `modesDestDir` (handles `~` expansion)
2. Creates both directories with `mkdirSync(..., { recursive: true })`
3. Removes legacy `install-mdd.md` leftover if present
4. Reads all `.md` files from `commands/`; sorts so `mdd.md` comes first
5. For each file:
   - Mode files (`!= mdd.md`) go to `modesDestDir`; cleans up legacy copies in `destDir`
   - `mdd.md` gets version-safety check: compares `mdd_version:` frontmatter field;
     skips overwrite if installed version >= bundled version (unless `--force`)
   - If versions differ, writes with `stampDescription()` applied
   - Mode files are always overwritten silently (no version check)
6. Calls `injectClaudeGuidance()` if `claudeMdPath` is set
7. Calls `installHook()` if `settingsPath` is set
8. Calls `writeSelfImprovementPref()` if `selfImprovement` preference was just set

**`stampDescription(content, scope, version)`** rewrites the `description:` line in
`mdd.md` frontmatter to stamp `(global v1.8.7)` or `(local v1.8.7)` as a prefix.
Uses a regex that strips any previous stamp before writing the new one.

**`getMddVersion(content)`** reads the `mdd_version: N` frontmatter field and returns
it as an integer. Returns 0 if absent.

**`injectClaudeGuidance(claudeMdPath, local, force)`** writes the MDD guidance block
into `CLAUDE.md`. Two block variants:
- Global: `## MDD - Manual-First Development` - describes the "does it already exist?"
  suggestion behavior for non-MDD invocations
- Local: `## MDD - Build Approach` - documents the project's MDD workflow for Claude

Block is delimited by `<!-- mdd-guidance-start -->` / `<!-- mdd-guidance-end -->` markers
so `mdd update --force` can replace it without breaking surrounding content. Handles three
states:
- Delimited block present: skip (if current) or update (if `--force`)
- Legacy bare marker present: skip (if not force) or migrate to delimited format
- No block: append to end of file

**`installHook(opts)`** registers `mdd-branch-guard.sh` as a PreToolUse hook:
1. Copies `commands/mdd-branch-guard.sh` to `hooksDir` and chmod 755
2. Reads `settings.json` (or starts fresh if absent)
3. Checks for existing hook by scanning for `'mdd-branch-guard'` in command strings
4. If not found: appends `{ matcher: 'Write|Edit|NotebookEdit', hooks: [{ type: 'command', command: hookCommand }] }` to `hooks.PreToolUse`
5. Writes updated `settings.json`

Hook command form:
- Local: `bash .claude/hooks/mdd-branch-guard.sh`
- Global: `bash $HOME/.claude/hooks/mdd-branch-guard.sh`

**`writeSelfImprovementPref(settingsPath, value)`** writes `settings.mdd.selfImprovement`
to `settings.json`. Idempotent - skips if already set.

**`getSelfImprovementPref(settingsPath)`** (exported) reads the current preference.
Returns `true`, `false`, or `null` (unset).

### update-ecommerce.ts - Ecommerce Package Updater

**`updateEcommerce()`** updates all `@thedecipherist/mdd-ecommerce-*` packages in the
current project:

1. Reads `package.json` from `cwd()`; exits if not found
2. Scans `dependencies`, `devDependencies`, `peerDependencies` for packages matching
   the `@thedecipherist/mdd-ecommerce-` prefix
3. Detects package manager by checking for lockfiles (`pnpm-lock.yaml`, `yarn.lock`,
   `package-lock.json`)
4. Runs `<pm> update <package-names>` via `execSync` with `stdio: 'inherit'`
5. Re-reads versions after update and compares
6. Flags major bumps and warns to check `site.config.ts` slot wiring
7. Checks if updated package has a `.mdd/docs/` directory in `node_modules` and reports its path

## Business Rules

- `--install-local` is overridden by explicit `--dir` (not by default `--dir` value)
- `mdd.md` version check: bundled `mdd_version` must be strictly greater than installed
  `mdd_version` to trigger an overwrite without `--force`
- Mode files have no version check - they are always overwritten
- The `selfImprovement` prompt only fires on TTY; non-interactive shells never prompt
- CLAUDE.md injection: `--force` is required to update an existing delimited block
  that is outdated; without `--force` it reports "outdated - run `mdd update` to refresh"
- Hook idempotency: if any existing PreToolUse entry's command contains `mdd-branch-guard`,
  the hook is not re-added
- `update-ecommerce` uses `execSync` with package names taken from `package.json` keys -
  the prefix filter (`@thedecipherist/mdd-ecommerce-`) is the only sanitisation applied

## Data Flow

Reads: `commands/*.md` (source), `package.json` (version), installed `mdd.md` (version
check), `settings.json` (hook idempotency check, selfImprovement), `CLAUDE.md` (guidance
injection check).
Writes: `~/.claude/commands/mdd.md`, `~/.claude/mdd/*.md`, `~/.claude/hooks/mdd-branch-guard.sh`,
`~/.claude/settings.json`, `~/.claude/CLAUDE.md` (global) or same paths under `<cwd>/.claude/`
(local).

## Dependencies

Requires `01-mdd` for the command files being installed. Installs `16-scripts` (branch guard).

## Security

- `update-ecommerce` constructs a shell command by joining package names with spaces.
  The prefix filter `@thedecipherist/mdd-ecommerce-` is the only input sanitisation.
  A package.json with a crafted key matching the prefix could inject shell tokens.
  Actual risk is low (attacker would need write access to package.json) but the pattern
  is not hardened.
- `JSON.parse` results in install.ts are cast with `as Record<string, unknown>` without
  runtime field validation. Parsing attacker-controlled settings.json could produce
  unexpected shapes, but callers access known keys only.

## Known Issues

- `update-ecommerce.ts` constructs the update command by joining raw package names from
  `package.json` with spaces (`packageNames.join(' ')`). Package names that contain
  shell metacharacters could inject commands. The `@thedecipherist/mdd-ecommerce-` prefix
  filter reduces but does not eliminate this risk.
- `update-ecommerce.ts` has no corresponding MDD feature doc in the old doc set and was
  noted as a P4 audit finding. It now lives here in this doc.
- `stampDescription` is called on `mdd.md` even when the version is unchanged (to update
  npm version in the description). This means `mdd.md` may be written on every `mdd install`
  run even with no actual version change.
- The `selfImprovement` prompt fires before `install()` is called. If install fails
  partway through, the preference may be written to settings.json without the actual
  install completing.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
