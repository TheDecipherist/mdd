---
id: 01-mdd
title: MDD Router - Bootstrap, Mode Dispatch, Branch Guard
edition: MDD
depends_on: []
relates: [00-frontmatter-spec, 02-build, 03-audit, 04-plan, 05-ops, 06-bug]
source_files:
  - commands/mdd.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [router, bootstrap, branch-guard, settings, dispatch, worktree, stack-detection, mdd_version]
path: Commands/Router
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 01 - MDD Router - Bootstrap, Mode Dispatch, Branch Guard

## Purpose

`commands/mdd.md` is the entry point for every `/mdd` invocation. It bootstraps the project
structure, loads settings, determines which mode to run, and enforces the branch guard before
any files are created or modified.

## Architecture

Every `/mdd` call goes through four sequential steps before any mode-specific work runs:

```
Step 0    Worktree check
Step 0a   Bootstrap check — create .mdd/ structure if missing
Step 0c   Settings bootstrap — load settings.json, detect stack
Step 0b   Mode dispatch — read arguments, load appropriate mode file
          Branch Guard — block writes on main/master
```

After dispatch, all mode-specific logic lives in dedicated command files (`mdd-build.md`,
`mdd-audit.md`, etc.). The router intentionally stays minimal so that any `/mdd` invocation
loads only its own mode file in addition to the router itself.

### Worktree Check (Step 0)

Runs before everything else. Asks the user whether to work in the current directory or create
an isolated worktree for parallel `/mdd` sessions. If the user chooses a worktree:
- Derives a slug from the arguments
- Runs `/worktree mdd-<slug>` to create a sibling directory with its own branch
- Stops - the user re-runs `/mdd` in the new directory

### Bootstrap Check (Step 0a)

Runs silently for every mode. Creates any missing `.mdd/` subdirectories and `.mdd/.startup.md`.
Reports only if something was actually created. Also ensures `.mdd/audits/` and `.mdd/jobs/`
are present in `.gitignore`.

Bootstrap also creates `.mdd/docs/00-frontmatter-spec.md` if it does not exist, copying the
canonical content from the installed version in `$MDD_DIR/` (see `00-frontmatter-spec`).

**Directories created when missing:**
- `.mdd/` - project root
- `.mdd/docs/` - feature docs
- `.mdd/audits/` - audit reports (gitignored)
- `.mdd/ops/` - ops runbooks
- `.mdd/jobs/` - active wave jobs (gitignored)

### Settings Bootstrap (Step 0c)

Runs silently for every mode. Reads `.mdd/settings.json`, creating it with defaults if missing.

**Settings fields:**
- `autoDiscovery` - whether to scan manifest files for stack detection
- `stack` - detected stack (language, runtime, frameworks, orm, auth)
- `overrides` - manual additions to the stack (never overwritten by auto-discovery)
- `phaseLogging` - whether to call `mdd-log-phase.sh` on each build phase
- `securityScan` - whether to run `mdd-security-rules` after each audit

**Stack detection** reads `package.json`, `go.mod`, `pyproject.toml`, and `composer.json` in
the project root. For `package.json`, it maps specific dependency names to stack categories.
Detected values are written back to `settings.json` non-destructively.

**Session variables set:**
- `$MDD_PHASE_LOGGING` - from `settings.phaseLogging`
- `$MDD_SECURITY_SCAN` - from `settings.securityScan`
- `$MDD_STACK` - merged flat array of all stack + override values
- `$MDD_DIR` - path to the installed MDD command files directory

### Mode Dispatch (Step 0b)

Reads `$ARGUMENTS` and maps the first word to a mode file:

| Argument prefix | Mode file | Mode |
|----------------|-----------|------|
| `audit` | `mdd-audit.md` | Audit mode |
| `status`, `note`, `scan`, `update`, `deprecate`, `rebuild-tags`, `connect` | `mdd-manage.md` | Manage modes |
| `import-spec` | `mdd-import-spec.md` | Import spec mode |
| `reverse-engineer`, `reverse`, `graph`, `upgrade` | `mdd-lifecycle.md` | Lifecycle modes |
| `plan-*` | `mdd-plan.md` | Plan modes |
| `ops`, `runop`, `update-op`, `commands` | `mdd-ops.md` | Ops modes |
| `manual` | `mdd-manual.md` | Manual mode |
| `bug` | `mdd-bug.md` | Bug mode |
| `security-rules` | `mdd-security-rules.md` | Security rules mode |
| (empty) | - | Ask user what to do |
| (anything else) | `mdd-build.md` | Build mode |

Mode file search order: `.claude/mdd/` (local) → `~/.claude/mdd/` (global) → `.claude/commands/`
(local legacy) → `~/.claude/commands/` (global legacy). Uses whichever contains `mdd-audit.md`.

Before reading the mode file, logs the invocation:
```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd" "-" "invoked" "$ARGUMENTS"
```

### Branch Guard

Runs before any file creation or modification. Hard blocks on `main`/`master`.

- **main + uncommitted changes** - offers three choices: commit now, stash now, or abort
- **main + clean** - auto-branches using mode-specific naming (e.g. `feat/<slug>`, `fix/mdd-audit-<date>`)
- **feature branch** - expected and fine; mode-level Phase 0 checks for mismatch
- **audit branch (`fix/mdd-audit-*`)** - build and plan modes must not reuse; treated as Scenario B

### CLAUDE.md Update Trigger

After any MDD operation that changes code, the router suggests updating `CLAUDE.md` if new
patterns were established. This is the feedback loop that keeps project conventions up to date.

## Business Rules

- Bootstrap (Step 0a and 0c) runs for ALL modes with no exceptions
- Bootstrap never halts on a missing optional file - it creates the default and continues
- Settings bootstrap emits at most one warning if `settings.json` is unreadable, then uses defaults
- Mode dispatch fires the invocation log BEFORE reading the mode file
- The invocation log is ungated (fires regardless of `$MDD_PHASE_LOGGING`) - this is a known
  P2 audit finding; all other log calls in mode files are gated by the `$MDD_PHASE_LOGGING` check
- Branch guard never executes when a worktree was chosen in Step 0

## Data Flow

Greenfield - the router reads project files (settings.json, .gitignore, package.json) but does
not define data flows itself. Each mode file documents its own data flows.

## Dependencies

None. This is the root command.

## Security

Not applicable - the router does not accept external input, store data, or spawn network calls.
Stack detection reads local manifest files only.

## Known Issues

- The invocation log call at line 229 fires unconditionally regardless of `$MDD_PHASE_LOGGING`.
  All other log calls across mode files use the gate guard. This inconsistency means even when
  phase logging is disabled, the invocation event is still written to log.md.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
