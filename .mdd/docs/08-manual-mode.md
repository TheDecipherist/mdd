---
id: 08-manual-mode
title: Manual Mode — Project User Manual Generator
edition: Both
depends_on: []
source_files:
  - commands/mdd-manual.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-16
status: complete
phase: all
mdd_version: 10
tags: [manual, documentation, user-guide, hash, incremental, print-ready, toc, ops-runbooks]
path: Commands/Documentation
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 08 — Manual Mode — Project User Manual Generator

## Purpose

Generates a comprehensive, print-ready `manual.md` from all MDD feature docs and ops
runbooks. Uses content hashes to detect which sections have changed since the last run,
regenerating only what is stale. The output is a complete user manual — organized with
a table of contents, human-readable feature descriptions, command reference, API
reference, and configuration guide — suitable for publishing, creating online posts, or
onboarding new users.

## Architecture

Manual Mode is a read-only aggregation command. It never modifies source files or feature
docs. Its lifecycle is:

1. **Hash check** — read `.mdd/manual/.hashes.json`; compare SHA256 of each doc against
   stored values to classify docs as `unchanged`, `changed`, `new`, or `deleted`.
2. **Section generation** — for each changed/new doc, generate a user-friendly section
   using Claude in the main conversation (single doc) or parallel agents (5+ changed docs).
3. **Patch assembly** — load existing `manual.md`, replace sections between
   `<!-- mdd-section: <id> -->` / `<!-- /mdd-section: <id> -->` markers, insert new
   sections, remove sections for deleted docs, regenerate the TOC.
4. **Write output** — write `.mdd/manual/manual.md` and update `.mdd/manual/.hashes.json`.

The section marker system makes manual.md patchable — any section can be replaced
independently without touching the rest of the document, including any manually written
preface or project-level intro the user has added above the generated content.

## API Endpoints

None — CLI-only command.

## Business Rules

**Hash storage format** (`.mdd/manual/.hashes.json`):
```json
{
  "docs/08-manual-mode.md": "abc123",
  "ops/deploy.md": "def456",
  "_generated": "2026-05-16T20:00:00Z",
  "_manual_version": 1
}
```

**Section marker format** (inside `manual.md`):
```markdown
<!-- mdd-section: 08-manual-mode -->
### Manual Mode
...generated content...
<!-- /mdd-section: 08-manual-mode -->
```

**Rules:**
- Sections are identified by the feature doc `id` field, not filename.
- Deleted docs: their sections are removed from `manual.md` and their hash entry removed.
- `--force` bypasses the hash check and regenerates all sections.
- Empty projects (no docs): fail with a clear message, do not create an empty file.
- Ops runbooks are included in a dedicated "Operations" chapter.
- The TOC is always fully regenerated even if only one section changed.
- Content above the first `<!-- mdd-section: -->` marker (manual preface, project intro)
  is preserved across runs.

**Manual structure:**
```
# <Project Name> — User Manual

> <tagline>

## Table of Contents
...auto-generated...

---
## Overview
...from .startup.md / project context...

## Features
<!-- mdd-section: 01-auth -->
...
<!-- /mdd-section: 01-auth -->

## Operations
<!-- mdd-section: ops/deploy -->
...
<!-- /mdd-section: ops/deploy -->

## Command Reference
...aggregated CLI table...

## API Reference
...aggregated endpoint table...

## Configuration
...aggregated env vars / options...
```

## Data Flow

Greenfield — no existing source traced.

Input: `.mdd/docs/*.md`, `.mdd/ops/*.md`, `.mdd/.startup.md`, `.mdd/manual/.hashes.json`
Output: `.mdd/manual/manual.md`, `.mdd/manual/.hashes.json`

## Dependencies

None.

## Security

No external input. Reads only local project files. No network calls. No secrets handled.

## Known Issues

None.
