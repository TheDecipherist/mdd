---
id: 14-built-with-mdd
title: Projects Built with MDD - Docs Site Section
edition: MDD
depends_on: [01-docs-site]
source_files:
  - docs/index.html
  - docs/styles.css
  - docs/specs/markdownai-spec-v1.0.md
  - docs/specs/strictdb-complete-plan.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 8
tags: [documentation, docs-site, projects-showcase, built-with-mdd, examples, landing-page]
path: Tooling/Docs Site
integration_contracts: []
satisfies_contracts: []
known_issues: []
security_read_sites: []
---

# 14 - Projects Built with MDD - Docs Site Section

## Purpose

Add a "Projects Built with MDD" section to `docs/index.html` that shows real-world examples of projects built using this exact workflow. The section covers the spec-import development method, the reasoning behind it, and a showcase of 11 projects built with MDD since March 2026. It also copies two spec documents (MarkdownAI and StrictDB) into `docs/specs/` so they can be linked directly from the page.

## Architecture

- New `<section id="built-with-mdd">` added to `docs/index.html` after the existing `#tools` section
- "Built with MDD" entry added to the Projects dropdown in the desktop nav
- Link added to the sidebar `#toc` nav and the mobile menu drawer
- Two spec markdown files copied to `docs/specs/`:
  - `markdownai-spec-v1.0.md` (from `~/projects/markdownai/MDs/markdownai-spec-v1.0.md`)
  - `strictdb-complete-plan.md` (from `~/projects/strictdb/plans/strictdb_complete_plan.md`)
- Existing `.feature-card` styles reused for project cards - no new CSS classes required

## Data Model

None - static HTML/CSS only.

## API Endpoints

None.

## Business Rules

- Source document: `MDs/projects-built-with-mdd.md`
- Section content covers: workflow description (spec-import method), recommended tools, and the 11-project showcase
- The `#built-with-mdd` section must appear in: sidebar TOC, mobile menu TOC, Projects dropdown
- Spec links in the source document (`/specs/markdownai-spec-v1_0.md`, `/specs/strictdb-complete-plan.md`) map to `specs/markdownai-spec-v1.0.md` and `specs/strictdb-complete-plan.md` in docs/
- GitHub repo links use `TheDecipherist` account - all 11 repos verified present
- npm package links (strictdb, classmcp, classpresso) use the package name directly
- Internal links referencing spec documents point to `specs/<filename>` relative path
- Em dashes are never used in markdown or HTML content (use hyphens or `&mdash;` entity only where already established in existing HTML)
- No AI writing patterns: no "leverage", "seamlessly", "robust", "comprehensive"

## Data Flow

Greenfield - new section with no existing code analyzed.

## Dependencies

- 01-docs-site: base HTML structure, styles, and app.js scrollspy

## Known Issues

(none)

## Bugs

(none yet)
