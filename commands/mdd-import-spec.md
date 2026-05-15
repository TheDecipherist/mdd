## IMPORT SPEC MODE — `/mdd import-spec`

Triggered when arguments start with `import-spec`.

Reads one or more large spec or prompt documents — the kind produced by extended brainstorming sessions with Claude — and converts them into properly structured MDD feature docs. Every decision in the spec is preserved. Duplicate or overlapping topics are merged intelligently. Path grouping determines whether to create initiative/waves or flat docs.

---

### Phase IS1 — Read Spec Files

Parse file path(s) from the arguments following `import-spec`. Multiple files may be space-separated or specified as a glob.

For each file path:
1. Verify the file exists. If a path does not exist, stop and report clearly: "File not found: `<path>`"
2. Count the file's lines: `wc -l <path>`
3. Read the full content using the strategy below.

**Reading strategy — always read the full file, never stop early:**

Files under 2,000 lines: read in a single call.

Files over 2,000 lines: read in sequential chunks of 2,000 lines each.

```
chunk 1: offset 0,    limit 2000
chunk 2: offset 2000, limit 2000
chunk 3: offset 4000, limit 2000
... continue until offset >= total line count
```

After each chunk, append its headings and content to a running working document. Do not begin IS2 analysis until the final chunk has been read and the full working document is assembled. Report progress as you read:

```
Reading <filename> (<N> lines)...
  chunk 1/N  (lines 1–2000)   ✓
  chunk 2/N  (lines 2001–4000) ✓
  ...
  chunk N/N  (lines <X>–<end>) ✓
Full file read. Proceeding to feature extraction.
```

If multiple files are provided, merge all content into a single working document after all files are fully read. Tag each section internally with its source filename (e.g. `<!-- source: rawpg-prompt-driver.md -->`) for traceability — these tags are used in the merge summary and content mapping display but are never written to output docs.

---

### Phase IS2 — Feature Extraction + Path Grouping

This phase runs in two steps. Path grouping always runs before complexity determination because the number of distinct top-level path areas is the primary signal for initiative-scale scope.

#### Step IS2a — Extract features

Read the entire merged spec. Identify every distinct feature, system, subsystem, or bounded capability described. A "feature" is any topic that could become a standalone MDD doc — something with a purpose, decisions, constraints, and a clear scope.

For each identified feature:
- Name / title
- Core purpose (1–2 sentences distilled from the spec)
- All key decisions, constraints, business rules, and edge cases mentioned in the spec
- Dependencies on other features identified in the same spec

Track which spec sections contribute to each feature. When multiple spec sections cover the same concept (same feature re-discussed with refinements), **merge them** — do not create duplicate docs. When versions of the same decision conflict, keep the most specific or most recent version and note the discarded variant.

#### Step IS2b — Assign paths

Read all existing `.mdd/docs/*.md` `path` fields (if any exist) to learn the project's established vocabulary and casing conventions.

For each identified feature, determine its `path` value:
- Use the user's product vocabulary, not code module names
- Title Case, 1–3 levels, `/`-separated
- Siblings must use identical parent spelling (if `Auth/Login` exists, new auth docs use `Auth`, not `Authentication`)

#### Step IS2c — Determine output structure

Count distinct root-level path segments (top-level areas):

| Signal | Structure |
|--------|-----------|
| 3+ distinct root areas AND 8+ features | Initiative + Waves + Feature docs |
| 1–2 root areas AND 4–7 features | Waves + Feature docs (no initiative wrapper) |
| Any root area count AND 1–3 features | Flat feature docs only |

These thresholds are guidelines — apply judgment. A 3-feature spec spanning radically different domains can still warrant waves.

---

### Phase IS3 — Dry-Run Preview (mandatory gate)

Before writing any files, display the complete proposed structure and wait for explicit user approval.

```
📋 Import Spec — Dry Run

Source: <filename(s)>
Features identified: <N>   Merged: <N> duplicate/overlapping topics

Proposed structure: <Flat docs | Waves | Initiative: "<name>" → Waves>

Path Tree:
  <Root Area 1>
    ├── <Section>              → <NN>-<slug>    (draft)
    └── <Section>
         └── <Sub-section>    → <NN>-<slug>    (draft)
  <Root Area 2>
    └── <Section>              → <NN>-<slug>    (draft)

IDs assigned: <NN>–<NN> (continuing from existing <prev>)

Merge summary:
  "<path>" ← merged from: §<Spec Section A>, §<Spec Section B>
  (one line per merged feature — omit if no merges)

Content mapping:
  <NN>-<slug>:   §<Spec Section> + §<Spec Section>
  <NN>-<slug>:   §<Spec Section>

Adjust paths, titles, or grouping? (approve / adjust / abort)
```

