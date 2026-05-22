---
id: 04-plan
title: Plan Mode - Initiative and Wave-Based Feature Planning
edition: MDD
depends_on: [01-mdd]
relates: [00-frontmatter-spec, 02-build, 03-audit]
source_files:
  - commands/mdd-plan.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [plan, initiative, wave, hash, depends-on, manifest, execute, sync, cancel]
path: Commands/Plan
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 04 - Plan Mode - Initiative and Wave-Based Feature Planning

## Purpose

PLAN MODE organizes large bodies of work into initiatives and waves. An initiative describes
an overarching goal; waves are sequenced chunks that build toward it; features within a wave
are the individual MDD build tasks. Hash verification prevents manual edits from silently
conflicting with the automated planning and execution system.

## Architecture

Six sub-modes, all triggered by `/mdd plan-<submode>`:

```
plan-initiative   — create a new initiative doc; guided Q&A or blank template
plan-wave         — plan a single wave within an existing initiative
plan-execute      — run full MDD Build Mode for every feature in a wave
plan-sync         — reconcile manual edits to initiative/wave files via hash comparison
plan-remove-feature — remove a feature from a wave's table; optionally archive its doc
plan-cancel-initiative — cancel an active initiative; optionally archive waves/flag features
```

### Initiative and Wave Structure

```
.mdd/initiatives/<slug>.md    — describes the goal, open questions, waves table
.mdd/waves/<slug>-wave-N.md   — one wave doc per wave; features table, demo-state
.mdd/docs/<NN>-<slug>.md      — one feature doc per feature (created by plan-execute)
```

An initiative has a `version` integer that increments whenever its content changes. Each wave
stores the `initiative_version` at the time it was created; this is how plan-sync detects
stale waves when the initiative is edited after waves are already complete.

### Hash Verification Mechanic

Every initiative and wave file stores a `hash:` field — an 8-character sha256 prefix of the
file content excluding the `hash:` line itself. When a mode reads the file, it recomputes the
hash and compares it to the stored value. A mismatch means the file was manually edited without
running `plan-sync` to reconcile, and the mode hard-stops.

This prevents manual edits from creating silent conflicts with automated planning. It does not
prevent edits; it forces reconciliation via `plan-sync` before proceeding.

### plan-initiative

Phases PI0-PI4. PI0 enforces the branch guard. PI1 asks guided vs. template mode. PI2 collects
initiative title, description, wave count, per-wave demo-states, and open product questions.
PI3 writes `.mdd/initiatives/<slug>.md` with hash and slug collision check. PI4 offers to chain
to plan-wave for Wave 1.

### plan-wave

Phases PW1-PW5. PW1 verifies the initiative hash, checks for unchecked `- [ ]` items in Open
Product Questions (hard gate), and verifies the `depends_on` wave is `complete` if set. PW3
collects demo-state refinement, feature list with intra-wave dependencies, and research
questions. PW4 writes the wave doc and updates the initiative waves table (incrementing version
and recomputing initiative hash).

### plan-execute

Phases PE1-PE4. The most complex mode.

PE1 validates both initiative and wave hashes, checks depends-on gate, builds a feature
dependency graph for ordering verification, and detects stale jobs from previous interrupted
runs (offering resume or discard).

PE2 creates the job MANIFEST at `.mdd/jobs/wave-<slug>/MANIFEST.md` before any feature work
begins. The MANIFEST tracks each feature as `[ ]`, `[~]`, `[x]`, or `[!]`. This file is the
authoritative resume point.

PE3 executes each feature in dependency order by calling full MDD Build Mode (Phases 1-7).
After each feature completes, the PE3 completion gate checks: (a) all `source_files` exist on
disk, (b) all `satisfies_contracts` entries are `status: done` with `verified_at`, (c) the
feature doc has `status: complete`.

PE4 marks the wave complete, cascades `status: complete` to all feature docs, regenerates
`.mdd/connections.md`, rebuilds `.mdd/.startup.md`, and deletes the job folder.

### plan-sync

Phases PS1-PS3. Scans all initiative and wave files, computes hashes, builds a change table,
and prompts for approval. On apply: increments initiative version for changed initiatives,
updates hashes, flags completed waves/features for review where their parent was edited.

## Business Rules

- **Open questions gate (plan-wave PW1):** any unchecked `- [ ]` item in the initiative doc
  blocks wave planning. All questions must be answered first.
- **depends-on gate:** a wave cannot be planned or executed until its `depends_on` wave is
  `complete`. Hard stop.
- **Feature ordering gate (PE1):** intra-wave feature dependencies are verified; cycles or
  ordering violations hard-stop with an auto-reorder offer.
- **Completion gate (PE3):** source files must exist, contracts must be verified, doc must have
  `status: complete` - all checked before marking a feature `[x]`.
- **Stale job detection (PE1):** MANIFEST is checked before creating a new one; resume is offered.
- **MANIFEST written before feature work (PE2):** the file must exist on disk before any build
  phase runs - it is the only recovery mechanism for interrupted sessions.
- **Initiative version and hash:** version increments on every manual edit reconciled by sync;
  completed waves with older `initiative_version` are flagged for review.
- **Path inconsistency:** some references in the command file use bare `waves/` and `initiatives/`
  without the `.mdd/` prefix - authoritative paths are `.mdd/waves/` and `.mdd/initiatives/`.

## Data Flow

Reads: `.mdd/initiatives/*.md`, `.mdd/waves/*.md`, `.mdd/docs/*.md`, `.mdd/jobs/` folder.
Writes: initiative docs, wave docs, feature docs (via Build Mode), MANIFEST, connections.md, .startup.md.

## Dependencies

Requires `01-mdd`. Feature execution via plan-execute calls `02-build` for each feature.

## Security

Not applicable - reads and writes local project files only.

## Known Issues

- `$PLAN_TARGET` is passed to all phase log calls but is never assigned in this file. Context
  column in log.md is blank for all plan invocations.
- Phase PE3 completion gate uses `verified: <file>:<line>` as the contract verification field,
  but the canonical field name is `verified_at: "file:line"` (with `status: done`). The spec
  in Phase 3a uses the correct form. Phase PE3 uses the wrong form.
- Some path references use bare `waves/` (lines 108, 109, 183, 213, 420) and `initiatives/`
  (lines 42, 43, 165, 244, 420, 612) without the `.mdd/` prefix.
- Duplicate step "2." in Phase PE4 (lines 419 and 420).

## Bugs

(none yet - populated by /mdd bug when issues are reported)
