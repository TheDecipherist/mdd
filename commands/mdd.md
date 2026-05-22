---
description: "MDD workflow — Document → Audit → Fix → Verify. Build features or audit existing code using Manual-Driven Development."
scope: project
argument-hint: "<feature-description> or audit [section]"
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, AskUserQuestion, Agent
mdd_version: 11
---

# MDD — Manual-Driven Development Workflow

**$ARGUMENTS**

MDD is the core development workflow. Each feature is driven by its document — written before a line of code, referenced throughout development, and kept in sync as the feature evolves. The document is the single source of truth for what is being built and why. Every fix starts with an audit. No exceptions.

## Step 0 — Worktree Check (before everything else)

Before any other work, offer worktree isolation for parallel `/mdd` sessions:

1. Check current branch: `git branch --show-current`
2. Ask the user via AskUserQuestion:
   - **Question:** "Do you want to work in an isolated worktree? This lets you run multiple `/mdd` sessions in parallel."
   - **Options:**
     - **"No, continue here" (Recommended)** — proceed in current directory with auto-branch as usual
     - **"Yes, create a worktree"** — create an isolated worktree, then the user re-runs `/mdd` there
3. If the user selects **"Yes, create a worktree"**:
   - Derive a slug from `$ARGUMENTS` (e.g., `add-auth` from "add auth system"). If no arguments, ask for a name.
   - Run: `/worktree mdd-<feature-slug>` (this creates a sibling directory with its own branch)
   - Tell the user: "Worktree created. Open a new Claude Code session in the worktree directory and run `/mdd $ARGUMENTS` there."
   - **STOP here** — do not continue in the current session (the working directory hasn't changed)
4. If the user selects **"No, continue here"** — proceed to Step 0a below.

## Step 0a — Bootstrap Check (silent, automatic)

Before detecting mode or doing anything else, ensure the `.mdd/` directory structure exists. This runs silently — no user prompt, no confirmation. If everything already exists, nothing happens.

```bash
# Check and create missing pieces
[ -d .mdd ]           || mkdir -p .mdd
[ -d .mdd/docs ]      || mkdir -p .mdd/docs
[ -d .mdd/audits ]    || mkdir -p .mdd/audits
[ -d .mdd/ops ]       || mkdir -p .mdd/ops
[ -d .mdd/jobs ]      || mkdir -p .mdd/jobs
```

**If `.mdd/.startup.md` does not exist**, create it with the default template:

```markdown
## Project Snapshot
Generated: (run /mdd status to populate) | Branch: (unknown)

## Stack
Framework: (unknown) | DB: (unknown) | Host: (unknown)

## Features Documented
(none yet — run /mdd <feature> to create your first doc)
Format once populated: - <id> (<status>) [tag1, tag2, ...]

## Ops Runbooks
(none yet — run /mdd ops <description> to create one)
Format once populated: - <slug> [tag1, tag2, ...]

## Last Audit
(no audit run yet — run /mdd audit to generate findings)

## Rules Summary
Read CLAUDE.md for the full rulebook. Key rules:
- TypeScript always, strict mode, no any
- StrictDB only — no raw database drivers
- /api/v1/ prefix on all endpoints
- No file > 300 lines, no function > 50 lines
- Never commit .env or secrets
- Always branch — never commit to main

---

## Notes
(add notes with: /mdd note "your note here")
```

**If `.mdd/docs/00-frontmatter-spec.md` does not exist**, create it with the canonical schema template:

```markdown
---
id: 00-frontmatter-spec
title: Frontmatter Schema - Canonical Field Reference for All MDD Docs
edition: MDD
depends_on: []
relates: []
source_files: []
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: (set by /mdd status)
status: complete
phase: all
mdd_version: 11
tags: [schema, frontmatter, spec]
path: Meta/Schema
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
sister_projects: []         # paths or URLs of companion/sister projects (not build deps)
---

# Frontmatter Schema Reference

Every `.mdd/docs/*.md` feature doc must start with this YAML frontmatter block.
Doc-generating phases (build, lifecycle, import-spec, plan) must read this file
before writing any frontmatter — never use embedded templates.

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique doc ID matching the filename slug (e.g. `01-auth`) |
| `title` | string | Human-readable feature name |
| `edition` | `MDD` or `Both` | Which MDD edition this applies to |
| `depends_on` | string[] | IDs of feature docs this depends on (build order) |
| `relates` | string[] | IDs of docs that co-change with this one (not prerequisite - symmetric hint) |
| `source_files` | string[] | Source files this doc describes (relative to project root) |
| `routes` | string[] | API routes exposed by this feature |
| `models` | string[] | Database models used or defined by this feature |
| `test_files` | string[] | Test files covering this feature |
| `data_flow` | string | `greenfield`, `reads-existing`, `writes-existing`, or `mixed` |
| `last_synced` | date | ISO date when doc was last synced with source code |
| `status` | string | `draft`, `in_progress`, `complete`, or `deprecated` |
| `phase` | string | Build phase: `1`, `2`, `3`, or `all` |
| `mdd_version` | integer | MDD version when doc was last updated |
| `tags` | string[] | Domain concepts, technology names, feature names (no file paths or generic words) |
| `path` | string | Slash-delimited breadcrumb for navigation (e.g. `Auth/Login`) |
| `integration_contracts` | object[] | Contracts this doc consumes from other features |
| `satisfies_contracts` | object[] | Contracts this doc fulfills for other features |
| `security_read_sites` | string[] | Code locations where security-sensitive reads occur |
| `known_issues` | string[] | Known bugs or gaps (append-only - never remove) |

## satisfies_contracts Schema

Each entry in `satisfies_contracts` uses this shape:

```yaml
satisfies_contracts:
  - from: <feature-id>
    function: <function or endpoint name>
    when: <condition or trigger>
    status: pending   # or: done
    verified_at: ""   # or: "file:line" when status is done
```

Note: the field is `verified_at` (not `verified`). Status must be `pending` or `done`.

## relates Field

`relates` lists doc IDs that tend to change together with this doc. It is symmetric
(if A relates B, B should also relate A) and is a co-change hint, not a build dependency.
Use it when editing one doc almost always requires reviewing another.

## Wave Frontmatter Schema

```yaml
id: <initiative>-wave-<N>
title: "Wave N: <title>"
initiative: <initiative-id>
initiative_version: <integer>
status: planned | in_progress | complete
depends_on: <previous-wave-id>
demo_state: "<one sentence: what must be demonstrable when this wave is done>"
created: <ISO date>
hash: <8-char sha256 of file content excluding hash line>
```

## Initiative Frontmatter Schema

```yaml
id: <initiative-id>
title: <title>
status: planned | in_progress | complete
version: <integer>
created: <ISO date>
hash: <8-char sha256>
```
```

**If `.gitignore` exists**, check whether `.mdd/audits/` and `.mdd/jobs/` are already ignored. For any that are missing, append:
```
# MDD audit reports (ephemeral — regenerated by /mdd audit)
.mdd/audits/
# MDD active jobs (ephemeral — deleted on completion)
.mdd/jobs/
```

**Report only if something was created** (skip entirely if everything already existed):
```
📁 MDD structure initialised:
   .mdd/docs/                   ✓ created
   .mdd/audits/                 ✓ created
   .mdd/ops/                    ✓ created
   .mdd/jobs/                   ✓ created
   .mdd/.startup.md             ✓ created
   .mdd/docs/00-frontmatter-spec.md ✓ created
   .gitignore                   ✓ updated (.mdd/audits/ and .mdd/jobs/ added)
```

This bootstrap runs for **all modes** — build, audit, scan, update, and every other mode — so no mode ever fails due to a missing `.mdd/` structure.

## Step 0c — Settings Bootstrap (silent, automatic)

After the directory structure is confirmed, load project settings. This also runs for every mode and never prompts the user.

**Read or create `.mdd/settings.json`:**

If the file does not exist, create it with this default and report one line:

```json
{
  "autoDiscovery": true,
  "stack": {
    "language": [],
    "runtime": [],
    "frameworks": [],
    "orm": [],
    "auth": []
  },
  "overrides": {},
  "phaseLogging": true,
  "securityScan": false
}
```

```
📋 MDD settings initialised: .mdd/settings.json
```

If the file exists but cannot be read or is not valid JSON: emit one warning (`⚠ settings.json unreadable — running without stack rules`) and proceed with all defaults. Never halt.

**Set session variables from settings:**

- `$MDD_PHASE_LOGGING` = `settings.phaseLogging` (default: `true`)
- `$MDD_SECURITY_SCAN` = `settings.securityScan` (default: `false`)

**If `autoDiscovery: true`, run stack detection** — check manifest files in the project root:

| File | What to detect |
|------|----------------|
| `package.json` | language (`typescript` if typescript in deps, else `javascript`), runtime (`node`), plus frameworks/orm/auth from dep names below |
| `go.mod` | language: `go` |
| `pyproject.toml` or `requirements.txt` | language: `python` |
| `composer.json` | language: `php` |

For `package.json`, scan both `dependencies` and `devDependencies` for these known packages:

| Package(s) | Category | Stack value |
|-----------|----------|-------------|
| `typescript` | language | `typescript` |
| `express` | frameworks | `express` |
| `fastify` | frameworks | `fastify` |
| `koa` | frameworks | `koa` |
| `hono` | frameworks | `hono` |
| `next` | frameworks | `nextjs` |
| `react` | frameworks | `react` |
| `vue` | frameworks | `vue` |
| `@prisma/client` | orm | `prisma` |
| `drizzle-orm` | orm | `drizzle` |
| `typeorm` | orm | `typeorm` |
| `mongoose` | orm | `mongoose` |
| `jsonwebtoken`, `jose` | auth | `jwt` |
| `passport` | auth | `passport` |
| `@modelcontextprotocol/sdk`, `@anthropic-ai/mcp` | frameworks | `mcp` |

Write detected entries back into `settings.json` under `stack` (non-destructive — only updates `stack`, never touches `overrides`, `phaseLogging`, `autoDiscovery`, or `securityScan`).

If `autoDiscovery: false`, read `settings.json` as-is — no scan runs.

**Build `$MDD_STACK`** by merging `stack` + `overrides` into a flat deduplicated array of all values across all categories.

If the stack was newly detected or changed, report one line:
```
📋 Stack: typescript, node, express, prisma, jwt  |  phase logging: on  |  security scan: off
```

**Phase logging gate:** All `mdd-log-phase.sh` calls throughout every mode file must be wrapped:
```bash
[ "$MDD_PHASE_LOGGING" = "false" ] || bash ~/.claude/hooks/mdd-log-phase.sh ...
```

## Step 0b — Detect Mode

The user's full arguments are: **$ARGUMENTS**

Parse these arguments to determine the mode. **Before doing anything else, read the appropriate mode file listed below.** The mode file contains the complete instructions for that mode. When mode file instructions reference `$ARGUMENTS`, treat it as the arguments stated above.

Find the MDD mode files directory by checking in this order:
1. `.claude/mdd/` in the current project (local install)
2. `~/.claude/mdd/` (global install)
3. `.claude/commands/` in the current project (legacy local install)
4. `~/.claude/commands/` (legacy global install)

Use whichever path contains `mdd-audit.md`. Store it as `$MDD_DIR` and use it for all mode file reads below.

- If arguments start with `audit` →
  **Read `$MDD_DIR/mdd-audit.md` then follow its AUDIT MODE instructions.**

- If arguments start with `status`, `note`, `scan`, `update`, `deprecate`, `rebuild-tags`, or `connect` →
  **Read `$MDD_DIR/mdd-manage.md` then follow the relevant mode instructions.**

- If arguments start with `import-spec` →
  **Read `$MDD_DIR/mdd-import-spec.md` then follow its IMPORT SPEC MODE instructions.**

- If arguments start with `reverse-engineer`, `reverse`, `graph`, or `upgrade` →
  **Read `$MDD_DIR/mdd-lifecycle.md` then follow the relevant mode instructions.**

- If arguments start with `plan-` →
  **Read `$MDD_DIR/mdd-plan.md` then follow the relevant PLAN mode instructions.**

- If arguments start with `ops`, `runop`, `update-op`, or `commands` →
  **Read `$MDD_DIR/mdd-ops.md` then follow the relevant OPS/COMMANDS mode instructions.**

- If arguments start with `manual` →
  **Read `$MDD_DIR/mdd-manual.md` then follow MANUAL MODE instructions.**

- If arguments start with `bug` →
  **Read `$MDD_DIR/mdd-bug.md` then follow BUG MODE instructions.**

- If arguments start with `security-rules` →
  **Read `$MDD_DIR/mdd-security-rules.md` then follow SECURITY RULES MODE instructions.**

- If arguments are empty → ask the user what they want to do (build a feature, run an audit, check status, etc.)

- Otherwise → **Read `$MDD_DIR/mdd-build.md` then follow BUILD MODE instructions.**

After mode is determined and before reading the mode file, log the invocation. `$ARGUMENTS` is the full argument string the user typed (e.g., `build user-auth`, `audit 03`, `status`):

```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd" "-" "invoked" "$ARGUMENTS"
```

---

## Branch Guard (All Modes)

**This guard is mandatory. MDD never creates or modifies files directly on `main` or `master`. No exceptions — not even for documentation, planning, or ops files.**

**If the user already chose a worktree in Step 0, skip entirely** — the worktree has its own dedicated branch.

Otherwise, before creating or modifying any files, run:

```bash
BRANCH=$(git branch --show-current)
DIRTY=$(git status --porcelain)
```

---

### Scenario A — On `main` or `master`, working tree has uncommitted changes

**STOP. Do not create or modify any file.**

```
🚫 MDD Branch Guard — cannot proceed on main with uncommitted changes.

Branch:   main
Dirty:    <N> file(s) modified / untracked

MDD never works directly on main, and uncommitted changes must be
resolved before branching safely.

Choose:
  (a) Commit now  — stage all changes and commit, then MDD auto-branches
  (b) Stash now   — git stash, then MDD auto-branches
  (c) Abort       — handle git manually, then re-run /mdd
```

- **(a) Commit:** `git add -A`, generate a short conventional commit message from the changed files, commit, then proceed to Scenario B.
- **(b) Stash:** `git stash`, then proceed to Scenario B.
- **(c) Abort:** stop entirely — do not create any files.

---

### Scenario B — On `main` or `master`, clean working tree

Auto-branch immediately — no user prompt. Derive the branch name from the active mode:

| Mode | Branch name |
|------|-------------|
| Build (`/mdd <feature>`) | `feat/<feature-slug>` |
| Audit (`/mdd audit`) | `fix/mdd-audit-<YYYY-MM-DD>` |
| plan-initiative | `feat/init-<initiative-slug>` |
| plan-wave | `feat/<wave-slug>` |
| plan-execute | `feat/<wave-slug>` |
| Any other mode | `feat/<slug-from-arguments>` |

Run `git checkout -b <branch-name>` and report:
```
✅ Branched to <branch-name> — proceeding with MDD.
```

---

### Scenario C — Already on a feature or fix branch

Working tree dirty (in-progress changes) is **expected and fine** — that work belongs on this branch.

Each mode's Phase 0 handles mismatch detection (does the new task belong on this branch?). See mdd-build.md Phase 0 and mdd-plan.md for details.

**One hard rule:** A branch starting with `fix/mdd-audit-` is an audit branch. Build and plan modes must not reuse it — fall through to Scenario B naming instead.

---

## CLAUDE.md Update Trigger

After ANY MDD operation that changes code, check if new patterns were established that should be added to CLAUDE.md. If so, suggest the addition:

```
💡 New pattern detected: <description>
Add to CLAUDE.md? (yes / no)
```

This is the MDD feedback loop — every project interaction improves future interactions.
