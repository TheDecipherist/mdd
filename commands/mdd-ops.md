## OPS DOCUMENT MODE — `/mdd ops <description>`

Triggered when arguments start with `ops`. If arguments are exactly `ops list` → jump to **Ops List Mode** (Phase OL) instead.

### Phase OP1 — Scope, slug, and collision check

**Step 1 — Ask scope first (before anything else):**

```
Where should this runbook live?
  (a) Project  — .mdd/ops/<slug>.md   (this project only)
  (b) Global   — ~/.claude/ops/<slug>.md  (reusable across all projects)

Note: Global ops cannot access project-local .env variables or
project-specific paths. Use ~/.env globals only.
```

**Step 2 — Derive slug:**
Strip `ops` from the start of arguments. Use the remainder as the description.
Derive a slug: lowercase, hyphens, drop filler words (e.g., "deploy swarmk to dokploy" → `swarmk-dokploy`, "update cloudflare dns" → `cloudflare-dns`).

**Step 3 — Collision check:**
- If scope is **project**: check whether `~/.claude/ops/<slug>.md` exists.
  - If global op exists with that slug → **hard stop**:
    *"A global runbook named `<slug>` already exists (`~/.claude/ops/<slug>.md`). Project ops cannot share a name with a global op — use a different name, or run `/mdd runop <slug>` to execute the global one."*
- If scope is **global**: check whether `~/.claude/ops/` exists, create it if not (`mkdir -p ~/.claude/ops`).

**Step 4 — Check target location:**
- Target path: `.mdd/ops/<slug>.md` (project) or `~/.claude/ops/<slug>.md` (global)
- **Does not exist** → proceed to Phase OP2 (create)
- **Exists** → tell the user: *"Runbook `<slug>` already exists. Use `/mdd update-op <slug>` to edit it or `/mdd runop <slug>` to execute it."* Stop.

### Phase OP2 — Ask questions

Ask all questions in a single interaction:

1. "What is this deployment? (describe the target — e.g., swarmk API and dashboard to Dokploy US + EU)"
2. "What platform? (dokploy / docker-hub / vercel / github-actions / manual / other)"
3. "List all services being deployed — for each: name, Docker image name, port (or none), health check command"
4. "List your deployment regions — for each: slug, host, platform, deploy order (1 = deploy first / canary)"
5. "Deployment strategy: sequential or parallel across regions? What gates between regions? (health_check / manual / none)"
6. "What happens if a canary gate fails? (stop / skip_region / rollback) Auto-rollback on failure? (yes/no)"
7. "How is deployment triggered? (Dokploy webhook URL as env var, GitHub Actions workflow name, manual command, etc.)"
8. "What credentials and API keys does this deployment need? List as env var names only — never values. Where is each stored?"
9. "Are any MCP servers required during deployment? (e.g., strictdb-mcp for post-deploy seeding)"
10. "What environments does this target? (staging / production / both)"

### Phase OP3 — Write the runbook

Create `.mdd/ops/<slug>.md` with full frontmatter and all 7 mandatory sections:

```markdown
---
id: <slug>
title: <title>
type: ops
platform: <platform>
environments: [<list>]
deployment_strategy:
  order: sequential
  gate: health_check
  on_gate_failure: stop
  rollback_on_failure: false
regions:
  - slug: <slug>
    host: <host>
    platform: <platform>
    deploy_order: 1
    role: canary
  - slug: <slug>
    host: <host>
    platform: <platform>
    deploy_order: 2
    role: primary
services:
  - slug: <name>
    image: <registry/name:tag>
    port: <port or ~>
    health_check: <exact command>
    regions:
      <region-slug>:
        image: <registry/name:tag>
        status: unknown
        last_checked: ~
status: draft
last_synced: <YYYY-MM-DD>
mdd_version: <current>
tags: [<4-8 keywords — platform, services, environments, operation type. e.g. deploy, dokploy, docker, eu-west, canary>]
known_issues: []
---

# <title>

## Overview
<What this deployment does and why — 2-3 sentences>

## Services & Ports
<Table: service | image | port | health endpoint>

## Environment Targets
<Which environments, what platforms, any environment-specific notes>

## Webhooks & Triggers
<How deployment is triggered: Dokploy webhook URL as $ENV_VAR, GitHub Actions workflow, manual command, etc.>

## Credentials & API Keys
<Table: credential name | env var | where stored>
**NEVER include actual values — env var names only.**

## MCP Servers
<Any MCP servers required during deployment, or "(none)">

## Deployment Procedure
<Ordered steps. Each step MUST have: name, command/action, verification check.>

Step 1 (Name):
  Action:  <exact command>
  Verify:  <command that returns exit 0 on success>

Step 2 (Name):
  Action:  <exact command>
  Verify:  <command that returns exit 0 on success>

## Rollback Plan
<Specific steps to undo this deployment if it fails. Must be actionable, not "revert the commit".>
```

### Phase OP4 — Offer next steps

```
✅ Runbook created: .mdd/ops/<slug>.md

Next steps:
  /mdd runop <slug>       — execute the runbook now
  /mdd update-op <slug>   — edit the runbook
```

---

