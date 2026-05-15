## IMPORT SPEC MODE — `/mdd import-spec`

Triggered when arguments start with `import-spec`.

Reads one or more large spec or prompt documents — the kind produced by extended brainstorming sessions with Claude — and converts them into properly structured MDD initiatives, waves, and feature docs. Every decision in the spec is preserved. Duplicate or overlapping topics are merged intelligently. Features are numbered and waved in **build dependency order**, not spec-reading order.

---

### Phase IS1 — Read Spec Files

**Stale job detection (runs first):** Check `.mdd/jobs/` for any existing `import-*/` folder.
- If found: read its `MANIFEST.md` and count written vs total files. Present to user:
  ```
  Found interrupted import job from <date>.
  MANIFEST shows <done>/<total> files written.
  Written: <list of [x] paths>
  Remaining: <list of [ ] paths>

    [R] Resume — skip already-written files, continue from where it left off
    [D] Discard — delete job, start the full import from scratch
  ```
  - **Resume:** skip IS1–IS3, go directly to IS4 writing only the `[ ]` entries. IS5 runs normally after.
  - **Discard:** delete the `import-<date>/` folder, proceed normally.
- If no stale job: proceed normally.

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

If multiple files are provided, merge all content into a single working document after all files are fully read. Tag each section internally with its source filename (e.g. `<!-- source: spec.md -->`) for traceability — these tags are used in the merge summary and content mapping display but are never written to output docs.

---

### Phase IS2 — Feature Extraction, Classification + Path Grouping

This phase runs in four steps. Build-order classification (IS2c) always precedes structure determination (IS2d) because the correct numbering depends on understanding what you build vs. what you reference.

#### Step IS2a — Extract features + record source line ranges

Read the entire merged working document. Identify every distinct feature, system, subsystem, or bounded capability described. A "feature" is any topic that could become a standalone MDD doc — something with a purpose, decisions, constraints, and a clear scope.

For each identified feature, record:
- Name / title
- **The exact line ranges in the source file(s) that cover this feature.** Record every range, including secondary ranges where the feature is discussed again (e.g. a directive mentioned in the syntax section AND in the security section AND in the changelog). Format: `lines 254–340, 2401–2450, 4725–4741`
- A brief extraction note: what types of content are in those ranges (e.g. "syntax section: options table, processing pipeline, scope model; security section: filesystem confinement rules; changelog: file resolution model decisions")
- Dependencies on other features identified in the same spec

This line-range map is used in IS4 to re-read the source before writing each doc. It is the most important output of IS2a. Do not skip or estimate ranges — check your chunk boundaries if unsure.

Track which spec sections contribute to each feature. When multiple spec sections cover the same concept (same feature re-discussed with refinements), **merge them** — do not create duplicate docs. Record all contributing ranges. When versions of the same decision conflict, keep the most specific or most recent version and note the discarded variant.

**Changelog and review-pass sections** (sections titled "v1.0 Review", "Changelog", "Decision Log", or similar retrospective formats) are not standalone features — they are design decision records. For each decision in such a section, identify which feature it belongs to and add its line range to that feature's source ranges. Do not create a standalone "Changelog" feature doc.

#### Step IS2b — Assign paths

Read all existing `.mdd/docs/*.md` `path` fields (if any exist) to learn the project's established vocabulary and casing conventions.

For each identified feature, determine its `path` value:
- Use the user's product vocabulary, not code module names
- Title Case, 1–3 levels, `/`-separated
- Siblings must use identical parent spelling (if `Auth/Login` exists, new auth docs use `Auth`, not `Authentication`)

#### Step IS2c — Project type detection + wave ordering

This is the most important step. Features are numbered in the order a developer would actually build them — not the order they appear in the spec. The correct order depends entirely on what type of project is being built.

**Step 1 — Detect project type from the spec.**

Read the spec for these signals:

