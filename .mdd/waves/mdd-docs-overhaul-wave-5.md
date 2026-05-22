---
id: mdd-docs-overhaul-wave-5
title: "Wave 5: Migration and Bootstrap Wiring"
initiative: mdd-docs-overhaul
initiative_version: 2
status: complete
depends_on: mdd-docs-overhaul-wave-4
demo_state: "Old docs archived, new docs are the source of truth, bootstrap auto-creates 00-frontmatter-spec.md on first run, no doc-generating phase uses embedded frontmatter templates"
created: 2026-05-21
hash: 28ba5f1e
---

# Wave 5: Migration and Bootstrap Wiring

## Demo-State
Old docs archived, new docs are the source of truth, bootstrap auto-creates `00-frontmatter-spec.md`
on first run, no doc-generating phase uses embedded frontmatter templates.
*(This wave is not complete until this can be manually demonstrated.)*

## Features
| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | archive-existing-docs | .mdd/docs/archive/ | complete | - |
| 2 | wire-frontmatter-spec-bootstrap | commands/mdd.md | complete | archive-existing-docs |
| 3 | update-doc-generating-phases | commands/mdd-build.md, mdd-lifecycle.md, mdd-import-spec.md | complete | wire-frontmatter-spec-bootstrap |

## Open Research
(none)