## OPS EXECUTE MODE — `/mdd runop <slug>`

Triggered when arguments start with `runop`. Executes an existing ops runbook with pre-flight health checks, canary-gated region deployment, and post-flight verification.

### Phase RO1 — Load runbook

1. Parse `<slug>` from arguments — hard stop *"Slug required. Usage: /mdd runop <slug>"* if missing.
2. Locate the runbook (project-local first, then global):
   - Check `.mdd/ops/<slug>.md` → found: announce *"Running project runbook: `<slug>`"*
   - Check `~/.claude/ops/<slug>.md` → found: announce *"Running global runbook: `<slug>`"*
   - Neither found → hard stop: *"No runbook found for `<slug>` (checked project and global). Run `/mdd ops <description>` to create one, or `/mdd ops list` to see all available runbooks."*
3. Parse all frontmatter fields: regions (sorted by `deploy_order`), services, `deployment_strategy`.

### Phase RO2 — Pre-flight health check (all regions)

Run each service's `health_check` for each of its declared regions. Display a status table:

```
Pre-flight Health Check — <slug>
──────────────────────────────────────────────────
                     <region-1>       <region-2>
<service>            ✓ healthy        ✗ failing
<service>            ✓ healthy        ✓ healthy
<service>            ? unknown        ? unknown

(last checked: <date> | <date>)
```

Write updated `status` and `last_checked` to each `services[].regions.<slug>` entry in frontmatter immediately.

For each service that is **not healthy**, ask per region:
```
<service> is <status> in <region>. What do you want to do?
  (a) Redeploy — run this service's deployment steps
  (b) Skip — continue without touching this service in this region
  (c) Abort — stop the entire runop
```

### Phase RO3 — Deploy region by region (in deploy_order)

For each region in `deploy_order` sequence:

**Step A — Deploy services in this region**
- For each service marked for redeploy in this region:
  - Use `services[].regions.<slug>.image` (falls back to `services[].image` if not set)
  - Walk through the service's steps in the Deployment Procedure section
  - Each step: announce name → run command → run verification check
  - Verification passes → ✓, continue
  - Verification fails → STOP, show exact output, surface Rollback Plan section
  - If `rollback_on_failure: true` → automatically run rollback steps, then stop

**Step B — Region gate**

Run health checks for all services in this region. Display result:
```
── <region> (<role>) — gate check ────────────────
<service>    ✓ healthy  (<image>)
<service>    ✓ healthy
Gate: PASSED ✓
```

If gate is `health_check` and any service is not `healthy`:
- Apply `on_gate_failure`:
  - `stop` → halt, show what failed, print: *"<next-region> was NOT deployed — <this-region> gate failed."*
  - `skip_region` → log failure, advance to next region
  - `rollback` → run Rollback Plan steps for this region, then stop
- Write updated status to frontmatter before stopping

If gate is `manual` → always pause: *"<region> deployed. Proceed to <next-region>? (yes / abort)"*

If gate is `none` → advance immediately.

Write updated `status` and `last_checked` for all services in this region to frontmatter.

**Step C — Advance**

Gate passed → proceed to next region in `deploy_order`. Repeat Steps A–B.

### Phase RO4 — Post-flight health check (all regions)

Re-run all service health checks across all regions. Display full cross-region before → after table:

```
Post-flight Health Check — <slug>
──────────────────────────────────────────────────────────────
                     <region-1>                <region-2>
<service>            ✓ healthy (was ✗)         ✓ healthy
<service>            ✓ healthy                 ✓ healthy
```

Write final `status` and `last_checked` to all service region entries in frontmatter.
Any service still failing → append entry to `known_issues` in the doc.

### Phase RO5 — Summary

**Update the runbook frontmatter** — write this field before displaying the summary:
- `last_synced: <today>`

```
runop complete — <slug>

                     <region-1> (canary)   <region-2> (primary)
<service>            ✓ healthy             ✓ healthy
<service>            ✓ healthy             ✓ healthy

Canary gate:      PASSED ✓
Regions deployed: <N>/<N>
Steps executed:   <N>/<N> ✓
last_synced:      <YYYY-MM-DD>
```

If canary gate failed and primary was skipped:
```
runop stopped — <slug>

<region-1> (canary):  ✗ gate FAILED — <service> failing after deploy
<region-2> (primary): NOT deployed — canary gate must pass first

on_gate_failure: stop
Fix: resolve <service> in <region-1>, then re-run /mdd runop <slug>
```

---

## OPS UPDATE MODE — `/mdd update-op <slug>`

Triggered when arguments start with `update-op`. Updates an existing ops runbook.

### Phase UO1 — Load

1. Parse `<slug>` — hard stop *"Slug required. Usage: /mdd update-op <slug>"* if missing.
2. Locate runbook (project-local first, then global):
   - Check `.mdd/ops/<slug>.md` → found: load it, note scope = project
   - Check `~/.claude/ops/<slug>.md` → found: load it, note scope = global
   - Neither found → hard stop: *"No runbook found for `<slug>`. Run `/mdd ops list` to see all available runbooks."*

### Phase UO2 — Re-ask with current values pre-filled