| Project type | Signals |
|---|---|
| **Language / Toolchain** | Has a Parser, AST, or grammar section. Describes directives, syntax, or a runtime. Has a CLI section. Describes an interpreter, compiler, or processing pipeline. |
| **Web API / Backend** | Describes endpoints, routes, REST, or GraphQL. Has auth/authorization sections. Describes DB models and migrations. |
| **Frontend / UI App** | Describes components, pages, or routing. Describes user interactions, forms, and layouts. Has a state management section. |
| **Library / SDK** | Describes a public API surface with exported types. Has integration or plugin sections. No server or UI sections. |
| **Extension / Plugin** | Spec is adding features to an existing product. Most features assume a host system already exists. |

If signals from multiple types appear, pick the dominant one and note the mix.

**Step 2 — Apply the wave ordering template for the detected type.**

**Language / Toolchain:**
```
Wave 1 — Infrastructure Skeleton
  Goal: a working program that can accept input and produce output, even if incomplete.
  Build: Parser + AST types + core shared types + minimal CLI entry point
  Demo-state: "can parse a source file and print the AST to stdout"

Wave 2 — First Shippable Artifact
  Goal: the first thing an end user can actually use.
  Build: Stripper / Renderer / Compiler — whatever produces the first real output
  Demo-state: "can take a source file and produce correct output for the simplest case"

Wave 3 — Language Features
  Goal: full language coverage. All directives, all syntax, all semantics.
  Build: SPEC docs for every language feature + the Template Engine / Resolver that implements them
  Demo-state: "all static features work correctly end to end"

Wave 4 — Dynamic / Live Features
  Goal: features that require external connections (DB, HTTP, shell, AI client).
  Build: MCP Server, Hook, live directive execution
  Demo-state: "live data directives execute and return real results"

Wave 5 — Security, Hardening, Extras
  Goal: production-safe. Sandboxed execution, audit logging, edge case handling.
  Build: Security system, caching, graceful degradation
  Demo-state: "untrusted documents are safe to run; audit log captures all executions"

Wave 6 — CLI, Distribution, Packaging
  Goal: installable and usable by someone who has never seen the codebase.
  Build: Full CLI, npm package, CI integration, documentation
  Demo-state: "npm install -g, run against a real file, get correct output"
```

**Web API / Backend:**
```
Wave 1 — Project scaffold + DB + core models
  Demo-state: "server starts, DB connects, migrations run"

Wave 2 — Auth
  Demo-state: "can register, login, receive a JWT, access a protected route"

Wave 3 — Core endpoints
  Demo-state: "core CRUD for the main resource works end to end"

Wave 4 — Business logic features
  Demo-state: "main product workflow works end to end"

Wave 5 — Integrations, webhooks, external APIs
  Demo-state: "third-party integrations work in staging"

Wave 6 — Admin, analytics, hardening
  Demo-state: "production-ready: rate limiting, logging, admin panel live"
```

**Frontend / UI App:**
```
Wave 1 — Routing + layout shell
  Demo-state: "app loads, all routes navigate without error"

Wave 2 — Auth + core state
  Demo-state: "can log in and see the main dashboard"

Wave 3 — Core features
  Demo-state: "primary user workflow works end to end"

Wave 4 — Secondary features + integrations
  Demo-state: "all documented features work"

Wave 5 — Polish, performance, accessibility
  Demo-state: "passes lighthouse audit, all a11y checks green"
```

**Library / SDK:**
```
Wave 1 — Core types + core algorithm
  Demo-state: "library installs, core function produces correct output"

Wave 2 — Full public API
  Demo-state: "all documented methods work, test suite passes"

Wave 3 — Extensions, plugins, advanced options
  Demo-state: "extension points work, plugin example runs"

Wave 4 — Distribution, docs, examples
  Demo-state: "published to registry, README example runs from a fresh install"
```

**Extension / Plugin:**
```
Order by user-facing value — the most impactful feature first. Each wave should be independently usable without later waves. Infrastructure last.
```

**Step 3 — Classify every feature.**

With the wave structure determined, classify each feature:

**COMPONENT** — results in code files: a module, class, package, service, server, or runtime. The thing you sit down and write.

**SPEC** — describes behaviour a COMPONENT must implement: a directive definition, an API contract, a security rule, a protocol. You consult a SPEC while building the COMPONENT. SPEC docs belong in the same wave as their implementing COMPONENT.

