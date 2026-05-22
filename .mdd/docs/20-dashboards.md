---
id: 20-dashboards
title: Companion Dashboards - mdd-tui and mdd-dashboard
edition: MDD
depends_on: [01-mdd]
relates: [15-mdd-documentation]
source_files: []
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [dashboards, mdd-tui, mdd-dashboard, terminal-ui, browser-dashboard, d3, connections-graph, companion-tools]
path: Companion Tools
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
sister_projects:
  - ~/projects/mdd-tui
  - ~/projects/mdd-dashboard
---

# 20 - Companion Dashboards - mdd-tui and mdd-dashboard

## Purpose

MDD ships two standalone companion packages for exploring `.mdd/` workspaces:
`mdd-tui` (terminal dashboard) and `mdd-dashboard` (browser-based visual dashboard).
Both are separate npm packages today and are planned to be merged into the `mdd`
CLI so they can be launched directly without a separate install.

## Architecture

```
mdd-tui         Terminal dashboard — npm install -g mdd-tui
mdd-dashboard   Browser dashboard — npm install -g mdd-dashboard
```

Both are standalone packages maintained in separate repositories under the
`TheDecipherist` GitHub org. Neither is included in the `@thedecipherist/mdd` package
currently.

### mdd-tui

A terminal UI (TUI) for browsing `.mdd/` workspaces. Run from the project root:

```bash
npm install -g mdd-tui
mdd-tui
```

Displays: feature docs, audit reports, connections graph, ops runbooks. Terminal-native,
no browser required. Works with any MDD project by reading the `.mdd/` directory
structure.

### mdd-dashboard

A browser-based visual dashboard that renders the feature dependency graph as an
interactive D3 diagram. Run from the project root:

```bash
npm install -g mdd-dashboard
mdd-dashboard
# MDD Dashboard running at http://localhost:7321
```

Features: interactive D3 dependency graph, live reload on file changes, git-aware
filtering. Status: in active development, not yet fully operational. Early adopters
can install but should expect rough edges.

### Planned Integration

Both dashboards are planned for direct integration into the `mdd` CLI package. Once
merged, they will be launchable via `mdd tui` and `mdd dashboard` (or similar) without
a separate global install.

## Business Rules

- Both dashboards read the `.mdd/` directory structure - they require an MDD project
- `mdd-dashboard` is explicitly marked as early-access: "not yet fully operational"
- The `path` frontmatter field in feature docs is the primary grouping signal used by
  both dashboards to organize docs into a tree view
- `.mdd/connections.md` provides the pre-computed relationship graph that dashboards
  read for instant access to the dependency structure without parsing all docs

## Data Flow

Reads: `.mdd/docs/*.md`, `.mdd/audits/`, `.mdd/ops/*.md`, `.mdd/connections.md`.
Writes: nothing (read-only tools).

## Dependencies

Both tools depend on the `.mdd/` directory structure created by `01-mdd` bootstrap.
`mdd-dashboard` specifically depends on `.mdd/connections.md` (maintained by connect
mode in `11-manage.md`) for the D3 graph data.

## Security

Not applicable - reads local project files; no network access, no external APIs.

## Known Issues

- `mdd-dashboard` is in active development and not fully operational. The README
  explicitly warns of rough edges.
- Neither dashboard is included in the `@thedecipherist/mdd` package - they require
  separate global installs. Until the planned merge is done, a new MDD user will not
  discover these tools unless they read the README Dashboards section.
- No version coordination between `mdd`, `mdd-tui`, and `mdd-dashboard`. If the
  `.mdd/` schema changes (new frontmatter fields, new file formats), the dashboards
  may silently show stale or incorrect data without any version compatibility check.
- The planned CLI integration (`mdd tui`, `mdd dashboard`) has no timeline and is
  noted as "coming soon" in the README without a target version.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
