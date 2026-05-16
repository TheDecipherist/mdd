## MANUAL MODE — `/mdd manual [--force]`

Triggered when arguments start with `manual`.

Generates a comprehensive, print-ready user manual at `.mdd/manual/manual.md` from all
MDD feature docs and ops runbooks. Uses content hashes to detect what changed since the
last run — only stale sections are regenerated.

---

### Phase M1 — Scope & Hash Check

**Step 1 — Guard against empty projects**

Check `.mdd/docs/`. If it contains zero `.md` files:
```
⚠️  No feature docs found.
Run /mdd <feature> to create your first feature doc, then re-run /mdd manual.
```
Stop here.

**Step 2 — Load stored hashes**

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

**Step 3 — Compute current hashes**

For every file in `.mdd/docs/*.md` and `.mdd/ops/*.md`, compute SHA256 of file contents:
```bash
sha256sum .mdd/docs/*.md .mdd/ops/*.md 2>/dev/null
```

**Step 4 — Classify each doc**

Compare current vs stored hashes:
- `unchanged` — hash matches stored value → skip section regeneration
- `changed` — hash differs → regenerate section
- `new` — no stored hash → generate section
- `deleted` — stored hash exists but file no longer present → remove section

If `--force` was passed: treat every doc as `changed` regardless of hashes.

**Step 5 — Report scope**

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

### Phase M2 — Section Generation

For each `changed` or `new` doc, generate a user-friendly manual section. The section
must be readable by someone who has never seen the source code — focus on WHAT the
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
<If the feature has CLI commands — table with command, description, flags.>
| Command | Description | Flags |
|---------|-------------|-------|
| `mdd <cmd>` | … | `--flag` |

#### API Endpoints
<If the feature exposes HTTP endpoints — table with method, path, description.>
| Method | Path | Description | Auth |
|--------|------|-------------|------|

#### Configuration
<If the feature has configurable options — env vars, settings, flags.>
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

**Parallelism:**
- 1–4 changed docs → generate in main conversation sequentially
- 5+ changed docs → launch one `general-purpose` agent per doc (max 8 concurrent). Each
  agent receives: the full doc content, the section structure template above, and the
  output section id. Collect all outputs before proceeding to Phase M3.

**Reading source files during generation:**
When the feature doc lists `source_files`, read those files briefly to verify the section
accurately reflects what is implemented — do not invent capabilities not present in code.
If source files don't exist yet (draft feature), note the section as "(planned)" in the
section header.

---

### Phase M3 — Assembly

**Step 1 — Load existing manual (if any)**

Read `.mdd/manual/manual.md`. If it does not exist, start with an empty string.

Identify the preface: everything before the first `<!-- mdd-section: -->` marker. This
is user-written content — preserve it exactly across runs. If the file is new, generate
a default preface (see Step 2).

**Step 2 — Build/update preface**

If generating for the first time (no existing manual), create a preface:

Read `.mdd/.startup.md` for: project name, stack, tagline. Read `package.json` (if
present) for version. Read `README.md` introduction (first 3 paragraphs, if present).

```markdown
# <Project Name> — User Manual

> <tagline or one-sentence description>

**Version:** <version from package.json, or "—">
**Generated:** <date>

<2-3 paragraph project overview synthesized from README and .startup.md>

---
```

**Step 3 — Patch sections**

Apply changes to the existing manual body:

- **Changed/new sections:** Find the `<!-- mdd-section: <id> -->` … `<!-- /mdd-section: <id> -->` block in the existing body and replace it with the newly generated section. If no existing block is found (new doc), append after the last existing `<!-- /mdd-section -->` tag in the Features or Operations chapter.
- **Deleted sections:** Find and remove the entire `<!-- mdd-section: <id> -->` … `<!-- /mdd-section: <id> -->` block including surrounding blank lines.
- **Unchanged sections:** Leave exactly as-is.

**Step 4 — Rebuild aggregated reference sections**

After patching all feature sections, regenerate these always (they aggregate across all docs):

**Command Reference** — scan every feature section for `#### Commands` tables. Merge into one master table, sorted alphabetically by command. Include a "Feature" column.

**API Reference** — scan every feature section for `#### API Endpoints` tables. Merge into one master table, sorted by path. Include a "Feature" column.

**Configuration** — scan every feature section for `#### Configuration` tables. Merge into one master table, grouped by feature.

**Step 5 — Regenerate TOC**

Scan the assembled document for all `##` and `###` headings. Build a markdown TOC with anchor links. Replace the existing TOC block (between `## Table of Contents` and the next `---` divider) with the new one.

**Step 6 — Final document structure**

The assembled `manual.md` must follow this order:

```markdown
# <Project Name> — User Manual        ← preface (preserved or generated)
> <tagline>

**Version:** … **Generated:** …

<overview paragraphs>

---

## Table of Contents                   ← always regenerated
1. [Overview](#overview)
2. [Features](#features)
   - [Feature Name](#feature-name)
   ...
3. [Operations](#operations)            ← omit if no ops runbooks
4. [Command Reference](#command-reference)
5. [API Reference](#api-reference)      ← omit if no API endpoints found
6. [Configuration](#configuration)     ← omit if no config options found

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

Omit any aggregated section (API Reference, Configuration) if no content was found across
all feature sections.

---

### Phase M4 — Write Output & Update Hashes

**Step 1 — Ensure output directory exists**
```bash
mkdir -p .mdd/manual
```

**Step 2 — Write manual**

Write the assembled document to `.mdd/manual/manual.md`.

**Step 3 — Update hash store**

Write `.mdd/manual/.hashes.json` with:
- One entry per doc that now exists on disk (use the current hash)
- Remove entries for deleted docs
- Update `_generated` to current ISO timestamp
- Set `_manual_version: 1` (or increment if already set)

**Step 4 — Report**

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

**Step 5 — Gitignore check**

Check whether `.mdd/manual/` is in `.gitignore`. If not, suggest:
```
💡 .mdd/manual/ is not gitignored. Add it if you prefer not to commit the
   generated manual (it can be regenerated at any time with /mdd manual).
```

---

### Flags

| Flag | Effect |
|------|--------|
| `--force` | Bypass hash check — regenerate all sections |
| (none) | Default — only regenerate changed/new sections |

---

### Notes on Quality

When generating each section, the goal is a document a non-technical user or executive
can read and understand. Rules for section writers:

- **No internal file paths** in body text (they belong in the feature doc, not the manual)
- **No jargon without definition** — if a term needs explanation, add it
- **Active voice** — "The auth system validates your token" not "Tokens are validated"
- **One idea per paragraph** — keep paragraphs to 3–5 sentences
- **Examples are mandatory** for any command or API endpoint listed
- **Planned features** are clearly marked `(planned — not yet implemented)`
