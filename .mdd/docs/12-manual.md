---
id: 12-manual
title: Manual Mode - User Manual Generator from MDD Docs
edition: MDD
depends_on: [01-mdd]
relates: [00-frontmatter-spec, 11-manage, 03-audit]
source_files:
  - commands/mdd-manual.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [manual, user-guide, hash, incremental, toc, command-reference, batch-write, compaction-safe]
path: Commands/Documentation
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 12 - Manual Mode - User Manual Generator from MDD Docs

## Purpose

MANUAL MODE generates a human-readable user manual from MDD feature docs and ops runbooks.
The output is for non-technical users and executives - not developers. It uses a hash-based
incremental system to regenerate only changed sections. Triggered by `/mdd manual [--force]`.

## Architecture

Five phases:

```
M1  Scope & Hash Check   — compare current doc hashes against .mdd/manual/.hashes.json
M2  Skeleton Init        — create .mdd/manual/ directory; write manual skeleton to disk
M3  Section Generation   — generate/update changed sections; batch for 5+ docs; write to disk
M4  Final Assembly       — rebuild TOC, Command Reference, API Reference, Configuration tables
M5  Write Hashes         — update .hashes.json; report stats
```

### M1 - Scope and Hash Check

Loads stored hashes from `.mdd/manual/.hashes.json`. Computes SHA256 for all `.mdd/docs/*.md`
and `.mdd/ops/*.md`. Classifies each file as `unchanged`, `changed`, `new`, or `deleted`.

If all files are unchanged and `manual.md` exists: reports nothing to regenerate. User can
pass `--force` to override and regenerate everything.

### M2 - Skeleton Init

Creates `.mdd/manual/` if missing. Loads or generates default preface (project name, tagline,
version, generated date, overview, TOC placeholder, empty sections). Writes the skeleton to
disk immediately - this protects against context loss before generation completes.

### M3 - Section Generation

**For 1-4 changed docs:** generates sequentially in main conversation, patches each section to
disk before moving to the next.

**For 5+ changed docs:** batches into groups of up to 8. Launches parallel agents per batch;
waits for all in the batch to complete; patches all to disk; reports progress; launches next
batch. Results are never held across batches.

Feature doc sections follow this template: Feature Title → 2-3 sentence description → What It
Does → How To Use It → Commands table → API Endpoints table → Configuration table → Examples.

Ops runbook sections use a condensed template: Runbook Title → Purpose → When To Use → Steps.

Draft-status features are marked "(planned - not yet implemented)" - never presented as available.

### M4 - Final Assembly

Merges all `#### Commands` tables into a sorted Command Reference. Merges all `#### API Endpoints`
into a sorted API Reference (omitted if empty). Merges all `#### Configuration` into a grouped
Configuration section (omitted if empty). Regenerates the Table of Contents from all `##` and
`###` headings, replacing the `<!-- toc -->` block. Builds or updates the preface from
`README.md` intro + `.startup.md` + `package.json` version.

### M5 - Write Hashes

Updates `.mdd/manual/.hashes.json` with current hashes for all existing docs. Removes deleted
doc entries. Sets `_manual_version: 1` or increments it. Reports section counts (generated,
updated, removed, unchanged). Suggests adding `.mdd/manual/` to `.gitignore` if not ignored.

## Output Structure

```
.mdd/manual/manual.md
  # Project Name - User Manual
  > Tagline
  Version: X.Y.Z | Generated: YYYY-MM-DD
  <overview paragraphs>
  ---
  ## Table of Contents  (always regenerated)
  ---
  ## Features
    <!-- mdd-section: 01-slug --> ... <!-- /mdd-section: 01-slug -->
  ---
  ## Operations  (omitted if no ops runbooks)
  ---
  ## Command Reference  (merged alphabetical table)
  ---
  ## API Reference  (merged by path; omitted if empty)
  ---
  ## Configuration  (grouped by feature; omitted if empty)
```

Sections are wrapped in `<!-- mdd-section: id -->` markers enabling incremental patching.
The preface (everything before the first marker) is preserved across regenerations.

## Business Rules

- Manual is for non-technical readers: no internal file paths, no implementation jargon
- Commands and API endpoints must have examples
- Batch generation must write to disk after each batch before starting the next (protects
  against context compaction)
- `--force` treats all docs as changed; does not require deleting `.hashes.json`
- `$ARGUMENTS` is used in phase log calls but is never formally defined in this file

## Data Flow

Reads: `.mdd/docs/*.md`, `.mdd/ops/*.md`, `.mdd/manual/.hashes.json`, `README.md`,
`package.json`.
Writes: `.mdd/manual/manual.md`, `.mdd/manual/.hashes.json`.

## Dependencies

Requires `01-mdd`.

## Security

Not applicable - reads and writes local project files only.

## Known Issues

- Line 449 reads: "No em dashes - never use `-` anywhere in generated content; use a plain
  hyphen `-` instead." This bans the character it then mandates using. Intent is to use a plain
  hyphen `-` instead of an em dash `—`, but the wording is self-contradictory.
- Two steps are labeled "Step 2" in Phase M4 - the second should be Step 3, creating an
  ambiguous execution order.
- `$ARGUMENTS` is used in phase log calls but is not documented as a caller-provided variable.
- The recovery section describes `--force` as "sealing" an incomplete run, but `--force`
  regenerates everything; it does not seal hashes of an existing partial run.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
