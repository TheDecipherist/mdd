---
id: 05-import-spec
title: Import Spec — Convert Spec Documents to MDD Feature Docs
edition: Both
depends_on: [03-install-local-flag, 04-global-claude-guidance, 06-doc-path-field]
source_files:
  - commands/mdd-import-spec.md
  - commands/mdd.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-14
status: draft
phase: documentation
mdd_version: 9
tags: [import-spec, spec-converter, commands, modes, initiative, planning, tooling, import]
path: Tooling/Import Spec
known_issues: []
---

# 05 — Import Spec — Convert Spec Documents to MDD Feature Docs

## Purpose

Adds a new `/mdd import-spec <file-path>` mode that reads one or more large spec/prompt documents — the kind produced by extended Claude brainstorming sessions — and converts them into properly structured MDD feature docs. The mode preserves every decision and idea from the original spec, merges duplicates intelligently, and auto-detects whether the scope warrants initiatives and waves or just flat feature docs.

## Architecture

The feature is a new command mode file (`commands/mdd-import-spec.md`) and a single dispatch clause added to the router in `commands/mdd.md`. No CLI source changes needed — the install system copies all `.md` files from `commands/` automatically.

When invoked, the mode runs entirely as a Claude Code slash command: it reads the spec file(s), performs AI analysis, presents a dry-run preview, waits for user confirmation, then writes MDD feature docs and updates `.mdd/.startup.md`.

```
/mdd import-spec <file-or-glob>
         │
         ├── Phase 1: Read & merge spec content
         ├── Phase 2: AI analysis → path grouping pass first, then complexity determination
         │            ├── Group all features into path tree (Area/Section) — see 06-doc-path-field
         │            ├── 3+ distinct top-level path areas → likely initiative-scale
         │            ├── 8+ features across multiple systems → initiative + waves + docs
         │            ├── 4–7 features in a coherent domain  → waves + docs (no initiative)
         │            └── 1–3 focused features               → flat feature docs only
         ├── Phase 3: Dry-run preview — show proposed structure + path tree, wait for approval
         ├── Phase 4: Write files (initiative.md if needed, feature docs with path fields)
         └── Phase 5: Rebuild .mdd/.startup.md
```

## Data Model

No database. Files created by this mode:

| File | Condition | Description |
|------|-----------|-------------|
| `.mdd/initiative.md` | If initiative-scale detected | Initiative manifest with waves list |
| `.mdd/docs/<NN>-<slug>.md` | Always (one per feature) | MDD feature doc with full frontmatter |
| `.mdd/.startup.md` | Always | Rebuilt to reflect new features |

## API Endpoints

None — this is a tooling/command feature.

## Business Rules

### Complexity Thresholds

| Spec scope | Output structure |
|------------|-----------------|
| 8+ distinct features spanning multiple systems or codebases | Initiative → Waves → Feature docs |
| 4–7 features in a coherent domain (same system, clear phases) | Waves → Feature docs (no initiative wrapper) |
| 1–3 focused, bounded features | Flat feature docs only |

These thresholds are guidelines, not hard rules. The AI uses judgment — a 3-feature spec with radically different concerns can still warrant waves.

### Content Preservation

**Nothing from the spec may be lost.** Every decision, constraint, design choice, and edge case in the original document must appear somewhere in the output. If a piece of content doesn't map cleanly to a feature's Purpose/Architecture/Business Rules, it goes into a "Known Constraints" or "Notes" section of the most relevant feature doc. The mode must explicitly account for all spec sections before completing.

### Duplicate & Overlap Handling

Spec documents often revisit the same topic multiple times with refinements. The import process must:
1. Identify duplicate or overlapping topics using semantic similarity (same concept, different phrasing)
2. Merge them into a single, unified description in the relevant feature doc
3. Preserve the most specific/latest decision when versions conflict
4. Note in the dry-run preview which sections were merged and why

### Dry-Run Gate (mandatory)

Before writing any files, the mode MUST display a full dry-run preview and wait for explicit user approval. The preview shows:
- Proposed structure (initiative → waves → docs, or flat)
- Path tree — how features are grouped under Area/Section headings
- Each feature doc with: proposed slug, title, assigned path, one-line description
- Content mapping: which spec sections feed which doc
- Merge summary: which sections were combined and why
- Auto-number plan: what IDs will be assigned

The user can: approve, request adjustments (which trigger a re-analysis), or abort.

### Multiple File Support

When the user provides multiple paths (space-separated or glob), the mode:
1. Reads all files
2. Merges their content, tagging each section with its source filename for traceability
3. Deduplicates across files using the same merge logic
4. Notes in the dry-run which source each feature doc draws from

### Auto-Numbering

Feature doc IDs continue from the highest existing number in `.mdd/docs/`. If docs 01–04 exist, new docs start at 05, 06, etc. IDs are assigned in the dry-run and held until the user approves.

### Path Assignment

Every generated feature doc receives a `path` field (see `06-doc-path-field`). The path grouping pass runs *before* the complexity determination because distinct top-level path areas are the primary signal for initiative-scale scope.

**Algorithm:**
1. Read all existing `.mdd/docs/*.md` path values to understand established product vocabulary
2. For each feature identified in the spec, determine its `path` (Area/Section) using the user's product terminology
3. Group features by shared path prefixes
4. If 3+ distinct root path segments exist → strong signal for initiative-scale

The dry-run preview shows the full path tree before any files are written. The user can rename or reassign paths in the dry-run.

### Tag Generation

Tags are generated using the same logic as `mdd rebuild-tags` (feature 04): domain concepts, systems touched, technology, feature names — never file paths. 4–8 tags per doc.

## Data Flow

Greenfield — no existing code analyzed. The mode operates on text files only.

Input: one or more spec `.md` files on disk
Output: one or more `.mdd/docs/*.md` files + updated `.mdd/.startup.md`

## Dependencies

- `03-install-local-flag` — the new `mdd-import-spec.md` command file is installed to `~/.claude/mdd/` or `.claude/mdd/` by the same install logic
- `04-global-claude-guidance` — tag generation logic and startup.md rebuild logic are reused conceptually (the mode file includes inline instructions matching the established pattern)
- `06-doc-path-field` — import-spec assigns `path` values to every generated doc; the path grouping pass is also the primary signal for initiative vs. flat structure detection

## Known Issues

(none — new feature)
