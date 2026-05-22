---
id: 19-github-issue-fixes
title: GitHub Issue Workflow - Surfacing Audit Findings as Public Issues
edition: MDD
depends_on: [01-mdd, 03-audit]
relates: [14-npm-cli]
source_files: []
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [github-issues, self-improvement, audit-findings, workflow-gaps, bug-reporting, settings-json]
path: Operations/Quality
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 19 - GitHub Issue Workflow - Surfacing Audit Findings as Public Issues

## Purpose

When MDD audits find bugs, gaps, or workflow flaws in an MDD project, the project's
`CLAUDE.md` instructs Claude to offer opening a GitHub issue at the MDD repo
(`https://github.com/TheDecipherist/mdd/issues`) so the finding can improve the
workflow for all users. This behavior is opt-in via a `selfImprovement` preference
set during `mdd install`. The workflow bridges the gap between project-specific bug
discovery and upstream MDD improvements.

## Architecture

Two components:

```
settings.json    mdd.selfImprovement: true/false  — user preference
CLAUDE.md        "Learning from mistakes" section — triggers Claude's offer behavior
```

### selfImprovement Preference

Set interactively during `mdd install` or `mdd update` (TTY only):

```
Help improve MDD by suggesting GitHub issues when audits find workflow gaps? [y/N]
```

Stored in `settings.json`:
```json
{
  "mdd": {
    "selfImprovement": true
  }
}
```

- `true` - audit mode will offer to open a GitHub issue when it finds a workflow gap
- `false` - audit mode never asks about GitHub issues
- absent - treated as false (the prompt was never answered or was skipped)

Managed by `writeSelfImprovementPref()` and `getSelfImprovementPref()` in `install.ts`.
The prompt only fires if the preference has not been set (`null` from `getSelfImprovementPref`).
Once set, it is never overwritten without user action.

### CLAUDE.md Learning from Mistakes Section

The project `CLAUDE.md` (injected by `mdd install --install-local`) contains:

> All code in this project is built via the MDD workflow. Whenever a bug, flaw, or
> gap is found - or if a feature doc changes or gains new frontmatter fields - document
> why it happened and how it could have been prevented. When a fix is identified, ask
> the user if you should open a GitHub issue on their behalf at
> https://github.com/TheDecipherist/mdd/issues with a clear description of the problem
> and a suggested fix so it can be patched in the workflow for all users.

This instruction is in the **project** CLAUDE.md (not the global one). It directs
Claude to proactively surface workflow improvements during any MDD project session,
not just during audits.

### Issue Creation via gh CLI

When Claude offers to open an issue and the user agrees, Claude uses:
```bash
gh issue create \
  --title "<short description>" \
  --body "<problem description + suggested fix>" \
  --repo TheDecipherist/mdd
```

The issue body should contain:
- What the problem is (the specific bug or gap)
- Where it occurs (which command file, which phase)
- A suggested fix
- Optionally: steps to reproduce

## Business Rules

- Issue creation is always user-confirmed - Claude asks, never auto-creates
- The `selfImprovement` preference gates whether audit mode mentions the GitHub issue
  option at all; the CLAUDE.md instruction applies unconditionally in any session
- Issues are opened at `TheDecipherist/mdd` (the public repo), not the user's project repo
- The `selfImprovement` prompt fires only once per install and only in TTY mode
- A user who opts out of `selfImprovement` can still be asked about issues by the
  CLAUDE.md instruction - the preference only affects automated audit behavior,
  not the general CLAUDE.md rule

## Data Flow

Reads: `~/.claude/settings.json` or `.claude/settings.json` (`mdd.selfImprovement` field).
Writes: GitHub issue (via `gh issue create`); nothing locally.

## Dependencies

Requires `03-audit` for the audit mode that surfaces findings. Uses `14-npm-cli`
(install.ts) for the preference storage mechanism.

## Security

- GitHub issue creation uses the `gh` CLI, which reads from `~/.config/gh/` or
  uses the `GITHUB_TOKEN` environment variable. No credentials are stored in the project.
- Issue content comes from audit findings - no user-supplied untrusted input is
  passed to the shell command (Claude constructs the content).

## Known Issues

- The `selfImprovement` preference is stored per-install location (global vs local).
  A user who installs globally and sets `selfImprovement: false` will still get the
  prompt when they run `mdd install --install-local` in a project, because the local
  `settings.json` has no `mdd.selfImprovement` entry yet.
- The CLAUDE.md "learning from mistakes" instruction applies in all MDD sessions,
  including sessions where the user opted out of `selfImprovement`. The preference
  and the CLAUDE.md instruction are not fully consistent.
- There is no tracking of which issues have already been opened. If an audit finds
  the same gap in multiple sessions, Claude may offer to open the same issue multiple
  times.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
