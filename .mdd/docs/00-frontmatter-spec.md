---
id: 00-frontmatter-spec
title: Frontmatter Spec - Canonical Schema Reference
edition: MDD
depends_on: []
relates: []
source_files:
  - commands/mdd-build.md
  - commands/mdd-plan.md
  - commands/mdd-ops.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [frontmatter, schema, spec, canonical, reference, fields, meta]
path: Meta/Schema
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 00 - Frontmatter Spec - Canonical Schema Reference

## Purpose

Single source of truth for all MDD YAML frontmatter fields across every doc type. When any
command file generates a new doc, it reads this file and copies the relevant template rather
than using an embedded copy. Eliminates field-name drift across the codebase.

## Feature Doc Schema

Template for `.mdd/docs/NN-slug.md`:

```yaml
---
id: NN-slug
title: Feature Title
edition: MDD | Both | <project name>
depends_on: []          # feature doc IDs this feature requires to exist first
relates: []             # feature doc IDs to check when working on this doc (co-change hint)
source_files:
  - path/to/file.ts
routes: []              # API routes, e.g. "POST /api/v1/resource"
models: []              # DB model/collection names
test_files: []          # test file paths
data_flow: greenfield   # or path to .mdd/audits/flow-<slug>-<date>.md
last_synced: YYYY-MM-DD
status: draft           # draft | in_progress | complete | deprecated
phase: documentation    # documentation | all | or named phase (e.g. "Phase 3")
mdd_version: 11         # integer from commands/mdd.md frontmatter mdd_version field
tags: []                # 4-8 lowercase keywords: domain concepts, tech, feature names
path: Category/Section  # navigation path, Title Case, 1-3 segments
integration_contracts: []   # contracts this feature exposes to dependents
satisfies_contracts: []     # contracts this feature owes to its dependencies (see below)
security_read_sites: []     # file:line entries where user-supplied paths are read
known_issues: []            # populated by /mdd audit; one string per issue
---
```

### satisfies_contracts entry format

```yaml
satisfies_contracts:
  - from: dependent-feature-id      # which feature doc owns the contract
    function: functionName(arg)     # the exact call signature required
    when: "before any X operation"  # condition under which the call is mandatory
    status: pending                 # pending | done
    verified_at: ""                 # "path/to/file.ts:42" when status is done
```

Both `status: done` AND `verified_at: "file:line"` must be set together. Never use
`verified: <value>` — that field does not exist.

### status values

| Value | Meaning |
|-------|---------|
| `draft` | Feature doc written, no implementation yet |
| `in_progress` | Implementation underway |
| `complete` | All phases done, source files verified on disk |
| `deprecated` | Feature removed or replaced; doc kept for history |

### phase values

| Value | Meaning |
|-------|---------|
| `documentation` | Only Phase 3 complete |
| `Phase 4` | Test skeletons written |
| `Phase 5` | Build plan confirmed |
| `Phase 6` | Implementation complete |
| `all` | All phases complete (same as complete status) |

---

## Ops Doc Schema

Template for `.mdd/ops/slug.md`:

```yaml
---
id: slug
title: Runbook Title
type: ops
platform: npm | docker | github | vercel | ssh
environments: [production]      # or: [production, staging]
deployment_strategy:
  order: sequential             # sequential | parallel
  gate: manual                  # manual | auto
  on_gate_failure: stop         # stop | rollback | continue
  rollback_on_failure: false    # true | false
regions: []                     # e.g. [us-east-1] or []
services:
  - slug: service-name
    image: registry/image:tag   # or ~ if not docker
    port: 3000                  # or ~ if not applicable
    health_check: /health       # URL path or CLI command
    regions: []                 # or {} if not applicable
status: active                  # active | draft | deprecated
last_synced: YYYY-MM-DD
mdd_version: 11
tags: []
known_issues: []
---
```

---

## Initiative Doc Schema

Template for `.mdd/initiatives/slug.md`:

```yaml
---
id: slug
title: Initiative Title
status: active                  # active | complete | cancelled
version: 1                      # integer, incremented on each manual edit + plan-sync
hash: xxxxxxxx                  # 8-char sha256 of file content excluding the hash line
created: YYYY-MM-DD
---
```

---

## Wave Doc Schema

Template for `.mdd/waves/initiative-slug-wave-N.md`:

```yaml
---
id: initiative-slug-wave-N
title: "Wave N: Wave Title"
initiative: initiative-slug
initiative_version: 1           # must match current version in initiative doc
status: planned                 # planned | active | complete | archived
depends_on: none                # none | wave slug of the wave that must complete first
demo_state: "what the user can DO when this wave is done"
created: YYYY-MM-DD
hash: xxxxxxxx                  # 8-char sha256 of file content excluding the hash line
---
```

---

## Field Rules

- `id` — never change after first write; it is referenced by `depends_on` and `relates` in other docs
- `relates` — symmetric co-change hint only; not a prerequisite; list docs you would naturally check when editing this one
- `depends_on` — directional prerequisite; the listed docs must exist and be complete before this feature is built
- `mdd_version` — read from the `mdd_version:` field in the frontmatter of `commands/mdd.md`
- `last_synced` — always set to today when writing or updating a doc; SCAN mode uses this to detect drift
- `hash` — computed as `sha256(file_content_excluding_hash_line) | cut -c1-8`; always recompute after any edit
- `tags` — use domain concepts and system names, never file paths; 4-8 entries; all lowercase

## Architecture

Every command file that generates a new doc (`mdd-build.md` Phase 3, `mdd-lifecycle.md` reverse-engineer,
`mdd-import-spec.md` IS4, `mdd-plan.md` wave creation) MUST read this file first and copy the
relevant template block rather than using an embedded template. This file is the only place where
frontmatter templates live.

The MDD bootstrap (Step 0a in `commands/mdd.md`) auto-creates this file on first run in any project
that does not already have it. When auto-creating, bootstrap copies the canonical content from the
installed version in `$MDD_DIR/`.

## Data Flow

Greenfield — this doc defines the schema; it is not derived from external data flows.

## Dependencies

None. This is the root reference document.

## Security

Not applicable — this doc contains no sensitive data and executes no code.

## Known Issues

(none)

## Bugs

(none yet - populated by /mdd bug when issues are reported)