Re-present the Phase OP2 questions with current values shown as defaults. User can accept (press enter) or type a new value. Only changed fields are rewritten.

Show a diff summary before writing:
```
Changes detected:
  + regions: eu-central added
  ~ services.api.regions.eu-west.image: old-name:v1 → new-name:v2
  ~ deployment_strategy.on_gate_failure: stop → rollback
```

Ask: *"Apply these changes? (yes / cancel)"*

### Phase UO3 — Rewrite and update

Rewrite only changed sections. Preserve:
- `known_issues` (never remove existing entries without asking)
- Service `status` and `last_checked` values (these are live data, not config)

Update frontmatter: `last_synced: <today>`, `status: draft` if previously `complete` and structural changes were made.

```
✅ Updated: .mdd/ops/<slug>.md
   last_synced: <today>
   Sections rewritten: <list>
```

---

## OPS LIST MODE — `/mdd ops list`

Triggered when arguments are exactly `ops list`. Lists all ops runbooks — global and project — in a single unified view.

### Phase OL — Scan and display

1. Glob `~/.claude/ops/*.md` — read each, extract `id`, `title`, `platform`, `status`, and the last `last_checked` value across all services.
2. Glob `.mdd/ops/*.md` (excluding `archive/`) — same fields.
3. Display unified list, grouped by scope:

```
📦 Ops Runbooks

Global (~/.claude/ops/)
  cloudflare-dns        DNS record updates via Cloudflare API        last run: 2026-04-10
  docker-hub-login      Docker Hub authentication procedure          last run: 2026-03-28
  ssl-renewal           Let's Encrypt cert renewal (Certbot)        last run: never

Project (.mdd/ops/)
  rulecatch-dokploy     10 services → eu-west (canary) + us-east    last run: 2026-04-18  ✓ all healthy
  swarmk-dokploy        7 services → eu-west (canary) + us-east     last run: 2026-04-17  ⚠ api degraded

Run /mdd runop <slug> to execute any runbook.
```

If either directory is empty or missing, omit that section without error. If both are empty:
```
No ops runbooks found.
  Project: /mdd ops <description>        (saves to .mdd/ops/)
  Global:  /mdd ops <description>        (choose "global" when prompted)
```

---

## COMMANDS MODE — `/mdd commands`

Triggered when arguments start with `commands`. Outputs a reference table of every available MDD mode.

### Phase CM — Render Mode Reference

Read the **Step 0b — Detect Mode** block from this file (the loaded prompt). For every bullet point that maps an argument pattern to a mode, extract the trigger word(s) and the mode name. Then render the following table:

```
📋 MDD Commands — Mode Reference

Command                                    | Description
-------------------------------------------|------------------------------------------------------------
/mdd <feature description>                 | Build Mode — Document, plan, and implement a new feature
/mdd audit [section]                       | Audit Mode — Scan code against MDD docs for violations and drift
/mdd status                                | Status Mode — Overview of docs, audits, tests, and initiatives
/mdd scan                                  | Scan Mode — Detect features whose source files have changed since last sync
/mdd update <feature-id>                   | Update Mode — Re-sync a feature doc after its code has changed
/mdd note "text"                           | Note Mode — Append a timestamped note to .mdd/.startup.md
/mdd note list                             | Note Mode — Print the Notes section of .mdd/.startup.md
/mdd note clear                            | Note Mode — Wipe all notes (asks for confirmation)
/mdd deprecate <feature-id>                | Deprecate Mode — Archive a feature and flag all dependents
/mdd reverse-engineer [path|feature-id]   | Reverse-Engineer Mode — Generate MDD docs from existing source code
/mdd graph                                 | Graph Mode — Render the full cross-feature dependency map
/mdd upgrade                               | Upgrade Mode — Batch-patch missing frontmatter fields across all docs
/mdd commands                              | Commands Mode — Show this reference table
/mdd plan-initiative                       | Plan-Initiative Mode — Create a new multi-wave initiative
/mdd plan-wave <wave-slug>                 | Plan-Wave Mode — Plan a wave within an existing initiative
/mdd plan-execute <wave-slug>              | Plan-Execute Mode — Run the MDD build flow for every feature in a wave
/mdd plan-sync                             | Plan-Sync Mode — Reconcile manual edits to initiative/wave files
/mdd plan-remove-feature <wave> <feature>  | Plan-Remove-Feature Mode — Remove a feature from a wave
/mdd plan-cancel-initiative <slug>         | Plan-Cancel-Initiative Mode — Cancel an initiative and archive its waves
/mdd ops <description>                     | Ops Document Mode — Create a runbook (asks: global ~/.claude/ops/ or project .mdd/ops/)
/mdd ops list                              | Ops List Mode — Show all runbooks (global and project) with last-run status
/mdd runop <slug>                          | Ops Execute Mode — Run a runbook: pre-flight health check, canary-gated deploy, post-flight verify
/mdd update-op <slug>                      | Ops Update Mode — Edit an existing runbook (checks project then global)

Run /mdd <feature description> to start building, /mdd ops <description> to create a deployment runbook, or /mdd audit to check existing code.
```

No files are created or modified by this mode.

---
