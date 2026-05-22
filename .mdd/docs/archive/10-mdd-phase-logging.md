---
id: 10-mdd-phase-logging
title: MDD Phase Logging
edition: Both
depends_on: []
source_files:
  - ~/.claude/hooks/mdd-log-phase.sh
  - commands/mdd.md
  - commands/mdd-build.md
  - commands/mdd-audit.md
  - commands/mdd-manage.md
  - commands/mdd-ops.md
  - commands/mdd-plan.md
  - commands/mdd-bug.md
  - commands/mdd-lifecycle.md
  - commands/mdd-manual.md
  - commands/mdd-import-spec.md
  - commands/mdd-framework.md
test_files: []
data_flow: greenfield
last_synced: 2026-05-20
status: complete
phase: all
mdd_version: 1
tags: [logging, phases, benchmarking, hooks, commands, telemetry, tooling]
path: Tooling/Logging
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 10 - MDD Phase Logging

## Purpose

Every `/mdd` invocation should produce a complete audit trail in `~/.claude/mdd/log.md`: what was invoked, every phase that ran (start and end), what it was working on, and when it finished. The log is used to benchmark mdd v1 against mdd2 and diagnose performance problems.

The current implementation has a critical reliability flaw: logging instructions live in a top-level "Phase Logging" section that Claude treats as advisory guidance. Claude frequently skips end events, skips phases entirely, and fails to capture tokens. The fix is to embed the log command as a **mandatory inline bash block** at every event boundary — invocation, each phase start/end, and completion — so Claude encounters it directly and cannot skip it.

## Architecture

Two layers:

1. **`mdd-log-phase.sh`** — a shell script that handles file creation, header init, token capture, and writing the log row. Called by `mdd.md` and all command files.

2. **`mdd.md`** (the router) — logs a single `invoked` event right after mode detection in Step 0b, before dispatching to any mode file. This records what was invoked and when, regardless of what happens next.

3. **Command files** (`commands/*.md`) — each phase section begins and ends with an explicit `bash` code block calling `mdd-log-phase.sh`. The final phase of each command file also logs a `complete` event after its `end` entry.

```
/mdd build user-auth
  └── mdd.md Step 0b (mode detected)
        └── mdd-log-phase.sh "mdd" "-" "invoked" "build user-auth"   ← logged immediately
  └── Claude reads mdd-build.md
        └── Phase 0
              └── mdd-log-phase.sh "mdd-build" "Phase 0" "start" "user-auth"
              └── [phase work]
              └── mdd-log-phase.sh "mdd-build" "Phase 0" "end" "user-auth"
        └── Phase 1 ... Phase 7
              └── [start/end blocks for every phase]
        └── Final phase (Phase 7d)
              └── mdd-log-phase.sh "mdd-build" "Phase 7d" "end" "user-auth"
              └── mdd-log-phase.sh "mdd-build" "-" "complete" "user-auth"  ← logged on finish
```

## Data Model

Log file: `~/.claude/mdd/log.md`

### Sessions table (existing — unchanged)

Managed by `mdd-log-start.sh` and `mdd-log-stop.sh` hooks.

```
| Date | Command | Project | Start | End | Duration | Context |
```

### Phase Log table (updated schema)

```
| Date | Command | Phase | Event | Context | Time | Tokens |
```

- **Date** - `YYYY-MM-DD`
- **Command** - which mdd command file ran the phase (e.g., `mdd-build`, `mdd-plan`)
- **Phase** - phase identifier (e.g., `Phase 0`, `Phase A1`, `Phase PE1`)
- **Event** - `invoked`, `start`, `end`, or `complete`
- **Context** - what is being worked on: feature slug, wave slug, feature ID, runbook slug, etc. (e.g., `user-auth`, `wave-checkout`, `03-install-local`)
- **Time** - `HH:MM:SS`
- **Tokens** - current context window usage from `compressmcp --status` (e.g., `85K/200K`), or `-` if unavailable

Existing 4-column log rows remain valid — the script detects and migrates the header on first write using the new schema.

## Business Rules

### Rule 1 - Inline placement, not advisory

Log commands are placed **inline** as the first and last bash blocks in each phase section. They are not described in a top-level rule that Claude must remember. Every phase that Claude executes will have these blocks visible and will run them.

### Rule 2 - Script signature

```bash
bash ~/.claude/hooks/mdd-log-phase.sh COMMAND PHASE EVENT [CONTEXT]
```

