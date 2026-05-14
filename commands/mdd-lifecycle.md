## REVERSE-ENGINEER MODE — `/mdd reverse-engineer [path or feature-id]`

Triggered when arguments start with `reverse-engineer` or `reverse`. Generates or regenerates MDD documentation from existing source code.

### Phase R1 — Determine scope

**If a path or feature-id is given:**
- If it matches an existing `.mdd/docs/*.md` — load that doc as the "existing doc" for comparison (regenerate mode).
- If it's a file path — read that file as the only source (new doc mode).

**If no argument is given:**
- Scan `src/` for all TypeScript/source files.
- Cross-reference against `source_files` fields in all `.mdd/docs/*.md`.
- List files not registered in any doc. Ask the user which ones to document.

### Phase R2 — Read source files (parallelized for multi-file scope)

**Threshold rule:**
- ≤ 3 source files: read directly in the main conversation — no agent overhead
- 4+ source files: batch into parallel Explore agents (max 3), each reading a subset

**When parallelism applies:** Primarily the no-argument case — scanning `src/` for undocumented files can surface many files at once. A single feature with many source files (e.g., a large module) also qualifies.

#### Agent instructions (self-contained)

Each agent receives:
- Its assigned file paths
- The inference checklist below
- Explicit instruction: read the files and return structured inference output — do NOT write any files

For each assigned file, infer:
- **Purpose:** What does this file do? What problem does it solve?
- **Data models:** TypeScript interfaces, types, Zod schemas
- **API routes:** Express/Fastify/etc. route definitions and their handlers
- **Business rules:** Conditional logic, validation, state transitions
- **Dependencies:** What other modules does it import?
- **Edge cases:** Error handling patterns, guard clauses

#### What each agent returns

One block per assigned file:
```
File: <path>
Purpose: <1–2 sentences>
Data models: <list of types/interfaces with key fields>
API routes: <list of routes with method + path>
Business rules: <key validation, state logic>
Dependencies: <imports from other project modules>
Edge cases: <error handlers, guard clauses>
```

#### Main conversation: synthesize

After all agents return, synthesize their output into Phase R3 (draft the doc). The main conversation is the only one that writes files.

**Fallback:** If any agent fails, read that batch of files directly in the main conversation.

### Phase R3 — Draft the doc

Draft a complete feature doc following the Phase 3 template. Set:
- `last_synced: <today>`
- `status: draft` (since business intent may be incomplete)
- `phase: reverse-engineered`
- `tags: [...]` — infer 4–8 domain-concept keywords from the inferred purpose, routes, models, and source file names. NOT raw file paths — use the concept (e.g. `auth`, `api`, `stripe` not `src/handlers/stripe.ts`)

**In regenerate mode:** Show the existing doc alongside the new draft:
```
📋 Regeneration Comparison: <NN>-<feature-name>

Existing doc sections:     New draft sections:
  Purpose: ...               Purpose: ... (updated)
  Architecture: ...          Architecture: ... (same)
  API Endpoints: ...         API Endpoints: ... (3 new routes found)
  Business Rules: ...        Business Rules: ... (changed)

Changes: 2 sections updated, 1 section unchanged, 1 section added
```

Ask: "Merge new draft into existing doc? (yes / keep existing / show full diff)"

**In new doc mode:** Show the full draft and ask: "Does this accurately describe the feature? Anything to add or change?"

### Phase R4 — Save and optionally generate test skeletons

After user confirmation, write the doc. Then ask:
"Generate test skeletons from the inferred endpoints and business rules? (yes / no)"

If yes, follow Phase 4 logic using the newly written doc.

**Always disclose limitations before saving:**
```
⚠️  Reverse-engineer limitations:
   - "Purpose" section is inferred — review business intent carefully
   - Implicit constraints (SLAs, compliance, product decisions) are not captured
   - Confirm accuracy before treating this doc as the source of truth
```

---

## GRAPH MODE — `/mdd graph`

Triggered when arguments start with `graph`. Shows the cross-feature dependency map, plus initiative/wave structure if present.

### Phase G1 — Build dependency graph

Read all `.mdd/docs/*.md` (including `archive/`). For each doc, extract `id`, `title`, `status`, and `depends_on`.