**If the user says "adjust":** accept their description of changes, re-run IS2 with that feedback applied, then show the preview again. Repeat until the user approves.

**If the user says "abort":** stop. Write nothing.

**Do not proceed to IS4 until the user explicitly approves.**

---

### Phase IS4 — Write Files

**If initiative-scale was detected:** Create `.mdd/initiative.md` with:
- `id`, `title`, `status: planning`, `created: <today>`
- A brief initiative description derived from the spec's overall theme
- Wave breakdown: one wave per major root path area or logical phase, each listing its feature doc slugs

**For each feature doc in the approved plan:**

1. Auto-number continuing from the highest existing doc number in `.mdd/docs/`
2. Write a complete MDD feature doc at `.mdd/docs/<NN>-<slug>.md` using the canonical frontmatter structure:

```markdown
---
id: <NN>-<slug>
title: <Feature Title>
edition: <project name or "Both">
depends_on: [<IDs of other imported features this one depends on>]
source_files: []
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: <today YYYY-MM-DD>
status: draft
phase: documentation
mdd_version: <read from mdd.md frontmatter>
tags: [<4–8 domain-concept keywords>]
path: <Area/Section>
known_issues: []
---

# <NN> — <Feature Title>

## Purpose

<2–3 sentences from the merged spec content>

## Architecture

<How this feature fits into the system, derived from spec decisions>

## Data Model

<If the spec describes data structures — omit section if truly not applicable>

## API Endpoints

<If the spec describes endpoints — omit section if truly not applicable>

## Business Rules

<All decisions, constraints, validation rules, edge cases from the spec>

## Dependencies

<Other features this one requires, by doc ID>

## Known Issues

(none — imported from spec)
```

3. Tags: 4–8 domain-concept keywords. NOT file paths or spec section names.
4. `depends_on`: if feature A was described in the spec as depending on feature B (also imported), use the IDs assigned in this run.

**Progress report as you write:**
```
Writing docs...
  ✅ <NN>-<slug>.md   (<path>)
  ✅ <NN>-<slug>.md   (<path>)
  ...
```

---

### Phase IS5 — Rebuild .startup.md

Trigger the `.mdd/.startup.md` rebuild:
- Rebuild the auto-generated zone (Project Snapshot, Features Documented list with IDs, status, and tags)
- Preserve the Notes zone exactly as-is
- Update the generated date and current branch

Then regenerate connections.md:

**Regenerate `.mdd/connections.md`:**
Read all `.mdd/docs/*.md` (excluding `archive/`) — frontmatter only (id, title, status, path, depends_on, source_files). Never read doc bodies. Then:
- **Path tree:** sort docs by path alphabetically, then by id within the same path. Render as indented tree using `├──` / `└──` characters. Each leaf: `<path-leaf-segment>  <id>  <status>`.
- **Mermaid graph:** one node per doc (short node ID), one `-->` edge per `depends_on` entry, `:::<status>` suffix on each node. Include `classDef complete fill:#00e5cc,color:#000`, `in_progress fill:#ffaa00,color:#000`, `draft fill:#888,color:#fff`, `deprecated fill:#555,color:#aaa`.
- **Source overlap:** build map of source_file → docs that reference it. Include only files with 2+ docs.
- **Warnings:** broken `depends_on` refs (target doesn't exist), circular dependencies, docs missing `path`.
- **Write** `.mdd/connections.md` with YAML frontmatter (`generated: <today>`, `doc_count: <N>`, `connection_count: <N>`, `overlap_count: <N>`) and four sections: Path Tree, Dependency Graph (Mermaid), Source File Overlap, Warnings.

Then report:

```
✅ Import Spec Complete

Source:    <filename(s)>
Created:   <N> feature docs
Structure: <Flat | Waves | Initiative + Waves>

Docs created:
  <NN>-<slug>   <path>   draft
  <NN>-<slug>   <path>   draft
  ...

Startup:   .mdd/.startup.md rebuilt
Connections: .mdd/connections.md updated

Next steps:
  /mdd <NN>         — start building any imported feature
  /mdd audit        — run a full audit across all imported docs
  /mdd upgrade      — add path fields to any pre-existing docs that are missing them
  /mdd rebuild-tags — regenerate tags if any look thin
```