- `COMMAND` - hardcoded per file (e.g., `mdd-build`)
- `PHASE` - hardcoded per phase section (e.g., `Phase 0`)
- `EVENT` - `start` or `end`
- `CONTEXT` - what is being worked on, derived from `$ARGUMENTS` for every command (e.g., feature slug, wave slug, feature ID, runbook slug)

### Rule 3 - Every command passes context from $ARGUMENTS

Every phase log call passes a 4th `CONTEXT` argument derived from `$ARGUMENTS`. Claude substitutes the actual value at runtime. This captures what is being worked on:

| Command | Context value |
|---------|--------------|
| `mdd-build` | Feature slug from `$ARGUMENTS` (e.g., `user-auth`) |
| `mdd-plan` | Initiative or wave slug (e.g., `wave-checkout`, `init-payments`) |
| `mdd-audit` | Feature ID or section being audited (e.g., `03-install-local`, `all`) |
| `mdd-manage` | Feature ID or mode target (e.g., `05-import-spec`, `status`) |
| `mdd-ops` | Runbook slug (e.g., `deploy-prod`) |
| `mdd-bug` | Bug slug derived from description (e.g., `auth-token-expiry`) |
| `mdd-lifecycle` | Feature ID or path being processed |
| `mdd-manual` | `all` or specific section |
| `mdd-import-spec` | Spec filename(s) |
| `mdd-framework` | Sub-mode and feature slug |

Example calls:
```bash
# mdd-build working on "user auth" feature
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-build" "Phase 1" start "user-auth"

# mdd-plan executing wave "wave-checkout"
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-plan" "Phase PE2" start "wave-checkout"

# mdd-audit auditing feature 03
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A1" start "03-install-local"
```

### Rule 4 - Invocation event logged in mdd.md

`mdd.md` logs an `invoked` event in Step 0b immediately after the mode is detected and before dispatching to a mode file. This fires for every `/mdd` call without exception.

```bash
# In mdd.md Step 0b, after mode is determined, before reading mode file:
bash ~/.claude/hooks/mdd-log-phase.sh "mdd" "-" "invoked" "$ARGUMENTS"
```

The `CONTEXT` field is the full `$ARGUMENTS` string so the log shows exactly what the user typed (e.g., `build user-auth`, `audit 03-install-local`, `plan-execute wave-checkout`).

### Rule 5 - Completion event logged at end of each command file

The final phase of each command file appends a `complete` event immediately after its `end` log entry. Phase is `-` since this is a session-level event, not a phase.

```bash
# At the very end of the last phase in each command file:
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-build" "-" "complete" "user-auth"
```

Final phases per command file:
| File | Final phase |
|------|-------------|
| `mdd-build.md` | Phase 7d (Commit & Merge) |
| `mdd-audit.md` | Phase A8 (MDD Self-Review) |
| `mdd-manage.md` | Last step of each mode (STATUS, NOTE, SC3, U6, D3, RT4, CONNECT) |
| `mdd-ops.md` | Last step of each mode (OP4, RO5, UO3, OL, CM) |
| `mdd-plan.md` | Last step of each mode (PI4, PW5, PE4, PS3, PRF2, PCI3) |
| `mdd-bug.md` | Phase B5 (Mark Complete) |
| `mdd-lifecycle.md` | Last step of each mode (R4, G3, UP5) |
| `mdd-manual.md` | Phase M5 (Write Hashes & Report) |
| `mdd-import-spec.md` | Phase IS5 (Finalise) |
| `mdd-framework.md` | Step 6 (Report) |

### Rule 7 - Token capture is best-effort

`compressmcp --status` may not be available in all contexts. The script falls back to `-` if it fails. This must never block the log write or cause the phase to error.

### Rule 8 - No top-level Phase Logging sections

All existing `## Phase Logging` sections at the top of command files must be removed. They are replaced by inline blocks only.

### Rule 9 - Log header migration

If the log file exists with the old 4-column Phase Log header (`| Date | Phase | Event | Time |`), the script replaces it with the new 6-column header on first write. Existing 4-column rows are left as-is (they are historical data).

### Rule 10 - All 10 command files updated