**Step 4 — Assign features to waves.**

Place each feature in the wave where it logically gets built. Ask: "At which wave would a developer need this?" Not: "In which section does the spec describe it?"

SPEC docs and their implementing COMPONENT always go in the same wave. The COMPONENT `depends_on` the SPECs it implements.

#### Step IS2d — Determine output structure

Count distinct root-level path segments (top-level areas):

| Signal | Structure |
|--------|-----------|
| 3+ distinct root areas AND 8+ features | Initiative + Waves + Feature docs |
| 1–2 root areas AND 4–7 features | Waves + Feature docs (no initiative wrapper) |
| Any root area count AND 1–3 features | Flat feature docs only |

These thresholds are guidelines — apply judgment.

---

### Phase IS2.5 — CLAUDE.md Check

Before showing the dry-run preview, check the project's CLAUDE.md.

Run: `[ -f CLAUDE.md ] && wc -l CLAUDE.md || echo "missing"`

**If CLAUDE.md is missing or under 10 lines:**

Ask the user via AskUserQuestion:

> "This looks like a new project. Want me to create a CLAUDE.md with a description of what `<product name>` is, its architecture, and how the MDD docs map to the codebase? This gives Claude the context it needs to build from the docs correctly."

Options:
- **"Yes, create CLAUDE.md"** — proceed to draft it from the spec, include in IS4 write step
- **"No, skip"** — continue without creating CLAUDE.md

**If CLAUDE.md already exists and is substantial:** skip this check entirely.

**CLAUDE.md content to draft (if approved):**

Derive from the spec:

```markdown
# CLAUDE.md

## What This Project Is

<Product name> — <one paragraph elevator pitch. What does it do, who is it for, what problem does it solve. Write this in plain terms, not marketing language.>

## Core Philosophy

<The fundamental design principles that drive all decisions. Extract from the spec's philosophy/principles sections. These are the "why" behind architecture choices.>

## Architecture Overview

<The major components and how they relate. For a toolchain: list each component, one line description, what it depends on. For an API: list major subsystems. Make it concrete.>

## Tech Stack

<Language, frameworks, package manager, test runner — derive from spec if stated, leave blank if not.>

## What the MDD Docs Represent

This project uses MDD (Manual-Driven Development). The `.mdd/` directory contains:
- `.mdd/initiatives/` — the top-level initiative(s) defining the full scope
- `.mdd/waves/` — waves within each initiative, each with a concrete demo-state
- `.mdd/docs/` — individual feature docs, one per buildable unit or behavioural spec

**The docs are numbered in build dependency order.** `/mdd 01` is always the first thing to build. Read the wave file before starting a wave to understand what "done" looks like.

## Key Constraints

<Any hard rules derived from the spec: immutable rules, security constraints, "never do X", platform requirements. These are the lines that cannot be crossed.>
```

---

### Phase IS3 — Dry-Run Preview (mandatory gate)

Before writing any files, display the complete proposed structure and wait for explicit user approval.

```
📋 Import Spec — Dry Run

Source: <filename(s)>
Features identified: <N>   Merged: <N> duplicate/overlapping topics
CLAUDE.md: <"will be created" | "already exists, skipping" | "skipping (user declined)">

Proposed structure: Initiative "<name>" → <N> Waves → <N> Feature docs

Initiative: .mdd/initiatives/<slug>.md

Waves (in build order):
  Wave 1 — <name>   (.mdd/waves/<slug>-wave-1.md)
    Demo-state: <what you can demonstrate when this wave is done>
    Features:
      <NN> <slug>   [COMPONENT]   <path>
      <NN> <slug>   [SPEC]        <path>
  Wave 2 — <name>   (.mdd/waves/<slug>-wave-2.md)
    Demo-state: <demo-state>
    Features:
      <NN> <slug>   [COMPONENT]   <path>
      ...

IDs assigned: <NN>–<NN> (continuing from existing <prev>)

Merge summary:
  "<path>" ← merged from: §<Spec Section A>, §<Spec Section B>
  (one line per merged feature — omit if no merges)

Content mapping:
  <NN>-<slug>:   §<Spec Section> + §<Spec Section>
  <NN>-<slug>:   §<Spec Section>

Is the build order correct? Does each wave's demo-state make sense?
(approve / adjust / abort)
```

