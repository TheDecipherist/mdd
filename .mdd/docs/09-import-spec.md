---
id: 09-import-spec
title: Import Spec Mode - Convert Spec Documents to MDD Feature Docs
edition: MDD
depends_on: [01-mdd, 04-plan]
relates: [00-frontmatter-spec, 02-build, 07-lifecycle]
source_files:
  - commands/mdd-import-spec.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [import-spec, spec-converter, component-spec, wave-template, claude-md, project-type-detection, manifest]
path: Commands/Import Spec
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 09 - Import Spec Mode - Convert Spec Documents to MDD Feature Docs

## Purpose

IMPORT SPEC MODE reads a product or technical specification document and generates the complete
MDD document structure: initiative, wave files, feature docs, and optionally a CLAUDE.md. It
transforms descriptive spec prose into prescriptive build instructions for Claude. Triggered by
`/mdd import-spec <file-path>`.

## Architecture

Six phases:

```
IS1    Read Spec Files          — parse files; detect stale jobs; handle multi-file merge
IS2    Extract + Classify       — feature extraction, path grouping, project type, wave ordering
IS2.5  CLAUDE.md Check          — offer to draft CLAUDE.md if missing or thin
IS3    Dry-Run Preview          — mandatory gate: show full structure before writing anything
IS4    Write Files              — CLAUDE.md → initiative → waves → feature docs in order
IS5    Rebuild Startup + Connect — rebuild .startup.md; regenerate connections.md; cleanup job
```

### Spec vs Feature Doc

A **spec** is descriptive: what the system does, how it behaves, its interfaces. A **feature doc**
is prescriptive: exactly what Claude should build, verified by concrete acceptance criteria.
IMPORT SPEC bridges these: it reads the spec and writes build instructions.

### IS1 - Read Spec Files

First checks `.mdd/jobs/` for stale `import-*/` jobs (offer resume or discard). Parses file
paths from arguments and verifies they exist. For files over 2,000 lines, reads in sequential
chunks with progress reporting. Merges multiple files with internal `<!-- source: filename -->`
tags for traceability (never written to output).

### IS2 - Feature Extraction, Classification, and Wave Ordering

Four sub-steps, always in this order:

**IS2a — Extract features + line ranges:** Identifies every distinct buildable feature and
records exact line ranges (including secondary ranges where the feature is discussed again).
Merges spec sections covering the same concept - does not create duplicate feature docs.
Changelog and retrospective sections are mapped as decision records to their parent feature,
not extracted as standalone features.

**IS2b — Assign paths:** Reads existing `.mdd/docs/*.md` `path` fields to learn vocabulary.
Assigns `path` using product vocabulary (not code module names).

**IS2c — Project type detection + wave ordering:** The critical step. Determines build order
from project signals (not spec order):

| Type | Signals | Wave template |
|------|---------|---------------|
| Language/Toolchain | parser, AST, grammar, directives, syntax, runtime, CLI | 6 waves: parser → CLI/packaging |
| Web API/Backend | endpoints, REST, GraphQL, auth, DB models | 6 waves: scaffold/DB → admin/hardening |
| Frontend/UI | components, pages, routing, interactions, state | 5 waves: routing/layout → polish/a11y |
| Library/SDK | public API, exported types, no server/UI | 4 waves: core types → distribution/docs |
| Extension/Plugin | assumes host system exists | waves ordered by user-facing value |

Each feature is classified as **COMPONENT** (code to write) or **SPEC** (behavior contract
implemented by a COMPONENT). SPECs and their implementing COMPONENTs always live in the same
wave. COMPONENT `depends_on` SPEC.

**IS2d — Determine output structure:** Based on feature count and path area count:
- 3+ areas + 8+ features → Initiative + Waves + Feature docs
- 1-2 areas + 4-7 features → Waves + Feature docs (no initiative)
- 1-3 features → Flat feature docs only

### IS3 - Dry-Run Preview (Mandatory Gate)

Shows the complete proposed structure before writing any files: feature count, proposed hierarchy
with wave demo-states, ID range assigned, merge decisions, content-to-source mapping. User must
explicitly approve before IS4 proceeds. After approval, creates the job MANIFEST.

### IS4 - Write Files

**Critical rule:** For each feature doc, re-reads the source spec at the line ranges from IS2a
before writing. Never writes from the IS2a summary alone.

Feature docs use these sections instead of the standard BUILD MODE template:
- **What to Build** - exact deliverable; for COMPONENT: files/modules/input/output/what not to do
- **Architecture** - where it fits; for SPEC: which COMPONENT implements it
- **Implementation Notes** - key decisions, non-obvious constraints
- **Data Model** - exact field names, types, defaults, JSON examples verbatim
- **API / Interface** - complete public interface: every function, flag, subcommand, config key
- **Business Rules** - every constraint, error behavior, platform difference, always/never rule
- **Acceptance Criteria** - concrete, verifiable statements Claude can check
- **Dependencies** - other feature doc IDs; SPECs state which COMPONENT implements them

Completeness checklist before writing each doc: every option table row, every CLI subcommand,
every config key, every error message format, every behavioral table, every always/never rule,
every named distinction.

### IS5 - Rebuild and Cleanup

Rebuilds `.mdd/.startup.md` auto-generated zone. Regenerates `.mdd/connections.md` (path tree,
Mermaid graph, source overlap, warnings). Deletes the job folder.

## Business Rules

- Build order is determined by project type and developer dependency, not spec section order
- Spec sections covering the same feature are merged; duplicate docs are never created
- Changelog and retrospective sections map to parent features, not standalone docs
- Feature docs are build instructions ("what to build and how to verify it"), not reference docs
- `path` uses product vocabulary (not code module names)
- MANIFEST is created before any file writing; tracks `[ ]`/`[~]`/`[x]`/`[!]` states for resume
- Initiative file template in IS4 uses `waves/<slug>.md` (without `.mdd/` prefix) - correct paths
  are `.mdd/waves/<slug>.md` (P2 known issue in the command file itself)
- Resume logic says "skip IS1-IS3" but this instruction appears inside IS1 - should say
  "skip the remainder of IS1 and all of IS2-IS3" (P2 known issue)

## Data Flow

Reads: user-specified spec files; existing `.mdd/docs/*.md` path fields; CLAUDE.md (IS2.5).
Writes: CLAUDE.md (optional), `.mdd/initiatives/<slug>.md`, `.mdd/waves/<slug>-wave-N.md`,
`.mdd/docs/<NN>-<slug>.md`, `.mdd/.startup.md`, `.mdd/connections.md`.

## Dependencies

Requires `01-mdd`. Wave structure reuses `04-plan` schemas (initiative, wave frontmatter).

## Security

Not applicable - reads local spec files; writes local project files only.

## Known Issues

- Initiative file template in IS4 (lines 447-448) uses `waves/<slug>.md` without the `.mdd/`
  prefix. Every initiative file created will have broken paths in its Waves table.
- Resume logic in IS1 says "skip IS1-IS3" from within IS1 - cannot skip IS1 from inside IS1.
  Should say "skip the remainder of IS1 and all of IS2-IS3."
- Step numbering in IS4 is confusing: steps 3-4 appear after an embedded template block and
  are logically sub-steps of step 2, not independent parallel steps.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
