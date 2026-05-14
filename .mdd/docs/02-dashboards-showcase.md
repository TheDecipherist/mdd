---
id: 02-dashboards-showcase
title: Dashboards Showcase — mdd-tui & mdd-dashboard
edition: MDD
depends_on: [01-docs-site]
source_files:
  - README.md
  - docs/index.html
  - docs/user-guide.html
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-07
status: complete
phase: all
mdd_version: 8
tags: [dashboard, tui, showcase, mdd-tui, mdd-dashboard, ui, terminal]
known_issues: []
---

# 02 — Dashboards Showcase — mdd-tui & mdd-dashboard

## Purpose

Add a dedicated "Dashboards" section to README.md and the docs site that showcases both mdd-tui (terminal interface) and mdd-dashboard (browser-based visual dashboard). The section clearly distinguishes which tool is production-ready and which is in active development, and notes that both will soon merge directly into the mdd repo so they are available via the `mdd` npm command.

## Architecture

This is a pure content addition — no source code, no build step, no API. The change touches three files:

- **README.md** — new `## Dashboards` section inserted before the existing `## Companion Tools` section
- **docs/index.html** — new `<section id="dashboards">` block added before the existing `#tools` section, plus nav link and footer link updates
- **docs/user-guide.html** — new dedicated section covering both tools, their install commands, key features, and the upcoming merge roadmap

The existing "Companion Tools" section keeps its mdd-tui card but is not the primary showcase. The new "Dashboards" section is the prominent home for both tools.

## Data Model

n/a — static content only.

## API Endpoints

n/a — static HTML/Markdown.

## Business Rules

1. **mdd-dashboard status** — must be described as "in active development" and "not yet fully operational" to set correct user expectations.
2. **Merge roadmap** — both packages (mdd-tui and mdd-dashboard) will soon be merged directly into the mdd repo so dashboards are available directly from the `mdd` npm command. This must be prominently stated.
3. **Separation** — the two tools must each have their own named subsection/card, not be lumped together in a single paragraph.
4. **Install commands** — each tool's install command must be shown so users can try them today without waiting for the merge.
5. **No broken promises** — mdd-dashboard section must not claim full functionality; it should encourage early adopters while being honest about WIP status.

## Data Flow

Greenfield — no existing computed values are consumed or transformed. All content is authored directly.

## Dependencies

- **01-docs-site** — the docs site and README structure this feature extends must exist first.

## Known Issues

(none)
