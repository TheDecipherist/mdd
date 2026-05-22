---
id: 11-manage
title: Manage Mode - Status, Note, Scan, Update, Deprecate, Tags, Connect
edition: MDD
depends_on: [01-mdd]
relates: [00-frontmatter-spec, 03-audit, 07-lifecycle, 06-bug]
source_files:
  - commands/mdd-manage.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [manage, status, scan, update, deprecate, rebuild-tags, connect, drift-detection, connections-graph]
path: Commands/Manage
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 11 - Manage Mode - Status, Note, Scan, Update, Deprecate, Tags, Connect

## Purpose

MANAGE MODE is a collection of maintenance operations for keeping MDD docs in sync with a
changing codebase. It handles project status snapshots, drift detection, doc updates, feature
deprecation, tag management, and connection graph regeneration. Triggered by `/mdd status`,
`/mdd note`, `/mdd scan`, `/mdd update`, `/mdd deprecate`, `/mdd rebuild-tags`, or
`/mdd connect`.

## Architecture

Seven sub-modes:

```
status              — quick MDD project overview; rebuild .startup.md
note <text|list|clear>  — timestamped notes in .startup.md
scan                — detect drift between docs and source code
update <feature-id> — re-sync a doc with changed source code
deprecate <feature-id> — archive a feature doc
rebuild-tags [--force] — generate tags for all docs
connect             — rebuild connections.md from scratch
```

### status mode

Reads all `.mdd/` structure: feature docs, ops docs, audit reports, wave/initiative files, jobs.
Counts test coverage and checks version spread across docs. Performs a lightweight drift check
(git log on first source file only - not a full scan). Rebuilds `.mdd/.startup.md` auto-generated
zone; preserves everything after `---` (the Notes zone) unchanged.

### note mode

Three sub-commands:
- `note <text>` - appends a timestamped note to `.mdd/.startup.md` Notes section
- `note list` - shows all existing notes
- `note clear` - removes all notes (asks for confirmation)

### scan mode

Three phases. SC1 reads all docs and ops runbooks, extracts `last_synced` and `source_files`.
SC2 delegates git log checks to a single Explore agent (never parallel agent storms) and
classifies each feature as: `untracked` (no git history), `no-path`, `broken` (source file
missing), `drifted` (source changed since last_synced), or `in_sync`. SC3 presents the drift
report, checks wave `initiativeVersion` staleness, checks ops runbook drift, and saves to
`.mdd/audits/scan-<date>.md`.

### update mode

Phases U1-U6. Loads feature by ID, reads source files, diffs doc content against current
code, writes findings to `.mdd/audits/update-notes-<feature-id>-<date>.md`, presents changes
for confirmation, rewrites changed sections while preserving `known_issues` and `depends_on`,
updates `last_synced`/`status`/`phase`, and optionally generates test skeletons for new
behaviors. Regenerates `.mdd/connections.md` after.

### deprecate mode

Phases D1-D3. Scans all docs for `depends_on` references to the target. Shows impact (which
docs depend on it). On confirmation: sets `status: deprecated`, moves to `.mdd/docs/archive/`,
adds `known_issues` warnings to dependent docs, optionally deletes source and test files
(always asks separately - never auto-deletes). Rebuilds `.startup.md`, regenerates
`.mdd/connections.md`.

### rebuild-tags mode

Phases RT1-RT4. Inventories which docs are missing tags. Reads each doc's Purpose section to
infer 4-8 domain-concept keywords. Presents proposed tags for review. Writes tags. Rebuilds
`.startup.md`.

### connect mode

Single operation. Reads all `.mdd/docs/*.md` frontmatter (id, title, status, path, depends_on,
source_files). Generates and writes `.mdd/connections.md` with:
- **Path tree** - sorted alphabetically by path, then by ID; `├──`/`└──` indented tree
- **Mermaid graph** - nodes per doc, `-->` edges per `depends_on`, `:::<status>` suffix,
  classDef for complete/in_progress/draft/deprecated
- **Source overlap** - source files referenced by 2+ docs
- **Warnings** - broken `depends_on` refs, circular deps, docs missing `path`

## Business Rules

- Scan delegates git checks to a single agent, not parallel agents
- Update preserves `known_issues` and `depends_on` (append-only for `known_issues`)
- Deprecate never auto-deletes source or test files - asks separately for each
- Tags must be domain concepts, technology names, feature names - never file paths or
  generic words like "feature" or "module"
- Ops runbook drift is different from feature drift: "drift" for ops means the runbook file
  has not been edited since the last `runop` execution
- SC3 checks wave `initiativeVersion` staleness by comparing the stored `initiativeVersion`
  field against the initiative's current `version`. The command file uses camelCase
  `initiativeVersion` (line 247); the wave schema uses snake_case `initiative_version`.
  This mismatch means SC3 will always find no stale waves.
- The connections.md regeneration procedure is defined identically in 4 locations in the
  command file (lines 405-411, 487-493, 583-589, 635-641)

## Data Flow

Reads: all `.mdd/docs/*.md`, `.mdd/ops/*.md`, `.mdd/initiatives/*.md`, `.mdd/waves/*.md`,
`.mdd/audits/`, `package.json`, `.mdd/.startup.md`.
Writes: `.mdd/.startup.md` (status, note, scan, rebuild-tags), `.mdd/audits/scan-*.md` (scan),
`.mdd/audits/update-notes-*.md` (update), feature docs (update, deprecate, rebuild-tags),
`.mdd/connections.md` (update, deprecate, connect).

## Dependencies

Requires `01-mdd`.

## Security

Not applicable.

## Known Issues

- SC3 uses `initiativeVersion` (camelCase) to check wave staleness, but the wave schema field
  is `initiative_version` (snake_case). The comparison always silently finds nothing - all waves
  are incorrectly reported as in sync regardless of actual staleness.
- The connections.md regeneration block is duplicated verbatim 4 times in the command file
  (lines 405-411, 487-493, 583-589, 635-641). Any spec change must be made in 4 places.
- Duplicate `---` dividers in NOTE MODE (lines 130-132).

## Bugs

(none yet - populated by /mdd bug when issues are reported)
