---
id: 11-mdd-settings
title: MDD Settings - Stack Discovery and Language-Specific Rule Files
edition: Both
depends_on: [03-install-local-flag, 04-global-claude-guidance, 09-mdd-bug-mode, 10-mdd-phase-logging]
source_files:
  - commands/mdd.md
  - commands/mdd-audit.md
  - commands/mdd-build.md
  - commands/mdd-rules-typescript.md
  - commands/mdd-rules-express.md
  - commands/mdd-rules-jwt.md
  - commands/mdd-rules-prisma.md
  - commands/mdd-rules-mcp.md
  - src/install.ts
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-20
status: complete
phase: all
mdd_version: 11
tags: [settings, auto-discovery, stack, rules, language-specific, conditional-audit, typescript, express, jwt, prisma]
path: Tooling/Settings
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 11 - MDD Settings - Stack Discovery and Language-Specific Rule Files

## Purpose

Adds a `.mdd/settings.json` file to MDD projects that controls stack detection and phase behaviour. When `autoDiscovery` is enabled, MDD scans the project's manifest files once per session and populates the stack automatically. Audit and build phases then load only the rule files that match the declared stack, keeping checks focused on what the project actually uses.

## Architecture

```
Session start (mdd.md Step 0a)
  └─ read .mdd/settings.json (or create default if missing)
  └─ if autoDiscovery: true
       └─ scan manifests: package.json, go.mod, pyproject.toml, composer.json
       └─ detect stack entries: languages, frameworks, ORMs, auth libraries
       └─ write updated stack back to settings.json (non-destructive)
  └─ merge stack + overrides into $MDD_STACK
  └─ store $MDD_PHASE_LOGGING from settings

Phase start (mdd-audit.md, mdd-build.md)
  └─ for each entry in $MDD_STACK:
       └─ if $MDD_DIR/mdd-rules-{entry}.md exists: read it, append criteria to phase
       └─ if file missing: emit one-line warning, skip - never halt
  └─ run phase with merged rule set
```

Rule files live in `$MDD_DIR/` alongside the other command files. They are installed by `src/install.ts` the same way existing `.md` command files are. Any rule file dropped into the directory is auto-picked up if the stack tag matches.

## Data Model

`.mdd/settings.json` schema:

```json
{
  "autoDiscovery": true,
  "stack": {
    "language": ["typescript"],
    "runtime": ["node"],
    "frameworks": ["express"],
    "orm": ["prisma"],
    "auth": ["jwt"]
  },
  "overrides": {},
  "phaseLogging": true,
  "securityScan": false
}
```

- `autoDiscovery` (boolean, default `true`) - MDD owns the `stack` field when true; user owns it when false
- `stack` - auto-populated from manifest scans; divided by category for clarity
- `overrides` - always user-controlled; merged on top of `stack` at phase time
- `phaseLogging` (boolean, default `true`) - gates all `mdd-log-phase.sh` calls across every mode file
- `securityScan` (boolean, default `false`) - opt-in flag that enables the security rule generator; implemented by `12-mdd-security-rules`

Rule files are named `mdd-rules-{stack-entry}.md` where `stack-entry` is a flat value from any category (e.g. `typescript`, `express`, `jwt`, `prisma`).

## Business Rules

**Discovery:**
1. Runs once per MDD session, during Step 0a in `mdd.md` - not on every phase
2. Only fires when `autoDiscovery: true`
3. Manifest scan order: `package.json` (deps + devDeps) -> `go.mod` -> `pyproject.toml` -> `composer.json` -> file extensions in `src/`
4. Discovery result is merged non-destructively into `settings.json`: only the `stack` field is updated; `overrides`, `phaseLogging`, and `autoDiscovery` are never touched
5. When `autoDiscovery: false`, `settings.json` is read as-is; the scan never runs

**Rule loading:**
6. At the start of each affected phase, MDD reads `$MDD_STACK` (merged stack + overrides) and loads matching rule files
7. Rules are purely additive - they append criteria to the existing phase, never replace or gate core behaviour
8. If a rule file is missing for a declared stack entry: emit one warning line, skip, continue - never halt
9. If `settings.json` is corrupt or unreadable: emit one warning, proceed with an empty stack - never halt
10. If `settings.json` does not exist: create the default template silently (part of Step 0a bootstrap)

**Phase logging gate:**
11. `phaseLogging: false` suppresses all `mdd-log-phase.sh` calls across every mode file
12. Default is `true` - existing behaviour is unchanged unless the user explicitly sets it

**Install:**
13. `src/install.ts` copies all `mdd-rules-*.md` files alongside the other command files
14. Version-aware skipping does not apply to rule files - they are always overwritten on update (same as mode files)

## API Endpoints

n/a - tooling feature

## Data Flow

**Discovery write path:**
Manifest files in project root -> Step 0a bash reads content -> stack entries extracted -> written to `.mdd/settings.json` under `stack` key -> available as `$MDD_STACK` for rest of session.

**Rule load path:**
`$MDD_STACK` (array of stack entries) -> for each entry, check `$MDD_DIR/mdd-rules-{entry}.md` exists -> if yes, read file -> criteria appended to active phase -> phase runs with full merged rule set.

**Phase logging gate path:**
`settings.json.phaseLogging` -> read once in Step 0a -> stored as `$MDD_PHASE_LOGGING` -> each `mdd-log-phase.sh` call wrapped: `if [ "$MDD_PHASE_LOGGING" != "false" ]; then bash ... mdd-log-phase.sh ...; fi`

## Dependencies

- `03-install-local-flag` - install.ts path resolution logic is reused to copy rule files to the correct location (local vs global)
- `04-global-claude-guidance` - settings.json feeds into the startup brief stack section; phase logging toggle affects guidance injection
- `09-mdd-bug-mode` - bug mode audit criteria become stack-conditional via settings
- `10-mdd-phase-logging` - phaseLogging setting controls whether phase logging fires at all

## Security

Settings file is local to the project (`.mdd/settings.json`). It contains no credentials or sensitive data. Rule files are read from `$MDD_DIR` which is controlled by the MDD install - no user-supplied paths are followed.

## Known Issues

## Bugs

(none yet - populated by /mdd bug when issues are reported)