Build a directed graph: edge A → B means "A depends on B" (B must exist for A to work).

**Initiative/wave graph** (only shown if `.mdd/initiatives/` exists): Also read all initiative and wave files. Build a second graph showing the initiative → wave → feature doc hierarchy.

### Phase G2 — Detect issues

**Broken dependency:** A doc lists a deprecated or archived feature in `depends_on`.

**Risky dependency:** A `status: complete` feature depends on a `status: in_progress` or `status: draft` feature.

**Task dependency:** A feature doc lists a task doc (`type: task`) in `depends_on`. Tasks are one-off and frozen — they carry no ongoing contract. Remove the task ID from `depends_on` and reference the relationship in Architecture or Dependencies prose instead.

**Orphan:** A feature with no `depends_on` and no other feature depending on it.

**Wave/initiative issues:**
- A wave's `docPath` points to a feature doc that does not exist → broken link
- A wave references a `dependsOn` wave that is not in the same initiative → invalid (cross-initiative deps not supported)
- A feature doc whose slug appears in a wave but has no `docPath` set and status is `complete` → doc missing for completed feature

### Phase G3 — Render

```
📊 MDD Dependency Graph

Dependencies (A depends on → B):

  06-command-system ──────────────────► 01-project-scaffolding
  09-integrations ────────────────────► 06-command-system
  04-content-builder ─────────────────► 03-database-layer
  05-testing-framework ───────────────► 03-database-layer

Orphans (no dependencies, no dependents):
  07-github-pages
  08-quality-gates

Issues:
  ⚠️  09-integrations depends on 06-command-system (status: in_progress) — risky
  ❌  05-testing-framework depends on 10-mdd-refinements (deprecated) — broken
```

**Initiative/wave section** (appended when initiatives exist):

```
📋 Initiative / Wave Hierarchy

  auth-system (active, v2)
    ├─ wave-1: Auth Foundation [complete] ✓ 3/3 features
    └─ wave-2: Auth Hardening [active]    ● 1/2 features
         ├─ auth-2fa       → docs/18-auth-2fa.md        ✅
         └─ auth-rate-limit → (no doc yet)              ❓

Issues:
  ❓  auth-system / wave-2 / auth-rate-limit — complete in wave but no doc path set
```

**Ops Runbooks section** (appended when `.mdd/ops/` has files):

```
📦 Ops Runbooks

  swarmk-dokploy      — 4 services, 2 regions (eu-west canary → us-east primary)
  rulecatch-dokploy   — 10 services, 2 regions (eu-west canary → us-east primary)

Service health (last runop):
  swarmk-dokploy:     all healthy ✓ (2026-04-17)
  rulecatch-dokploy:  api ✗ failing in eu-west (2026-04-16) → run /mdd runop rulecatch-dokploy
```

Save the graph to `.mdd/audits/graph-<date>.md`.

---

## UPGRADE MODE — `/mdd upgrade`

Triggered when arguments start with `upgrade`.

Batch-patches missing frontmatter fields (`last_synced`, `status`, `phase`) across ALL `.mdd/docs/*.md` files without touching doc content. Safe to run multiple times — already-present fields are never overwritten.

**Use case:** projects that used MDD before these fields were introduced, or after importing docs from another project. Running `/mdd upgrade` converts all UNTRACKED docs to IN SYNC in one pass.

---

### Phase UP1 — Inventory

1. Glob `.mdd/docs/*.md` (and `.mdd/docs/archive/*.md` if it exists). Collect all paths.
2. For each doc, read its frontmatter only (up to the closing `---` line).
3. Build an inventory table:

```
📋 Upgrade Inventory

Doc                              | last_synced | status | phase | tags
─────────────────────────────────|─────────────|────────|───────|──────
01-project-scaffolding           | ❌ missing  | ❌     | ❌    | ❌
02-profile-system                | ❌ missing  | ✅     | ❌    | ✅
03-database-layer                | ✅ present  | ✅     | ✅    | ❌
...

Docs needing upgrade: <N> of <total>
Fields to add:
  last_synced — <N> docs
  status      — <N> docs
  phase       — <N> docs
  tags        — <N> docs (run /mdd rebuild-tags after upgrade to populate)
```

4. If 0 docs need upgrade → report "All docs are up to date. Nothing to patch." and stop.

