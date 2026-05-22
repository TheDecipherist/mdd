---
id: 07-lifecycle
title: Lifecycle Mode - Reverse-Engineer, Graph, and Upgrade
edition: MDD
depends_on: [01-mdd]
relates: [00-frontmatter-spec, 02-build, 03-audit, 11-manage]
source_files:
  - commands/mdd-lifecycle.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [lifecycle, reverse-engineer, graph, upgrade, frontmatter-patch, dependency-map, orphan-detection]
path: Commands/Lifecycle
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 07 - Lifecycle Mode - Reverse-Engineer, Graph, and Upgrade

## Purpose

LIFECYCLE MODE provides three tools for working with existing MDD projects: generating docs
from existing code (reverse-engineer), visualizing the dependency map (graph), and patching
missing frontmatter fields across all docs without touching content (upgrade). Triggered by
`/mdd reverse-engineer`, `/mdd graph`, or `/mdd upgrade`.

## Architecture

Three sub-modes:

```
reverse-engineer   — generate or regenerate feature docs from source code
graph              — show dependency map, orphans, initiative hierarchy, issues
upgrade            — batch-patch missing frontmatter fields across all docs
```

### REVERSE-ENGINEER MODE

Phases R1-R4.

**R1 — Scope:** Determines what to document. If a path or feature ID is given, loads that file
for comparison (regenerate mode) or reads that file fresh (new doc mode). With no argument,
scans `src/` for undocumented TypeScript files and asks which to document.

**R2 — Read source files:** For ≤3 files reads directly in the main conversation. For 4+ files,
batches into up to 3 parallel Explore agents to avoid context explosion. Agents infer purpose,
data models, API routes, business rules, and edge cases but never write files - only the main
conversation writes.

**R3 — Draft the doc:** Drafts a complete feature doc with `status: draft`, `phase: reverse-engineered`,
and `last_synced: today`. In regenerate mode, shows a side-by-side comparison and asks to merge.
In new doc mode, asks the user to validate the inferred content.

**R4 — Save and test skeletons:** After user confirmation, writes the doc. Optionally generates
test skeletons. Always discloses reverse-engineering limitations before saving (inferred content
may miss hidden behavior, invariants only visible at runtime, etc.).

### GRAPH MODE

Phases G1-G3.

**G1 — Build dependency graph:** Reads all `.mdd/docs/*.md` (including archive/) and extracts
`id`, `title`, `status`, `depends_on`. If `.mdd/initiatives/` exists, also reads initiative
and wave docs to build the hierarchy. Produces a directed graph where A → B means "A depends on B".

**G2 — Detect issues:** Identifies broken dependencies (deprecated/archived docs in `depends_on`),
risky dependencies (complete doc depending on draft/in-progress), orphan docs (no dependencies
and no dependents), task docs referenced in `depends_on`, and wave issues (cross-initiative wave
dependencies, missing docs for completed features).

**G3 — Render:** Outputs the dependency graph, orphan list, detected issues, and initiative/wave
hierarchy. Saves to `.mdd/audits/graph-<date>.md`.

### UPGRADE MODE

Phases UP1-UP5.

**UP1 — Inventory:** Globs all docs (including archive/). For each doc reads frontmatter only.
Builds an inventory table showing which fields are missing.

**UP2 — Infer Defaults:** Silently infers sensible defaults before presenting the plan:
- `last_synced`: git commit date of the file, fallback to today
- `status`: inferred from `phase` field, or from keywords in title/purpose
- `phase`: inferred from `status`
- `path`: requires reading doc content; never silently written - always shown in UP3 for review

**UP3 — Show Plan + Confirm:** Presents all proposed patches before writing anything. User
approves all, reviews individually, or cancels.

**UP4 — Patch Docs:** Adds only missing fields; never overwrites existing values. Inserts new
fields in canonical order before `known_issues`.

**UP5 — Verify + Rebuild:** Re-scans to verify 0 missing `last_synced` and `path`. Rebuilds
`.mdd/.startup.md` and regenerates `.mdd/connections.md`.

## Business Rules

- Reverse-engineer: agents never write files; only the main conversation writes
- Reverse-engineer: `phase: reverse-engineered` on all generated docs (never `all` or `complete`)
- Graph: task docs should not appear in `depends_on` - they are one-off and frozen
- Graph: wave dependencies are only valid within the same initiative
- Upgrade: `tags:` is NOT auto-populated during upgrade - run `/mdd rebuild-tags` after
- Upgrade: field insertion order follows canonical schema (see `00-frontmatter-spec`)
- Upgrade references `rebuild-tags` in UP1 and UP4, but this mode is dispatched via `mdd-manage.md`
  not `mdd-lifecycle.md`. The upgrade instruction to "run `/mdd rebuild-tags`" is correct.
- `$ARGUMENTS` is used for all phase log calls but is never formally defined in this file.
  Whether it is set by `mdd.md` before dispatch is undocumented.

## Data Flow

Reads: `src/**/*` (reverse-engineer), `.mdd/docs/*.md` (all modes), `.mdd/initiatives/*.md`
and `.mdd/waves/*.md` (graph). Writes: new or updated feature docs (reverse-engineer),
`.mdd/audits/graph-<date>.md` (graph), patched feature docs (upgrade), `.mdd/.startup.md`,
`.mdd/connections.md`.

## Dependencies

Requires `01-mdd`.

## Security

Not applicable - reads and writes local project files only.

## Known Issues

- `$ARGUMENTS` is used as phase log context but is not documented as a caller-provided variable.
  If not set, all log calls pass an empty string.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
