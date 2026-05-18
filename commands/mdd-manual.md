## MANUAL MODE - `/mdd manual [--force]`

Triggered when arguments start with `manual`.

Generates a comprehensive, print-ready user manual at `.mdd/manual/manual.md` from all
MDD feature docs and ops runbooks. Uses content hashes to detect what changed since the
last run - only stale sections are regenerated.

Sections are written to disk **immediately after each generation batch completes** - never
held in memory until the end. This means compaction mid-run loses at most one batch of
sections, and the next run can resume from the saved state.

---

### Phase M1 - Scope & Hash Check

**Step 1 - Guard against empty projects**

Check `.mdd/docs/`. If it contains zero `.md` files:
```
⚠️  No feature docs found.
Run /mdd <feature> to create your first doc, then re-run /mdd manual.
```
Stop here.

**Step 2 - Load stored hashes**

Read `.mdd/manual/.hashes.json` if it exists. If absent, treat every doc as new (full
generation run).

Stored hash format:
```json
{
  "docs/01-auth.md": "sha256hex",
  "ops/deploy.md": "sha256hex",
  "_generated": "2026-05-16T20:00:00Z",
  "_manual_version": 1
}
```

**Step 3 - Compute current hashes**

For every file in `.mdd/docs/*.md` and `.mdd/ops/*.md`, compute SHA256 of file contents:
```bash
sha256sum .mdd/docs/*.md .mdd/ops/*.md 2>/dev/null
```

**Step 4 - Classify each doc**

Compare current vs stored hashes:
- `unchanged` - hash matches stored value → skip section regeneration
- `changed` - hash differs → regenerate section
- `new` - no stored hash → generate section
- `deleted` - stored hash exists but file no longer present → remove section

If `--force` was passed: treat every doc as `changed` regardless of hashes.

**Step 5 - Report scope**

```
📖 MDD Manual Generator

Docs in scope: <N> feature docs, <N> ops runbooks
  ✓ unchanged  <N>  (skipping)
  ~ changed    <N>  (regenerating)
  + new        <N>  (generating)
  - deleted    <N>  (removing)

Output: .mdd/manual/manual.md
```

If all docs are `unchanged` and `manual.md` already exists:
```
✓ Manual is up to date. No changes needed.
  Run with --force to regenerate everything.
```
Stop here.

---

### Phase M2 - Skeleton Init (before generating any sections)

Before generating any sections, ensure `manual.md` is in a writable state on disk.
This protects against compaction - each section written to disk is durable.

**Step 1 - Ensure output directory exists**
```bash
mkdir -p .mdd/manual
```

**Step 2 - Load existing manual or build skeleton**

Read `.mdd/manual/manual.md` if it exists. Identify the preface: everything before the
first `<!-- mdd-section: -->` marker. If the file is new, generate a default preface
(see Phase M3 Step 2 below for the preface format) and write the skeleton immediately:

```markdown
# <Project Name> - User Manual

> <tagline>

**Version:** <version>
**Generated:** <date>

<overview paragraphs>

---

## Table of Contents
<!-- toc -->
(regenerated on completion)
<!-- /toc -->

---

## Overview

<overview content>

---

## Features

(sections generating - re-run /mdd manual if interrupted)

---

## Operations

(sections generating - re-run /mdd manual if interrupted)

---

## Command Reference

(regenerated on completion)

---
```

Write this skeleton to `.mdd/manual/manual.md` now, before any agents are launched.
This ensures the file exists on disk even if compaction occurs mid-generation.

**Step 3 - Remove deleted sections**

For each doc classified as `deleted`: find and remove the entire
`<!-- mdd-section: <id> -->` … `<!-- /mdd-section: <id> -->` block (including
surrounding blank lines) from the current manual.md on disk. Write the file after
each removal.

---

### Phase M3 - Section Generation (incremental, batch-by-batch)

For each `changed` or `new` doc, generate a user-friendly manual section. The section
must be readable by someone who has never seen the source code - focus on WHAT the
feature does and HOW to use it, not implementation details.

**Section structure per feature doc:**

