---
id: 06-bug
title: Bug Mode - Bug Tracking with Feature Doc Integration
edition: MDD
depends_on: [01-mdd, 02-build]
relates: [00-frontmatter-spec, 03-audit, 11-manage]
source_files:
  - commands/mdd-bug.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [bug, triage, scoring, feature-docs, bugs-section, fix, lightweight, commit]
path: Commands/Bug Mode
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 06 - Bug Mode - Bug Tracking with Feature Doc Integration

## Purpose

BUG MODE documents bugs inside feature docs and manages their fix lifecycle. Bugs are tracked
directly in the `## Bugs` section of the affected feature docs rather than a separate system.
Triggered by `/mdd bug <description>`.

## Architecture

Five sequential phases:

```
B0  Parse         — extract $BUG_DESC from arguments
B1  Triage        — score all feature docs for relevance to the bug description
B2  Confirm       — user multi-selects which docs the bug relates to
B3  Document      — append bug row to ## Bugs section in each selected doc
B4  Fix           — lightweight fix (find-diagnose-fix-verify) or full MDD build Phases 4-7
B5  Mark Complete — update bug rows to Completed; regenerate connections.md; commit/merge
```

### Triage Scoring (Phase B1)

Reads frontmatter only (id, title, tags, source_files) for all docs in `.mdd/docs/` excluding
archive. Tokenizes `$BUG_DESC` (strips stop-words: a, the, is, bug, fix, issue, broken, error,
etc.). Scores each doc:
- word in `tags` = +2 points
- word in `title` = +1.5 points
- word in `source_files` filenames = +1 point

Score ≥ 2.0 → candidate. If zero candidates → hard stop with guidance to create a feature doc
first or use reverse-engineer mode.

### Bug Documentation (Phase B3)

Appends to `## Bugs` section in each confirmed doc. Creates the section if it doesn't exist,
placed after `## Known Issues` or after the last `##` section.

```markdown
## Bugs

| ID | Description | Status | Fixed In | Reported | Fixed |
|----|-------------|--------|----------|----------|-------|
| B1 | description | Open   | -        | YYYY-MM-DD | -  |
```

Bug IDs are per-doc (B1, B2, B3...) — not global. The same bug can have different IDs in
different docs.

### Fix Paths (Phase B4)

**Lightweight (Path A):** identify affected files from `source_files` + grep, diagnose, make
minimal targeted fix, verify with typecheck + tests. No refactoring.

**Full MDD (Path B):** follows BUILD MODE Phases 4-7 - write failing tests (red gate), plan
fix blocks, green gate per block, integration verification.

### Completion (Phase B5)

Updates bug rows: `Status: Open → Completed`, fills `Fixed In: file:line`, fills `Fixed` date.
Regenerates `.mdd/connections.md`. Offers commit+merge, commit only, or manual git.

## Business Rules

- Triage hard stop: zero matching docs → stop; user must create a feature doc for the affected
  area before filing the bug
- Once documented in Phase B3, existing bug rows are never modified until Phase B5 completion -
  only new rows are appended
- Fix scope (Path A) is minimal and targeted - no cleanup, no refactoring
- Tests are never modified during the green gate loop (same rule as BUILD MODE)
- `$BUG_SLUG` is passed to all phase log calls but is only derived if explicitly stated in
  `$BUG_DESC`; `$BUG_DESC` itself is not extracted until Phase B0, which fires after the B0
  start log - so the start log context is always blank

## Data Flow

Reads: all `.mdd/docs/*.md` frontmatter (B1 triage); full docs for confirmed set (B3, B4);
source files from `source_files` field (B4 fix).
Writes: bug entries in feature docs (B3); bug status updates in feature docs (B5);
`.mdd/connections.md` (B5 regeneration).

## Dependencies

Requires `01-mdd` and `02-build` (the `## Bugs` section is part of the BUILD MODE doc template,
and the full MDD fix path reuses BUILD MODE Phases 4-7).

## Security

Not applicable - reads and writes local project files only.

## Known Issues

- `$BUG_SLUG` is passed to phase log calls but is never formally slugified from `$BUG_DESC`.
  The context column in log.md is blank for all bug invocations.
- Phase B2 uses `AskUserQuestion with multiSelect: true` syntax, which is pseudo-API - not a
  real Claude tool call. This may confuse implementations that parse the command file literally.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