**If the user says "adjust":** accept their description of changes — reordering waves, reclassifying features, changing demo-states, renaming — re-run IS2 with that feedback applied, then show the preview again. Repeat until the user approves.

**If the user says "abort":** stop. Write nothing.

**Do not proceed to IS4 until the user explicitly approves.**

**After approval — create the job folder and MANIFEST before writing any file:**

Create `.mdd/jobs/import-<YYYY-MM-DD>/MANIFEST.md`:

```markdown
# Import Spec Job Manifest
# Job: import-<YYYY-MM-DD>
# Source: <filename(s)>
# Started: <ISO timestamp>
# Files: <N total>
# Status: IN PROGRESS
#
# States: [ ] pending  [~] writing  [x] written  [!] error

## Files to create
[ ] .mdd/initiatives/<slug>.md
[ ] .mdd/waves/<slug>-wave-1.md
[ ] .mdd/waves/<slug>-wave-2.md
[ ] .mdd/docs/01-<slug>.md
[ ] .mdd/docs/02-<slug>.md
...
```

List every file that will be written in the order it will be written. Nothing proceeds until this file exists on disk.

---

### Phase IS4 — Write Files

**First — ensure the MDD directory structure exists.** Run these before writing any file:

```bash
mkdir -p .mdd/initiatives
mkdir -p .mdd/waves
mkdir -p .mdd/docs
```

These are the exact directories MDD uses. Do not write initiative or wave files anywhere else. Full paths on disk:
- Initiatives: `.mdd/initiatives/<slug>.md`
- Waves: `.mdd/waves/<slug>-wave-N.md`
- Feature docs: `.mdd/docs/<NN>-<slug>.md`

Write in this order: CLAUDE.md (if approved) → initiative → waves → feature docs.

#### CLAUDE.md (if approved in IS2.5)

Write the drafted CLAUDE.md to the project root. Report: `✅ CLAUDE.md created`

#### Initiative file

Create `.mdd/initiatives/<slug>.md`:

```markdown
---
id: <slug>
title: <Full Initiative Title>
status: active
version: 1
hash:
created: <today YYYY-MM-DD>
---

# <Full Initiative Title>

## Overview

<Comprehensive description of what this initiative delivers. This should be 3-6 paragraphs:
- What the product/system is and what it does
- Why it exists and what problem it solves
- The core design philosophy and principles that drive all decisions
- The major components or areas being built
- What "done" looks like for the full initiative
Do NOT write "brief" — write enough that a developer reading only this file understands what they are building and why.>

## Open Product Questions
(none — imported from spec)

## Waves
| Wave | File | Demo-state | Status |
|------|------|------------|--------|
<one row per wave>
| Wave 1 | waves/<slug>-wave-1.md | <demo-state> | planned |
| Wave 2 | waves/<slug>-wave-2.md | <demo-state> | planned |
```

Compute and write the `hash:` field after writing (hash of file content excluding the hash line).

#### Wave files

For each wave, create `.mdd/waves/<slug>-wave-N.md`:

```markdown
---
id: <slug>-wave-N
title: "Wave N: <Wave Title>"
initiative: <initiative-slug>
initiative_version: 1
status: planned
depends_on: <none | slug of previous wave>
demo_state: "<concrete thing you can demonstrate when this wave is complete>"
created: <today YYYY-MM-DD>
hash:
---

# Wave N: <Wave Title>

## Demo-State

<demo-state>
*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Type | Status | Depends on |
|---|---------|-----|------|--------|------------|
| 1 | <slug> | docs/<NN>-<slug>.md | COMPONENT | planned | — |
| 2 | <slug> | docs/<NN>-<slug>.md | SPEC | planned | <dep or —> |

## Open Research

(none — imported from spec)
```

Compute and write the `hash:` field after writing.

#### Feature docs

**Critical framing — these are build instructions, not reference documentation.**

