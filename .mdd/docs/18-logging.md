---
id: 18-logging
title: Phase Logger - mdd-log-phase.sh Command Log
edition: MDD
depends_on: [01-mdd]
relates: [03-audit]
source_files:
  - commands/mdd-log-phase.sh
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [logging, phase-log, mdd-log-phase, hook, token-tracking, session-log, benchmarking]
path: Operations/Logging
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 18 - Phase Logger - mdd-log-phase.sh Command Log

## Purpose

`mdd-log-phase.sh` is a bash script installed to `~/.claude/hooks/` that logs every
MDD phase transition to `~/.claude/mdd/log.md`. It records command, phase, event,
context, timestamp, and current token usage. It exists to benchmark v1 performance and
track session behavior over time.

## Architecture

The script is installed by `mdd install` alongside the branch guard hook. It is called
by all mode files at phase boundaries when `$MDD_PHASE_LOGGING` is `true` (the default).

### Invocation

```bash
bash ~/.claude/hooks/mdd-log-phase.sh COMMAND PHASE EVENT [CONTEXT]
```

| Argument | Description | Example |
|----------|------------|---------|
| COMMAND | The mdd command being run | `mdd` |
| PHASE | Current phase identifier | `B1`, `A3`, `status` |
| EVENT | `start`, `complete`, `error`, or similar | `start` |
| CONTEXT | Optional freeform context string | `01-auth` |

### Log Format

Appended to `~/.claude/mdd/log.md` as a markdown table row:

```
| Date | Command | Phase | Event | Context | Time | Tokens |
| 2026-05-21 | mdd | B1 | start | 03-user-auth | 14:32:01 | 45K/200K |
```

The `Tokens` column is populated by calling `compressmcp --status` and extracting
the first `NNN K/NNN K` pattern from its output. If `compressmcp` is unavailable or
returns no matching output, the column is set to `-`.

### Initialization

On first run, the script creates `~/.claude/mdd/log.md` with a header block containing
both a `## Sessions` table and a `## Phase Log` table.

The script includes migration logic for older log formats:
- 4-column Phase Log (Date/Phase/Event/Time) - migrates to 7-column format
- 6-column Phase Log (without Context column) - migrates to 7-column format

### Phase Logging Gate

Every mode file wraps log calls in a guard:
```bash
[ "$MDD_PHASE_LOGGING" = "false" ] || bash ~/.claude/hooks/mdd-log-phase.sh ...
```

This means phase logging is on by default and must be explicitly disabled by setting
`phaseLogging: false` in `.mdd/settings.json`.

## Business Rules

- Phase logging is enabled by default (`phaseLogging: true` in settings)
- The gate form must be `[ "$MDD_PHASE_LOGGING" = "false" ] || ...` - not an
  affirmative check, to preserve the default-on behavior
- CONTEXT argument is optional; when absent it defaults to `-`
- Log file is always at `~/.claude/mdd/log.md` - there is no project-local log

## Data Flow

Reads: `$MDD_PHASE_LOGGING` (set by `mdd.md` Step 0c from `settings.json`).
Writes: `~/.claude/mdd/log.md`.

## Dependencies

Installed alongside `mdd install`. Called by all mode files. Token count requires
`compressmcp` to be available in PATH.

## Security

Not applicable - writes to a local log file. No user input is processed. CONTEXT
argument comes from command file constants, not user input.

## Known Issues

- (fixed) `mdd-log-phase.sh` was not previously included in the npm package. Added to
  `commands/` and wired into `install.ts` alongside `mdd-branch-guard.sh`.
- The CONTEXT argument is appended directly as a table cell without sanitisation.
  If a CONTEXT value contains a pipe character (`|`), it will break the markdown
  table row. All current callers use safe values, but this is a latent bug if
  CONTEXT ever comes from a feature ID or file path with a pipe.
- `compressmcp --status` is called on every log write. If `compressmcp` is slow or
  hangs, all phase log calls will block. There is no timeout.
- The `## Sessions` table in the log header is initialized but never written to by
  the current script. It is a placeholder from an earlier design.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