---

### Phase UP2 — Infer Defaults (per doc)

For each doc that needs patching, infer sensible defaults. **Do NOT ask the user for each doc** — infer silently, then show the plan for confirmation.

**`last_synced` inference:**

The goal is the date the doc was last meaningfully worked on. Try in order:

1. Check `git log --format="%as" --follow -- ".mdd/docs/<doc-file>.md" | head -1`  
   → Use the most recent commit date for that doc file.
2. If no git history (brand-new file not yet committed), use today's date.
3. If git is unavailable, use today's date.

**`status` inference:**

1. Check the `phase` field (if it already exists):
   - phase contains `all` → `complete`
   - phase contains `implementation` or `6` → `in_progress`
   - phase contains `draft` or `1`–`3` → `draft`
2. No existing phase → check the doc title/purpose section for keywords:
   - Contains "reverse-engineered" → `complete`
   - File is in `archive/` → `deprecated`
   - Otherwise → `complete` (most pre-existing docs represent finished features)
3. Default: `complete`

**`phase` inference:**

1. If `status` resolved to `complete` → `all`
2. If `status` resolved to `in_progress` → `implementation`
3. If `status` resolved to `draft` → `documentation`
4. If `status` resolved to `deprecated` → `deprecated`

---

### Phase UP3 — Show Plan + Confirm

Present the inferred patches to the user before writing anything:

```
🔧 MDD Upgrade Plan

<N> docs will be patched. Fields shown are ADDITIONS only — existing fields are untouched.

  01-project-scaffolding.md
    + last_synced: 2025-11-14   (from git: last commit on this doc)
    + status: complete          (inferred: pre-existing doc, no phase field)
    + phase: all                (inferred: status → complete)

  02-profile-system.md
    + last_synced: 2025-12-03   (from git: last commit on this doc)
    + phase: all                (inferred: status already 'complete')

  09-integrations.md
    + last_synced: 2026-01-17   (from git: last commit on this doc)
    + status: complete
    + phase: all

  ... (<N> more)

Proceed? (yes / review each individually / cancel)
```

If the user says **"review each individually"**: walk through each doc one at a time, showing the inferred values and asking "Accept / Edit / Skip" before patching.

If the user says **"yes"**: proceed to Phase UP4 with all inferred values.

---

### Phase UP4 — Patch Docs

For each doc in the plan, patch the frontmatter block **non-destructively**:

**Rules:**
- Read the full file
- Locate the opening `---` line and the closing `---` line
- Parse all existing frontmatter key-value pairs
- Add ONLY the missing fields — never modify existing ones
- Write the patched frontmatter back, preserving all existing fields and the doc body exactly

**Frontmatter field order** (when inserting):
```yaml
---
id: ...
title: ...
edition: ...
depends_on: [...]
source_files: [...]
routes: [...]
models: [...]
test_files: [...]
data_flow: ...
last_synced: <new>    ← insert here if missing
status: <new>         ← insert here if missing
phase: <new>          ← insert here if missing
mdd_version: <new>    ← insert here if missing
tags: <new>           ← insert here if missing (do not generate tags in upgrade — run /mdd rebuild-tags after)
known_issues: []
---
```

Insert new fields **before** `known_issues` to keep the canonical order. **Do not attempt to generate tag values during upgrade** — tags require reading doc content to produce meaningful keywords. After running upgrade, run `/mdd rebuild-tags` to populate tags on any docs that need them.

Report progress as you go:
```
Patching...
  ✅ 01-project-scaffolding.md — added last_synced, status, phase
  ✅ 02-profile-system.md — added last_synced, phase
  ✅ 03-database-layer.md — skipped (all fields present)
  ...
```

---

### Phase UP5 — Verify + Rebuild Startup

After all patches are applied:

1. Re-scan `.mdd/docs/*.md` — confirm 0 docs have missing `last_synced`
2. Trigger the `.mdd/.startup.md` rebuild (same logic as Status Mode)
3. Report:

```
✅ MDD Upgrade Complete

Docs patched:     <N>
Fields added:
  last_synced — <N> docs
  status      — <N> docs
  phase       — <N> docs
Docs skipped:     <N> (all fields already present)

Run `/mdd scan` to see current drift status across all docs.
```

---

---
