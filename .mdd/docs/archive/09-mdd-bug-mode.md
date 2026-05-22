---
id: 09-mdd-bug-mode
title: Bug Mode - Fix Bugs with Feature Doc Integration
edition: mdd
depends_on: [04-global-claude-guidance, 07-mdd-connections]
source_files:
  - commands/mdd-bug.md
  - commands/mdd.md
  - commands/mdd-build.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: 11
tags: [bug, bug-tracking, bug-mode, fix, feature-docs, bugs-section, dispatch, router, triage]
path: Commands/Bug Mode
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 09 - Bug Mode - Fix Bugs with Feature Doc Integration

## Purpose

Adds a `/mdd bug DESCRIPTION` command that routes bug fixes through the existing feature doc system rather than creating new docs. When a user reports a bug, MDD scans all feature docs to identify which feature(s) own the broken behavior, then adds a tracked entry to a "Bugs" section in each related doc before fixing the code. This keeps bug history co-located with the feature that owns it, and the "Completed" marker gives a searchable audit trail inside the docs themselves.

## Architecture

```
/mdd bug "users can't log in after password reset"
  |
  Phase B1 - Triage
    Read all .mdd/docs/*.md frontmatter (title, tags, source_files, purpose)
    Score each doc by keyword + tag overlap with bug description
    |
    Present top matches + ask "any others?"
    |
  Phase B2 - Confirm related docs
    If no match found -> stop and warn
    If match found -> confirm with user
    |
  Phase B3 - Document the bug
    Add/update ## Bugs section in each related doc
    Each entry: ID, description, status (Open), date
    |
  Phase B4 - Fix
    User chooses: lightweight fix or full BUILD MODE process
    Lightweight: identify affected files, fix, verify
    Full: test skeletons, red gate, green gate
    |
  Phase B5 - Mark complete
    Update bug entry in all related docs (Open -> Completed, add file:line)
    Regenerate .mdd/connections.md
```

## Bugs Section Format

Every feature doc gets a `## Bugs` section (added by bug mode on first use, or pre-created by build mode). The section lives after `## Known Issues`:

```markdown
## Bugs

| ID | Description | Status | Fixed In | Reported | Fixed |
|----|-------------|--------|----------|----------|-------|
| B1 | Users can't log in after password reset | Completed | src/auth.ts:142 | 2026-05-17 | 2026-05-17 |
| B2 | Token refresh fails on mobile Safari | Open | - | 2026-05-20 | - |
```

Rules:
- IDs are sequential per feature doc (B1, B2, B3...), not global
- Status is `Open` or `Completed`
- `Fixed In` is `file:line` for the primary fix location (or `-` if open)
- When a bug spans multiple docs, each doc gets its own entry with the same description
- Bug entries are never deleted - they serve as an audit trail

## Data Model

No database. Data lives in `.mdd/docs/*.md` frontmatter and body.

**Matching algorithm (Phase B1):**
1. Tokenize the bug description into significant words (strip stop words)
2. For each feature doc, score = (tag matches x 2) + (title word matches x 1.5) + (source_file name matches x 1)
3. Threshold: score >= 2 qualifies as a candidate
4. Present candidates sorted by score, highest first
5. Always ask: "Any other docs you think this relates to?" with the full list as options

## Business Rules

### Triage (Phase B1)
1. Read only frontmatter from all `.mdd/docs/*.md` - never full doc bodies during triage (speed)
2. Exclude archived docs (`archive/` subdirectory)
3. Score every doc - even low-scoring ones are listed in the "any others?" prompt
4. If zero docs score >= 2: stop with warning (do not guess)

### No-match stop condition
When no docs match, display:
```
No feature docs matched the bug description: "<description>"

This could mean:
  - The bug is in undocumented code (run /mdd reverse-engineer first)
  - The description needs different keywords (try feature names or file names)
  - This is a new feature area (use /mdd <description> to build it)

Run /mdd status to see all documented features.
```

### Multi-doc bugs
When a bug spans multiple feature docs, add the identical bug description to each doc's Bugs section. Each entry is independently tracked (separate B-ID per doc). The fix location (`Fixed In`) is only filled in for the doc whose code actually changed - other related docs note `see NN-feature-name:B1`.

### Fix process choice
After confirming related docs, ask the user:
```
How do you want to fix this?
  (a) Lightweight - identify affected files, fix, verify, done
  (b) Full MDD process - test skeletons, red gate, green gate (for complex bugs)
```

**Lightweight fix flow:**
1. Read source_files from all related docs to identify candidates
2. Grep for the bug-related symbols/patterns
3. Fix the issue
4. Run the project's test/typecheck commands to verify
5. Mark bug Completed in all related docs

**Full BUILD MODE flow:**
- Follow mdd-build.md Phases 4-7 (test skeletons, red gate, green gate, integration verification)
- Skip Phases 1-3 (no new doc - update existing docs instead)

### Bugs section insertion
When adding the Bugs section for the first time:
- Insert after the `## Known Issues` section
- If `## Known Issues` doesn't exist, insert after the last section in the doc
- Never insert before `## Purpose`, `## Architecture`, or `## Business Rules`

### Post-fix cleanup
After marking all bugs Completed:
1. Regenerate `.mdd/connections.md` (same as build mode Phase 7c)
2. Rebuild `.mdd/.startup.md` (same as manage mode)

### Router dispatch
Add to `mdd.md` Step 0b, before the catch-all build rule:
```
- If arguments start with `bug` ->
  Read `$MDD_DIR/mdd-bug.md` then follow BUG MODE instructions.
```

### Build mode template update
Add a `## Bugs` section to the Phase 3 template in `mdd-build.md`, after `## Known Issues`:
```markdown
## Bugs

(none yet - populated by /mdd bug when issues are reported)
```

### CLAUDE.md guidance update
The guidance block in `04-global-claude-guidance` currently says "Skip entirely for: bug fixes". Update to:
"For bug fixes -> suggest `/mdd bug <description>` to track and fix with doc integration."

## Dependencies

- `04-global-claude-guidance` - the CLAUDE.md guidance block needs updating to route bug fixes to `/mdd bug` instead of skipping MDD entirely
- `07-mdd-connections` - connections.md is regenerated after any doc update; bug mode follows the same regeneration pattern

## Security

Not applicable - no external input, no network calls, no credential handling. Reads and writes only local project files.

## Known Issues

(none yet)

## Bugs

(none yet - populated by /mdd bug when issues are reported)