Every file in `commands/` that has phases or steps must have inline log blocks. Files in scope:
- `mdd-build.md` — Phase 0, 1, 2, 3, 4, 4b, 5, 6, 7
- `mdd-audit.md` — Phase A1 through A8
- `mdd-manage.md` — STATUS, NOTE, SC1-SC3, U1-U6, D1-D3, RT1-RT4, CONNECT
- `mdd-ops.md` — OP1-OP4, RO1-RO5, UO1-UO3, OL, CM
- `mdd-plan.md` — PI0-PI4, PW1-PW5, PE1-PE4, PS1-PS3, PRF1-PRF2, PCI1-PCI3
- `mdd-bug.md` — B0 through B5
- `mdd-lifecycle.md` — R1-R4, G1-G3, UP1-UP5
- `mdd-manual.md` — M1 through M5
- `mdd-import-spec.md` — IS1, IS2, IS2.5, IS3, IS4, IS5
- `mdd-framework.md` — Step 1 through Step 6 per sub-mode

## Data Flow

Greenfield — no existing data flow to trace.

## Dependencies

None.

## Security

None — log file is local to `~/.claude/mdd/` and never transmitted.

## Implementation Plan

### Block 1 — Update `mdd-log-phase.sh`

Update the script to:
- Accept `(command, phase, event, [context])` — 3 required, 1 optional
- Capture tokens via `compressmcp --status`
- Write 7-column row: `| DATE | COMMAND | PHASE | EVENT | CONTEXT | TIME | TOKENS |`
- Use `-` for CONTEXT when not provided
- Migrate Phase Log header if old 4-column or 6-column format detected

### Block 2 — Update mdd.md (invocation event)

In `commands/mdd.md`, at the end of Step 0b (after mode is detected, before the mode file dispatch), insert:

```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd" "-" "invoked" "$ARGUMENTS"
```

### Block 3 — Update all 10 command files

For each command file:
1. Remove the `## Phase Logging` section at the top
2. At the start of every phase/step heading, insert:
   ```bash
   bash ~/.claude/hooks/mdd-log-phase.sh "mdd-COMMAND" "Phase X" start "CONTEXT"
   ```
3. At the end of every phase/step section (immediately before the next heading), insert:
   ```bash
   bash ~/.claude/hooks/mdd-log-phase.sh "mdd-COMMAND" "Phase X" end "CONTEXT"
   ```
4. At the very end of the final phase, after the `end` entry, insert the completion event:
   ```bash
   bash ~/.claude/hooks/mdd-log-phase.sh "mdd-COMMAND" "-" "complete" "CONTEXT"
   ```
5. Every call includes a `CONTEXT` argument derived from `$ARGUMENTS` per the table in Rule 3. Claude substitutes the actual value at runtime.

### Block 4 — Build, install, and publish

1. `pnpm build`
2. `node dist/cli.js install` — reinstalls updated command files to `~/.claude/mdd/`
3. Bump version to `1.7.2`
4. `npm publish --access public`
5. `npm install -g @thedecipherist/mdd@1.7.2`
6. `mdd update`

## Verification

After Block 4, run `/mdd status` and check `~/.claude/mdd/log.md`. A complete run looks like:

```
| Date       | Command    | Phase    | Event    | Context | Time     | Tokens     |
| 2026-05-20 | mdd        | -        | invoked  | status  | 23:06:51 | 85K/200K  |
| 2026-05-20 | mdd-manage | STATUS   | start    | status  | 23:06:52 | 85K/200K  |
| 2026-05-20 | mdd-manage | STATUS   | end      | status  | 23:07:10 | 88K/200K  |
| 2026-05-20 | mdd-manage | -        | complete | status  | 23:07:10 | 88K/200K  |
```

And for `/mdd build user-auth`:
```
| 2026-05-20 | mdd        | -        | invoked  | build user-auth | 23:10:00 | 90K/200K  |
| 2026-05-20 | mdd-build  | Phase 0  | start    | user-auth       | 23:10:01 | 90K/200K  |
| 2026-05-20 | mdd-build  | Phase 0  | end      | user-auth       | 23:10:15 | 92K/200K  |
| 2026-05-20 | mdd-build  | Phase 1  | start    | user-auth       | 23:10:15 | 92K/200K  |
...
| 2026-05-20 | mdd-build  | Phase 7d | end      | user-auth       | 23:45:00 | 150K/200K |
| 2026-05-20 | mdd-build  | -        | complete | user-auth       | 23:45:00 | 150K/200K |
```

Pass criteria: every invocation has `invoked` + `complete` bookends, every phase has both `start` and `end`, no phases skipped.

## Known Issues

None yet.