When a developer runs `/mdd NN`, Claude reads this doc and uses it to write code. That is the only reader that matters. Write every section as if answering the question: "What exactly do I build, and how do I know when it's done?" Not: "What does this feature do?" — a passive description is useless to a builder.

For each feature in the approved plan, in wave order:

1. Auto-number continuing from the highest existing doc number in `.mdd/docs/`

2. **Re-read the source before writing.** Look up the line ranges recorded for this feature in IS2a. Re-read each range from the original spec file now — do not write from the IS2a extraction summary alone. The summary identified what exists; the re-read provides the actual content. Use the same chunked read strategy as IS1 if a range is large.

   ```
   Re-reading source for <slug>...
     lines <X>–<Y>  (<section name>)  ✓
     lines <X>–<Y>  (<section name>)  ✓
   Writing doc...
   ```

3. **Run the completeness checklist against the freshly-read source before writing the doc.** For each item present in the source, it must appear in the doc:

   - [ ] Every options / parameters table — every row, every column, every default value
   - [ ] Every CLI subcommand and its flags (including rare/advanced flags)
   - [ ] Every config JSON structure — exact keys, types, nesting, defaults
   - [ ] Every TypeScript interface and type alias defined in the spec
   - [ ] Every AST node type and its fields
   - [ ] Every error message format and the exact condition that triggers it
   - [ ] Every behavioral table (evaluation tables, state tables, format tables, platform tables)
   - [ ] Every "always" / "never" / "must not" / "only valid when" rule
   - [ ] Every example that illustrates an edge case or non-obvious behaviour
   - [ ] Every named distinction where two similar things behave differently (e.g. `column` singular vs `columns` plural)

   If any item is present in the source but not yet captured in your notes, add it now before writing the doc. Do not skip this step.

4. Write `.mdd/docs/<NN>-<slug>.md`:

```markdown
---
id: <NN>-<slug>
title: <Feature Title>
type: <COMPONENT | SPEC>
initiative: <initiative-slug>
wave: <wave-slug>
wave_status: planned
edition: <project name or "Both">
depends_on: [<IDs of docs this one depends on>]
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

## What to Build

<Answer: "What exactly am I being asked to create?" For a COMPONENT: name the files/modules to create, what they take as input, what they produce as output, and what they must never do. For a SPEC: describe the exact behaviour contract the implementing COMPONENT must satisfy — what inputs it must accept, what output it must produce, what errors it must raise. Be concrete. "A parser that reads .md files" is too vague. "A parser that reads a .md source file and produces an array of ASTNode objects, one per directive" is correct.>

## Architecture

<How this feature fits into the system and what it depends on. For a COMPONENT: its place in the pipeline, what calls it, what it calls, what it must never reach into directly. For a SPEC: which COMPONENT implements this spec and how. Include TypeScript interfaces, AST node types, and data structures exactly as defined in the spec — copy them verbatim, do not paraphrase.>

## Implementation Notes

<Key decisions Claude must follow when implementing this feature. This is not boilerplate — write only what is non-obvious or constraining. Examples: "use a single-pass regex scanner, not a recursive descent parser"; "never buffer the full file in memory"; "the AST must be immutable after construction". If the spec gives explicit implementation guidance, it belongs here.>

## Data Model

<Data structures, schemas, config formats. Include exact field names, types, nesting, and defaults. Copy JSON examples from the spec verbatim. Omit only if the spec truly defines no data structures for this feature.>

## API / Interface

<The exact public interface this feature exposes. Function signatures, exported types, CLI commands and flags, config keys, MCP tool names. Every option, every flag, every subcommand — do not omit rare or advanced ones. A developer should be able to write the module's index.ts exports from this section alone.>

## Business Rules

<Every constraint, validation rule, edge case, error behaviour, platform difference, and "always/never/only valid when" rule from the spec. Exhaustive. If it is in the spec for this feature, it is here. Use a numbered or bulleted list. Include exact error message formats and the conditions that trigger them.>

## Acceptance Criteria

<How do you know this feature is done? Write concrete, verifiable statements. Each criterion should be something Claude can check with a test or a manual run. Examples: "mai strip input.md produces output with zero @ directives remaining"; "parsing a file with a circular @include chain throws CIRCULAR_REFERENCE_ERROR with the full chain in the message"; "all 11 content masking patterns fire correctly on the test fixtures".>

## Dependencies

<Other feature docs this one requires, by ID and title. For SPECs, state which COMPONENT implements this spec.>

## Known Issues

(none — imported from spec)
```