```markdown
<!-- mdd-section: <doc-id> -->
### <Feature Title>

<2-3 sentence plain-English description of what this feature does and the problem it solves.>

#### What It Does
<Paragraph explaining the feature from a user perspective. No code internals.>

#### How To Use It
<Step-by-step user instructions. Include command syntax, options, examples.>

#### Commands
<If the feature has CLI commands - table with command, description, flags.>
| Command | Description | Flags |
|---------|-------------|-------|
| `mdd <cmd>` | … | `--flag` |

#### API Endpoints
<If the feature exposes HTTP endpoints - table with method, path, description.>
| Method | Path | Description | Auth |
|--------|------|-------------|------|

#### Configuration
<If the feature has configurable options - env vars, settings, flags.>
| Option | Type | Default | Description |
|--------|------|---------|-------------|

#### Examples
<1-3 concrete usage examples. Real commands, real output snippets.>

<!-- /mdd-section: <doc-id> -->
```

For ops runbooks, use a condensed format:

```markdown
<!-- mdd-section: ops/<slug> -->
### <Runbook Title>

<Purpose of this runbook.>

#### When To Use
<Triggers or conditions that call for this runbook.>

#### Steps
<Numbered list of the procedure.>

<!-- /mdd-section: ops/<slug> -->
```

**Parallelism and incremental writing - CRITICAL:**

- **1–4 changed docs** → generate sequentially in main conversation. After EACH section
  is generated, immediately patch it into `manual.md` on disk (see patching rules below)
  before generating the next section.

