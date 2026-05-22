---
id: 05-ops
title: Ops Mode - Operational Runbook Creation and Execution
edition: MDD
depends_on: [01-mdd]
relates: [00-frontmatter-spec, 17-deploy]
source_files:
  - commands/mdd-ops.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [ops, runbook, deploy, health-check, region-gate, rollback, runop, commands-list]
path: Commands/Ops
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 05 - Ops Mode - Operational Runbook Creation and Execution

## Purpose

OPS MODE creates, executes, and manages operational runbooks - step-by-step deployment and
infrastructure procedures. Unlike feature docs, ops docs are executable: `/mdd runop <slug>`
actually runs the documented steps with pre-flight health checks, region gating, and post-flight
verification. Triggered by `/mdd ops`, `/mdd runop`, `/mdd update-op`, `/mdd ops list`, or
`/mdd commands`.

## Architecture

Five sub-modes:

```
ops <description>    — create a new runbook (OP1-OP4)
runop <slug>         — execute a runbook (RO1-RO5)
update-op <slug>     — edit an existing runbook (UO1-UO3)
ops list             — list all runbooks with health status
commands             — render the MDD commands reference table
```

Ops docs live in two locations:
- `.mdd/ops/<slug>.md` — project-local (for project-specific deployments)
- `~/.claude/ops/<slug>.md` — global (reusable across projects)

### OPS DOCUMENT MODE (OP)

Phase OP1 asks for project or global scope, derives a slug, and checks for collisions. Phase OP2
asks 10 questions in a single interaction: deployment target, platform, services, regions,
strategy, triggers, credentials, MCP servers, and environments. Phase OP3 writes the runbook
with full frontmatter and 7 mandatory body sections.

Mandatory body sections: Overview, Services & Ports, Environment Targets, Webhooks & Triggers,
Credentials & API Keys, MCP Servers, Deployment Procedure, Rollback Plan.

### OPS EXECUTE MODE (runop)

The execution flow for `/mdd runop <slug>`:

```
RO1  Load runbook         — parse slug, locate file, parse frontmatter
RO2  Pre-flight checks    — run health_check per service per region; ask action per unhealthy
RO3  Deploy per region    — for each region (in deploy_order):
       deploy services → run verification → check region gate → advance or halt
RO4  Post-flight checks   — re-run all health checks; append failures to known_issues
RO5  Summary              — update last_synced; display completion or failure table
```

Region gate types: `health_check` (all services must be healthy), `manual` (pause for user
confirmation), `none` (advance immediately). Gate failure applies `on_gate_failure`:
`stop`, `skip_region`, or `rollback`.

If verification fails during a deployment step, the runbook stops and shows the Rollback Plan.
If `rollback_on_failure: true`, rolls back automatically before stopping.

### OPS vs FEATURE DOCS

| Aspect | Ops doc | Feature doc |
|--------|---------|-------------|
| Location | `.mdd/ops/` or `~/.claude/ops/` | `.mdd/docs/` only |
| Scope | Operational procedures | Feature development |
| Executable | Yes (`/mdd runop`) | No |
| Global reuse | Yes | No |
| Schema fields | `type: ops`, `platform`, `deployment_strategy`, `regions`, `services` | `depends_on`, `routes`, `models`, `test_files`, `satisfies_contracts` |
| Status tracking | `status`, `last_checked` per service per region | `status`, `phase`, `wave_status` |

## Business Rules

- Global and project ops docs cannot share a slug - hard stop on collision
- Global ops have no access to project-local `.env` - only `~/.env` globals
- Every deployment step requires a verify command returning exit 0
- Rollback Plan must be actionable steps - not "revert the commit"
- Credentials are never stored in runbooks - only env var names
- Service health status (`status`, `last_checked`) is live operational data preserved through
  updates - never removed during `update-op`
- `status` is reset to `draft` during `update-op` if structural changes are made
- `$RUNBOOK_SLUG` is passed to phase log calls but is derived in OP1 Step 2, after the OP1
  start log fires - so the start log context is always blank. For `ops list` and `commands`
  modes, `$RUNBOOK_SLUG` is undefined throughout.

## Data Flow

Reads: `.mdd/ops/<slug>.md` or `~/.claude/ops/<slug>.md` frontmatter for execution; globs both
locations for `ops list`. Writes: runbook files (created by ops document; modified by runop and
update-op). Does not write to feature docs or connections.md.

## Dependencies

Requires `01-mdd` (router + bootstrap).

## Security

Credentials sections in runbooks list env var names only - never actual values. This is a hard
rule enforced by the documentation template. Users are responsible for ensuring credentials are
available in the environment before running `/mdd runop`.

## Known Issues

- `$RUNBOOK_SLUG` is used in all phase log calls but is only derived after the OP1 start log
  fires. For `ops list` and `commands` modes, it is never defined.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