3. Tags: 4–8 domain-concept keywords. NOT file paths or spec section names.
4. `depends_on`: populate from the build order analysis. COMPONENT docs list the SPEC docs they implement. SPEC docs list other SPECs they depend on (e.g. the expression system spec is depended on by the filter spec).

**For every file written:** mark it `[~]` in MANIFEST before writing, then `[x]` immediately after. If writing fails, mark `[!]` with a one-line error note. This ensures the MANIFEST is always an accurate snapshot of what exists on disk — a resume after interruption will never re-write a file that was already successfully written.

**Progress report as you write:**
```
Writing files...
  ✅ CLAUDE.md
  ✅ .mdd/initiatives/<slug>.md
  ✅ .mdd/waves/<slug>-wave-1.md  (Wave 1 — <name>)
  ✅ .mdd/waves/<slug>-wave-2.md  (Wave 2 — <name>)
  ...
  ✅ .mdd/docs/01-<slug>.md   [COMPONENT]  <path>
  ✅ .mdd/docs/02-<slug>.md   [SPEC]       <path>
  ...
```

---

### Phase IS5 — Rebuild .startup.md + Connections

Rebuild `.mdd/.startup.md`:
- Rebuild the auto-generated zone (Project Snapshot, Features Documented list with IDs, status, and tags; Ops Runbooks)
- Add initiative and wave summary to the Features section: show initiative title, each wave with status, feature count
- Preserve the Notes zone exactly as-is
- Update the generated date and current branch

Then regenerate `.mdd/connections.md`:

Read all `.mdd/docs/*.md` (excluding `archive/`) — frontmatter only (id, title, type, status, path, depends_on, wave, source_files). Never read doc bodies. Then:
- **Path tree:** sort docs by path alphabetically, then by id within the same path. Render as indented tree using `├──` / `└──` characters. Each leaf: `<path-leaf-segment>  <id>  <type>  <status>`.
- **Mermaid graph:** one node per doc (short node ID), one `-->` edge per `depends_on` entry, `:::<status>` suffix on each node. Include `classDef complete fill:#00e5cc,color:#000`, `in_progress fill:#ffaa00,color:#000`, `draft fill:#888,color:#fff`, `deprecated fill:#555,color:#aaa`.
- **Source overlap:** build map of source_file → docs that reference it. Include only files with 2+ docs.
- **Warnings:** broken `depends_on` refs (target doesn't exist), circular dependencies, docs missing `path`.
- **Write** `.mdd/connections.md` with YAML frontmatter (`generated: <today>`, `doc_count: <N>`, `connection_count: <N>`, `overlap_count: <N>`) and four sections: Path Tree, Dependency Graph (Mermaid), Source File Overlap, Warnings.

**Clean up job folder:** Delete `.mdd/jobs/import-<date>/` entirely — the written files are the authoritative record.

Then report:

```
✅ Import Spec Complete

Source:      <filename(s)>
CLAUDE.md:   <created | skipped>
Initiative:  .mdd/initiatives/<slug>.md
Waves:       <N> wave files created
Docs:        <N> feature docs created  (<N> COMPONENT, <N> SPEC)

Structure:
  <initiative title>
    Wave 1 — <name>   (<N> features)
    Wave 2 — <name>   (<N> features)
    ...

Startup:     .mdd/.startup.md rebuilt
Connections: .mdd/connections.md updated
Job:         .mdd/jobs/import-<date>/ deleted

Next steps:
  /mdd plan-execute <slug>-wave-1   — start building Wave 1
  /mdd audit                        — run a full audit across all imported docs
  /mdd <NN>                         — jump directly to any feature doc
```