- **5+ changed docs** → split into batches of up to 8. For each batch:
  1. Launch one `general-purpose` agent per doc in the batch (all agents in the batch
     run concurrently). Each agent receives: the full doc content, the section structure
     template above, and the output section id.
  2. **Wait for ALL agents in this batch to complete.**
  3. Immediately patch ALL returned sections into `manual.md` on disk (one Write call
     per section, or one Write call with all sections patched at once).
  4. Report progress: `  ✓ Batch <N>/<total> written to disk (<M> sections)`
  5. Then launch the next batch.

  **Never hold results across batches.** Each batch's sections must be on disk before
  the next batch starts. Compaction mid-batch loses at most 8 sections; those will be
  regenerated on the next `/mdd manual` run (their hashes won't be in `.hashes.json`
  since that's only written at the very end).

**Section patching rules (applied after each batch or each sequential section):**

For each returned section:
- Find the `<!-- mdd-section: <id> -->` … `<!-- /mdd-section: <id> -->` block in the
  current `manual.md`.
- If found: replace the entire block with the new section.
- If not found (new doc): append the section after the last `<!-- /mdd-section: -->` tag
  in the Features chapter (or Operations chapter for ops runbooks). If neither marker
  exists yet, append after the `## Features` or `## Operations` heading.
- Write `manual.md` to disk after each patch.

**Reading source files during generation:**
When the feature doc lists `source_files`, read those files briefly to verify the section
accurately reflects what is implemented - do not invent capabilities not present in code.
If source files don't exist yet (draft feature), note the section as "(planned)" in the
section header.

---

### Phase M4 - Final Assembly

After all sections are on disk, perform final assembly passes on `manual.md`.

**Step 1 - Rebuild aggregated reference sections**

Scan every `<!-- mdd-section: -->` block in the current `manual.md` for:

**Command Reference** - find all `#### Commands` tables. Merge into one master table,
sorted alphabetically by command. Include a "Feature" column. Replace the existing
`## Command Reference` section (or append if missing).

**API Reference** - find all `#### API Endpoints` tables. Merge into one master table,
sorted by path. Include a "Feature" column. Replace the existing `## API Reference`
section (or append if missing). Omit this section entirely if no API endpoints were found.

**Configuration** - find all `#### Configuration` tables. Merge into one master table,
grouped by feature. Replace the existing `## Configuration` section (or append if
missing). Omit this section entirely if no configuration options were found.

**Step 2 - Regenerate TOC**

Scan the assembled document for all `##` and `###` headings. Build a markdown TOC with
anchor links. Replace the `<!-- toc -->` … `<!-- /toc -->` block (between
`## Table of Contents` and the next `---` divider) with the new TOC.

**Step 3 - Final document structure**

The assembled `manual.md` must follow this order:

```markdown
# <Project Name> - User Manual        ← preface (preserved or generated)
> <tagline>

**Version:** … **Generated:** …

<overview paragraphs>

---

## Table of Contents                   ← always regenerated
<!-- toc -->
1. [Overview](#overview)
2. [Features](#features)
   - [Feature Name](#feature-name)
   ...
3. [Operations](#operations)            ← omit if no ops runbooks
4. [Command Reference](#command-reference)
5. [API Reference](#api-reference)      ← omit if no API endpoints found
6. [Configuration](#configuration)     ← omit if no config options found
<!-- /toc -->

---

## Overview                            ← static or regenerated from .startup.md

---

## Features

<!-- mdd-section: 01-... -->
...
<!-- /mdd-section: 01-... -->

<!-- mdd-section: 02-... -->
...

---

## Operations                          ← only if .mdd/ops/ has any files

<!-- mdd-section: ops/... -->
...

---

## Command Reference
| Command | Description | Flags | Feature |

---

## API Reference
| Method | Path | Description | Auth | Feature |

---

## Configuration
| Option | Type | Default | Description | Feature |
```

**Step 2 - Build/update preface** (if generating for the first time)

If the preface was newly generated in Phase M2, ensure it uses this content:

Read `.mdd/.startup.md` for: project name, stack, tagline. Read `package.json` (if
present) for version. Read `README.md` introduction (first 3 paragraphs, if present).

```markdown
# <Project Name> - User Manual

> <tagline or one-sentence description>

**Version:** <version from package.json, or "-">
**Generated:** <date>

<2-3 paragraph project overview synthesized from README and .startup.md>

---
```

Write the final assembled `manual.md` to disk.

---

### Phase M5 - Write Hashes & Report

**Step 1 - Update hash store**

Write `.mdd/manual/.hashes.json` with:
- One entry per doc that now exists on disk (use the current hash)
- Remove entries for deleted docs
- Update `_generated` to current ISO timestamp
- Set `_manual_version: 1` (or increment if already set)

**Only write this file after manual.md is fully complete.** The hash file is the
completion marker - if `.hashes.json` is missing or stale, the next run will know
to regenerate all sections.

**Step 2 - Report**

```
✅ Manual generated

Output:  .mdd/manual/manual.md
Sections: <N> features, <N> ops runbooks
  Generated:  <N> new sections
  Updated:    <N> changed sections
  Removed:    <N> deleted sections
  Unchanged:  <N> sections (skipped)

Hashes:  .mdd/manual/.hashes.json updated

Tip: manual.md is print-ready markdown. Open in any markdown viewer,
     export to PDF, or use as source material for blog posts and docs.
```

**Step 3 - Gitignore check**

Check whether `.mdd/manual/` is in `.gitignore`. If not, suggest:
```
💡 .mdd/manual/ is not gitignored. Add it if you prefer not to commit the
   generated manual (it can be regenerated at any time with /mdd manual).
```

---

### Flags

| Flag | Effect |
|------|--------|
| `--force` | Bypass hash check - regenerate all sections |
| (none) | Default - only regenerate changed/new sections |

---

### Notes on Quality

When generating each section, the goal is a document a non-technical user or executive
can read and understand. Rules for section writers:

- **No em dashes** - never use `-` anywhere in generated content; use a plain hyphen `-` instead
- **No internal file paths** in body text (they belong in the feature doc, not the manual)
- **No jargon without definition** - if a term needs explanation, add it
- **Active voice** - "The auth system validates your token" not "Tokens are validated"
- **One idea per paragraph** - keep paragraphs to 3-5 sentences
- **Examples are mandatory** for any command or API endpoint listed
- **Planned features** are clearly marked `(planned - not yet implemented)`

### Recovery from Interrupted Runs

If `/mdd manual` was interrupted mid-generation (context compaction, session end, etc.):

1. Re-run `/mdd manual`. The hash check will find that `.hashes.json` is missing or
   incomplete (since it's only written at the very end in Phase M5).
2. Sections already written to `manual.md` (from completed batches) will be detected as
   present - but since their hashes aren't in `.hashes.json`, they'll be classified as
   `new` and regenerated.
3. The regenerated sections will simply replace what was already there. No data is lost.

To skip regenerating sections that look complete, a user can run `--force` after manually
verifying the manual looks correct, then let Phase M5 write the hash file to seal the run.
