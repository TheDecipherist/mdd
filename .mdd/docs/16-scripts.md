---
id: 16-scripts
title: Branch Guard Script - PreToolUse Hook for Main Branch Protection
edition: MDD
depends_on: [01-mdd, 14-npm-cli]
relates: []
source_files:
  - commands/mdd-branch-guard.sh
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [branch-guard, pretooluse, hook, main-protection, auto-branch, dirty-tree, write-block, claude-code-hooks]
path: Source/Scripts
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 16 - Branch Guard Script - PreToolUse Hook for Main Branch Protection

## Purpose

`mdd-branch-guard.sh` is a Claude Code `PreToolUse` hook that blocks write operations
on `main` or `master` in MDD projects. It fires before every `Write`, `Edit`, and
`NotebookEdit` tool call. On a clean working tree it auto-creates a new branch and
allows the write. On a dirty tree it blocks with exit code 2 and instructs the user
how to proceed.

## Architecture

The hook is installed by `mdd install` to:
- Global: `~/.claude/hooks/mdd-branch-guard.sh`
- Local: `.claude/hooks/mdd-branch-guard.sh`

It is registered in `settings.json` as a `PreToolUse` entry:

```json
{
  "matcher": "Write|Edit|NotebookEdit",
  "hooks": [{ "type": "command", "command": "bash $HOME/.claude/hooks/mdd-branch-guard.sh" }]
}
```

### Execution Flow

```
1. Check for .mdd/ directory  — exit 0 (no-op) if not an MDD project
2. Read current branch         — exit 0 if HEAD is detached or branch is empty
3. Check if branch is main/master — exit 0 if not
4. Check for uncommitted changes (git status --porcelain | wc -l)

   Clean tree:
     — auto-create branch: mdd/session-YYYYMMDD-HHMMSS
     — print notification message
     — exit 0 (write is allowed)

   Dirty tree:
     — print block message with three recovery options
     — exit 2 (write is blocked)
```

### Auto-Branch Naming

Auto-created branches use the format `mdd/session-YYYYMMDD-HHMMSS`. These are
session-scoped — each blocked-then-auto-branched write gets a new timestamped branch.
The user is expected to rename or delete the session branch after the work is done.

### Dirty Tree Message

The hook prints a structured block message directing Claude to use `AskUserQuestion`:

```
⛔  MDD BRANCH GUARD

    Branch 'main' has N uncommitted change(s).
    Use AskUserQuestion to ask the user:
    Question: 'You have uncommitted changes on main. How would you like to proceed?'
    Options:
      1. Commit changes — run: git add -A && git commit -m 'wip: save before branch' && git checkout -b feat/<name>
      2. Stash changes — run: git stash && git checkout -b feat/<name>
      3. Cancel — do nothing
```

The three options map to BRANCH GUARD Scenario A in `mdd.md`: commit, stash, or abort.

## Business Rules

- The hook is a no-op if `.mdd/` does not exist - only active in MDD projects
- The hook is a no-op on any branch other than `main` or `master`
- Clean tree on main/master: auto-branch and allow (exit 0)
- Dirty tree on main/master: block (exit 2)
- Exit code 2 causes Claude Code to block the tool call and surface the hook output
- The auto-branch name is always `mdd/session-<timestamp>` regardless of task context;
  the user or Claude is expected to rename it to a meaningful branch afterward
- The release runbook (`ops/release.md`) must use `bash sed` to bump the version in
  `package.json` because Edit/Write are blocked by this hook on main; the runbook
  documents this explicitly in Step 2

## Data Flow

Reads: `.mdd/` (existence check), `git branch --show-current`, `git status --porcelain`.
Writes: creates a new git branch (clean tree path only).

## Dependencies

Installed by `14-npm-cli`. Referenced by `01-mdd` (Branch Guard section).

## Security

Not applicable - reads git state, creates a branch. No user-supplied input is
processed. No file content is read or written except via the git branch creation.

## Known Issues

- Auto-branch name `mdd/session-YYYYMMDD-HHMMSS` is not derived from the task context.
  A user running multiple sessions in quick succession gets multiple indistinguishable
  `mdd/session-*` branches with no hint about their purpose.
- The hook blocks `NotebookEdit` as well as `Write` and `Edit`. Jupyter notebook edits
  in non-notebook MDD projects will trigger the guard unnecessarily if the user happens
  to be on main.
- The release runbook works around this hook by using `bash sed` for the version bump.
  If a future release step needs to use Edit/Write on main, it must also use bash
  workarounds - there is no official bypass mechanism other than `git checkout` to a
  feature branch first.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
