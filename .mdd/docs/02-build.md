---
id: 02-build
title: Build Mode - Feature Documentation and Implementation Workflow
edition: MDD
depends_on: [01-mdd]
relates: [00-frontmatter-spec, 03-audit, 04-plan, 06-bug]
source_files:
  - commands/mdd-build.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [build, phases, feature-doc, test-skeletons, green-gate, red-gate, implementation, build-plan]
path: Commands/Build
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 02 - Build Mode - Feature Documentation and Implementation Workflow

## Purpose

BUILD MODE is the core MDD workflow for developing a new feature. It runs when `/mdd` is invoked
with any argument that does not match a named mode. The workflow enforces documentation-first
development: write the spec, write failing tests, implement until tests pass.

## Architecture

BUILD MODE runs 9 phases in sequence. Phases 0-3 produce documentation. Phases 4-6 produce
working code. Phase 7 verifies the result and closes the feature.

```
Pre-0  Stack Rule Loading  — load mdd-rules-<stack>.md files; append to Phase 6 checklist
Phase 0   Branch Safety Check — verify branch matches feature; offer merge if mismatch
Phase 1   Understand          — 3 parallel agents gather rules, existing features, codebase
Phase 2   Data Flow Analysis  — trace data through existing code; gate on findings
Phase 3   Write the Doc       — create .mdd/docs/NN-slug.md from canonical template
Phase 4   Test Skeletons      — generate failing unit/E2E tests from the doc
Phase 4b  Red Gate            — verify all tests FAIL before proceeding
Phase 5   Build Plan          — generate block structure or flat steps; user confirms
Phase 6   Implement           — execute blocks layer by layer; Green Gate loop per block
Phase 7   Verify + Report     — quality gates, integration verification, commit/merge
```

### Stack Rule Loading

Runs before Phase 0. For each entry in `$MDD_STACK`, looks for `mdd-rules-{entry}.md` in
`$MDD_DIR`. If found, reads it and appends its checklist items to Phase 6 implementation steps
and Phase 7b audit criteria. Additive only - never replaces or gates core build behavior.

### Phase 0 - Branch Safety

Checks whether the current branch matches the feature being built. Derives a slug from
`$ARGUMENTS` and compares it against the current branch name (stripped of prefix). If fewer
than half the significant words match, a mismatch is detected and the user is offered three
choices: commit and branch fresh, continue on the current branch, or abort.

Skipped if: on main/master (auto-branching handles it), on an audit branch, or branch already
contains keywords from `$ARGUMENTS`.

### Phase 1 - Understand the Feature

Launches 3 parallel agents simultaneously:
- **Agent A (Rules):** reads CLAUDE.md and project architecture docs
- **Agent B (Features):** reads all `.mdd/docs/*.md` frontmatter; identifies related features
- **Agent C (Codebase):** globs `src/**/*`; returns structure and tech stack

After all three return, synthesizes context and asks targeted questions in a single interaction.
For tooling tasks (few source files + keywords like `command`, `hook`, `script`) skips database
and API questions.

### Phase 2 - Data Flow Analysis

Skipped when `.mdd/docs/` is empty and `src/` has fewer than 5 source files ("greenfield").
Otherwise reads files the feature will touch and traces how each data value moves: backend
computation, API transport, frontend consumption, parallel computations. Writes findings to
`.mdd/audits/flow-<slug>-<date>.md`. Gates on user confirmation before writing any documentation.

### Phase 3 - Write the MDD Doc

Creates `.mdd/docs/<NN>-<slug>.md` using the canonical template from `00-frontmatter-spec`.
Auto-numbers by reading the highest existing number in `.mdd/docs/` and incrementing.

Key rules:
- `last_synced` always set to today
- `status: draft` for new docs
- `depends_on` lists only feature doc IDs, never task doc IDs
- Phase 3a: for each dependency with `integration_contracts`, adds `satisfies_contracts` placeholders
- Phase 3b: special case rules for immutability, MCP threat models, node substitution, template
  pattern matching

Rebuilds `.mdd/.startup.md` after writing. Gates on user confirmation.

### Phase 4 - Test Skeletons

Reads the new feature doc. Generates one `describe` block per endpoint or business rule, one
`it` block per documented behavior. Every `it` ends with `expect.fail('Not implemented — MDD skeleton')`.
Both unit and E2E skeletons spawn as parallel agents when both are needed.

### Phase 4b - Red Gate

Runs the new test files only. All tests must FAIL before proceeding. If any test passes
unexpectedly, investigates root cause and fixes the skeleton. Hard gate - no exceptions.

### Phase 5 - Build Plan

Auto-detects feature size. Simple features (fewer than 3 files, no routes, no DB) get flat steps.
Medium/large features get blocks, where each block must have: a runnable end-state, a
commit-worthy scope, and a concrete verification command. Dependency layers determine execution
order (types first, then services, then wiring, then tests).

### Phase 6 - Implement

Executes blocks in dependency-layer order. Parallel blocks within a layer spawn as agents only
after passing the file declaration gate (no overlap) and type dependency gate (Layer 1 types
must exist before Layer 2 uses them).

Green Gate per block (max 5 iterations): run tests + typecheck, diagnose failures, fix
implementation (never the tests), retry. On iteration 5 failure, stop and ask the user.

### Phase 7 - Verify + Report

**7a:** typecheck + full test suite must pass.
**7b:** Integration verification against a real environment (not mocked). Backend features require
a real HTTP call and real DB state check. Frontend features require a browser and visible output.
**7c:** Contract verification gate - all `satisfies_contracts` entries must be `status: done` with
`verified_at: "file:line"`. All `source_files` must exist on disk. Updates doc to `status: complete`.
Regenerates `.mdd/connections.md`.
**7d:** Asks user to commit+merge, commit only, or skip.

## Business Rules

- Tests are NEVER modified during the Green Gate loop. If a test seems wrong, re-read the doc.
  If the doc seems wrong, stop and ask the user.
- `satisfies_contracts` entries must use `status: done` + `verified_at: "file:line"`. Using
  `verified: <value>` is a schema error.
- The "immutability rule": values described as immutable require both `readonly` typing and
  `Object.freeze()`. A plain `const` array fails audit.
- Phase 2 gate is mandatory - documentation cannot begin until the user confirms the data flow
  analysis.
- Phase 4b gate is mandatory - implementation cannot begin until all tests are red.
- Phase 3a integration contract resolution is mandatory when `depends_on` is non-empty.

## Data Flow

Greenfield from the perspective of this feature doc. The BUILD MODE itself manages data flow
tracing for the features it builds (Phase 2 writes `.mdd/audits/flow-*.md`).

## Dependencies

Requires `01-mdd` (router + bootstrap must run before any build invocation).

## Security

BUILD MODE reads local project files only. Phase 3b documents MCP/external-caller threat model
requirements for features that expose untrusted surfaces.

## Known Issues

- `$FEATURE_SLUG` is passed to all phase log calls but is never formally defined in the command
  file. The context column in `~/.claude/mdd/log.md` is blank for every build invocation.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
