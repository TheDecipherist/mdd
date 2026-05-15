## IMPORT SPEC MODE — `/mdd import-spec`

Triggered when arguments start with `import-spec`.

Reads one or more large spec or prompt documents — the kind produced by extended brainstorming sessions with Claude — and converts them into properly structured MDD initiatives, waves, and feature docs. Every decision in the spec is preserved. Duplicate or overlapping topics are merged intelligently. Features are numbered and waved in **build dependency order**, not spec-reading order.

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

If multiple files are provided, merge all content into a single working document after all files are fully read. Tag each section internally with its source filename (e.g. `<!-- source: spec.md -->`) for traceability — these tags are used in the merge summary and content mapping display but are never written to output docs.

---

### Phase IS2 — Feature Extraction, Classification + Path Grouping

This phase runs in four steps. Build-order classification (IS2c) always precedes structure determination (IS2d) because the correct numbering depends on understanding what you build vs. what you reference.

#### Step IS2a — Extract features

Read the entire merged working document. Identify every distinct feature, system, subsystem, or bounded capability described. A "feature" is any topic that could become a standalone MDD doc — something with a purpose, decisions, constraints, and a clear scope.

For each identified feature, capture:
- Name / title
- Core purpose — full description, as detailed as needed. Do NOT artificially limit this to a sentence count. Capture everything the spec says about what this feature is and does.
- All key decisions, constraints, business rules, edge cases, and design rationale mentioned anywhere in the spec for this feature
- AST types, data structures, config schemas, error formats, and TypeScript interfaces if described
- Dependencies on other features identified in the same spec

Track which spec sections contribute to each feature. When multiple spec sections cover the same concept (same feature re-discussed with refinements), **merge them** — do not create duplicate docs. When versions of the same decision conflict, keep the most specific or most recent version and note the discarded variant.

**Changelog and review-pass sections** (sections titled "v1.0 Review", "Changelog", "Decision Log", or similar retrospective formats) are not features — they are design decision records. For each decision in such a section, identify which feature it belongs to and add it to that feature's content. Do not create a standalone "Changelog" feature doc.

#### Step IS2b — Assign paths

Read all existing `.mdd/docs/*.md` `path` fields (if any exist) to learn the project's established vocabulary and casing conventions.

For each identified feature, determine its `path` value:
- Use the user's product vocabulary, not code module names
- Title Case, 1–3 levels, `/`-separated
- Siblings must use identical parent spelling (if `Auth/Login` exists, new auth docs use `Auth`, not `Authentication`)

#### Step IS2c — Build-order classification

This is the most important step. Features are numbered in the order a developer would actually build them — not the order they appear in the spec.

**Classify every feature as one of two types:**

**COMPONENT** — Something that results in code: a module, class, package, service, server, or runtime. The thing you sit down and write. Examples: Parser, Template Engine, Renderer, MCP Server, CLI.

**SPEC** — Something that describes behaviour a COMPONENT must implement: a directive definition, an API contract, a security rule, a caching rule, a language feature. You consult a SPEC doc while building the COMPONENT that implements it. Examples: `@include` directive spec, Security Config spec, Cache Modes spec.

**Order COMPONENT features by build dependency:**

Start from the foundation (the component everything else depends on) and work outward. Ask: "What must exist before I can build this?" The component with no dependencies comes first. The component that depends on everything comes last.

Example for a language toolchain:
```
Parser         — foundation, no deps, must exist first
Stripper       — depends on Parser AST
Renderer       — depends on Parser AST, no connection deps
Template Engine — depends on Parser + Renderer
MCP Server     — depends on Template Engine
Hook           — depends on MCP Server
CLI            — depends on all of the above
```

**Assign SPEC features to waves:** A SPEC feature belongs in the wave of the COMPONENT that implements it. The SPEC doc gets created alongside its implementing COMPONENT's wave so that both exist when building begins. The COMPONENT doc lists SPEC docs in its `depends_on`.

**Determine wave breakdown:** Group COMPONENTs (and their associated SPECs) into waves by build phase. Each wave should have a clear demo-state — a thing you can actually demonstrate when the wave is done.

Example wave structure for a language toolchain:
```
Wave 1 — Foundation:    Parser + all language directive SPECs
Wave 2 — Static Output: Stripper + Renderer
Wave 3 — Engine:        Template Engine + Caching SPECs
Wave 4 — Live Data:     MCP Server + Hook + Security SPECs
Wave 5 — CLI:           CLI + Distribution
```

**If no COMPONENT/SPEC distinction applies** (e.g. a feature-extension spec for an existing product), order features by: user-facing value first, infrastructure last. Earlier features should be shippable without later features.

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

---

### Phase IS4 — Write Files

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

For each feature in the approved plan, in wave order:

1. Auto-number continuing from the highest existing doc number in `.mdd/docs/`
2. Write `.mdd/docs/<NN>-<slug>.md`:

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

## Purpose

<Full description of what this feature is and does. Include the core design rationale — the "why" behind the decisions. Do not limit this to a sentence count. If the spec says a lot about this feature, capture it all here. A developer reading only this doc should fully understand what they are building.>

## Architecture

<How this feature fits into the system. For a COMPONENT: describe its responsibilities, inputs, outputs, and what it must never do. For a SPEC: describe the behaviour contract the implementing COMPONENT must satisfy. Include TypeScript interfaces, AST node types, and data structures if the spec defines them.>

## Data Model

<Data structures, schemas, config formats described in the spec. Include the exact field names, types, and constraints. Omit section only if the spec truly defines no data structures for this feature.>

## API / Interface

<Public interface this feature exposes: function signatures, tool names, command syntax, config keys. Omit if not applicable.>

## Business Rules

<Every decision, constraint, validation rule, edge case, error behaviour, and "never do X" described in the spec for this feature. This section should be exhaustive — if it is in the spec, it is here. Use bullet points or numbered lists for clarity.>

## Dependencies

<Other feature docs this one requires. List by ID and title. For SPECs, name the COMPONENT that implements this spec.>

## Known Issues

(none — imported from spec)
```

3. Tags: 4–8 domain-concept keywords. NOT file paths or spec section names.
4. `depends_on`: populate from the build order analysis. COMPONENT docs list the SPEC docs they implement. SPEC docs list other SPECs they depend on (e.g. the expression system spec is depended on by the filter spec).

**Progress report as you write:**
```
Writing files...
  ✅ CLAUDE.md
  ✅ initiatives/markdownai.md
  ✅ waves/markdownai-wave-1.md  (Wave 1 — Foundation)
  ✅ waves/markdownai-wave-2.md  (Wave 2 — Static Pipeline)
  ...
  ✅ docs/01-<slug>.md   [COMPONENT]  <path>
  ✅ docs/02-<slug>.md   [SPEC]       <path>
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

Next steps:
  /mdd plan-execute <slug>-wave-1   — start building Wave 1
  /mdd audit                        — run a full audit across all imported docs
  /mdd <NN>                         — jump directly to any feature doc
```
