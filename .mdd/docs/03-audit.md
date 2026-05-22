---
id: 03-audit
title: Audit Mode - Multi-Agent Parallel Codebase Audit
edition: MDD
depends_on: [01-mdd]
relates: [00-frontmatter-spec, 02-build, 11-manage, 08-security-rules]
source_files:
  - commands/mdd-audit.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [audit, multi-agent, manifest, parallel, p1-p2-p3-p4, findings, integration-contracts, incremental]
path: Commands/Audit
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 03 - Audit Mode - Multi-Agent Parallel Codebase Audit

## Purpose

AUDIT MODE runs a parallel multi-agent code review across all source files referenced in MDD
feature docs. It produces a structured findings report with severity rankings (P1-P4), verifies
integration contracts, and can fix issues automatically. Triggered by `/mdd audit`.

## Architecture

```
Stack Rule Loading — extend audit criteria from mdd-rules-<stack>.md
Phase A1  Scope          — feature map, doc cross-checks, manifest creation, agent scaling
Phase A2  Config Setup   — shard files, integration-context.md, per-agent config files
Phase A3  Agent Exec     — all agents run in parallel; each processes its file shard
Phase A4  Convergence    — verify all files marked; re-run any incomplete agents
Phase A5  Merge          — merge agent notes in manifest order into audits/notes-<date>.md
Phase A6  Analyze        — synthesize into audits/report-<date>.md; copy manifest; cleanup job
Phase A7  Fix            — optional fix loop; rebuild startup.md and connections.md
Phase A8  Self-Review    — extract workflow improvements; optionally open GitHub issue
```

### Agent Scaling (Phase A1)

File count determines agent count: <10 files → 1 (single-feature mode, no sharding); 10-25 → 2;
26-50 → 3; 51-100 → 5; 100+ → 8. Files are sharded by estimated token load (file size), not
raw count, so each agent has a balanced analysis budget. `$MDD_MAX_AGENTS` env var can override
the ceiling.

### Multi-Agent Parallel Execution (Phase A3)

All agents spawn simultaneously. Each agent:
1. Reads its config file → finds its shard → locates first `[ ]` file in MANIFEST
2. For each file: marks `[~]` → reads source → analyzes → writes findings to its own notes
   file → marks `[x]` or `[!]` → clears context (every file, no exceptions)
3. On context clear/restart: re-reads config, shard, MANIFEST, last 20 lines of own notes,
   and `integration-context.md`

Agents never touch other agents' files or the shared MANIFEST outside marking their own shard entries.
Each file's findings end with a mandatory `Contracts:` line: `SATISFIED`, `VIOLATION`, or `(none)`.

### Integration Context (Phase A2)

Built once by main before spawning agents. Contains:
- Feature-to-source-file mappings
- All `integration_contracts` and their caller features
- All `satisfies_contracts` acknowledgments

Agents read this at startup and after every context clear to maintain cross-file contract awareness.

### Manifest-Based Resume (Phase A1)

Before starting, checks `.mdd/jobs/` for an existing `audit-*/` folder:
- If a completed report exists → stale cleanup, proceed fresh
- If no report → interrupted job; presents `[R] Resume` or `[D] Discard` choice

Resume picks up from the first `[ ]` entry per agent; completed files (`[x]`, `[!]`, `[e]`) are
never re-processed.

### Incremental Scope (Phase A1)

If a prior audit exists, offers:
- **Full:** regenerate manifest from all source files
- **Incremental:** only files changed since last audit commit (`git diff --name-only <last-commit>`)
  plus untracked new files (`git ls-files --others --exclude-standard`)

### Severity Levels

| Level | Criteria |
|-------|----------|
| P1 | `eval()`, hardcoded secrets, missing security enforcement, unmutated "immutable" arrays, unvalidated MCP/external input, cached data without masking |
| P2 | TypeScript `any`, missing `.js` ESM extensions, `console.log` in library code, file/function over size limit, unhandled node types, missing switch `default`, unvalidated MCP params |
| P3 | Strict mode missing, missing error handling at boundaries, missing tests for documented rules, CLI missing universal flags, path traversal without jailRoot |
| P4 | Style inconsistencies, dead code, minor spec divergences |

### Feature Doc Cross-Checks (Phase A1)

Runs before agent spawning:
- Every path in `source_files` must exist on disk (missing = P2)
- Features with dependencies + integration_contracts must have `satisfies_contracts` (missing = P2)
- Every `satisfies_contracts` with `status: pending` is P1
- `security_read_sites` entries must have a path-confinement call nearby (missing = P1)

## Business Rules

- Phase A4 convergence: does NOT advance to A5 until every file is `[x]`, `[!]`, or `[e]`
- All agents must be spawned before any results are read (simultaneous launch)
- Agent prompts include only the path to their config file; the config file is self-contained
- Integration contract verification in Phase A6 re-reads source files independently to catch
  agents that missed the `Contracts:` line
- Self-improvement gate (Phase A8) can be disabled by setting `mdd.selfImprovement: false`
  in `.claude/settings.json` or `~/.claude/settings.json`
- The incremental fallback uses `audits/MANIFEST-<date>.md` mtime, but this file does not
  exist until Phase A6 - on a first-ever audit the fallback silently fails (P3 known issue)

## Data Flow

Reads: all `.mdd/docs/*.md` and `.mdd/ops/*.md` frontmatter; all source files listed in
`source_files` across all feature docs; `settings.json` for `mdd.selfImprovement` gate.

Writes: `audits/report-<date>.md`, `audits/notes-<date>.md`, `audits/MANIFEST-<date>.md`,
`audits/doc-findings-<date>.md`, `audits/mdd-learnings.md`. Updates `.mdd/.startup.md`,
`.mdd/connections.md`, and any feature docs where tags are added or issues are fixed.

## Dependencies

Requires `01-mdd` (router + bootstrap + settings bootstrap must run first).

## Security

Reads local project files only. No network calls. The `security_read_sites` cross-check in
Phase A1 is the primary mechanism for detecting unsanitized path reads across the codebase.

## Known Issues

- `$AUDIT_TARGET` is passed to all phase log calls but is never assigned in the command file.
  The context column in `~/.claude/mdd/log.md` is blank for every audit invocation.
- The incremental fallback references `audits/MANIFEST-<date>.md` before it exists on the
  first-ever audit (no prior commit recorded). The fallback silently fails with no recovery path.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
