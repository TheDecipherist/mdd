---
id: 15-mdd-documentation
title: MDD Documentation - README and docs/ Site
edition: MDD
depends_on: [01-mdd]
relates: [17-deploy]
source_files:
  - README.md
  - docs/index.html
  - docs/user-guide.html
  - docs/styles.css
  - docs/app.js
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [documentation, readme, docs-site, user-guide, landing-page, mddai-dev, github-pages, nginx]
path: Documentation
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 15 - MDD Documentation - README and docs/ Site

## Purpose

The MDD documentation lives in two places: `README.md` (npm/GitHub landing page) and
`docs/` (the mddai.dev website, served by Nginx in Docker). Both must stay in sync with
the command files. When any CLI flag, command, mode, or user-facing behavior changes,
all three documentation locations must be updated before the release commit.

## Architecture

```
README.md            npm/GitHub landing page - installation, all modes, examples
docs/index.html      mddai.dev landing page - feature overview, install snippet, badges
docs/user-guide.html Full mode reference - every mode, phase, flag, example
docs/styles.css      Site stylesheet
docs/app.js          Site JavaScript (nav, scroll, interactions)
```

The docs site is deployed as a Docker image (nginx:alpine). GitHub Pages at
`thedecipherist.github.io/mdd` redirects to `mddai.dev` via a client-side redirect
in `index.html`.

### README.md

Contains:
- Hero image and title
- Badge row (npm version, license, node version)
- Why MDD / How It Works introduction
- Full table of contents
- All-modes-at-a-glance table
- Per-mode examples and reference sections
- Feature doc format reference
- The `.mdd/` directory structure
- Dashboards section (mdd-tui, mdd-dashboard)
- Projects Built with MDD section

### docs/index.html

Landing page for mddai.dev. Contains:
- Rybbit analytics (site ID `f4d8e415d9cd`)
- GitHub Pages redirect script (fires when hostname is `thedecipherist.github.io`)
- SEO meta tags, Open Graph, Twitter card, Schema.org JSON-LD
- Nav with links to user-guide.html
- Install snippet and quick-start
- Mode cards

### docs/user-guide.html

Complete command reference. Contains sections for every mode: Build, Bug, Audit,
Status/Notes, Scan/Update, Lifecycle, Plan, Ops, Manual, Security Rules, Import Spec,
Framework, Manage. Also contains feature doc format reference and connections.md format.

## Business Rules

- Every change to CLI flags, commands, modes, or user-facing behavior must update
  all three files (`README.md`, `docs/index.html`, `docs/user-guide.html`) before
  the release commit
- The release runbook (`ops/release.md`) enforces this with a Step 0 gate that asks
  the user to confirm docs are current
- Mode count references must be kept consistent across all three files
- Stale version examples (e.g. `MDD version: v8`) should be replaced with current
  version or a placeholder that does not hardcode a specific version number

## Data Flow

Reads: nothing at runtime (static files).
Writes: nothing at runtime (static files served by Nginx).

## Dependencies

Requires `01-mdd` for the mode descriptions documented here. Content must mirror
the current state of all command files.

## Security

- `docs/index.html` contains an inline client-side redirect script. This script
  is hard-coded and cannot be influenced by user input - no XSS risk.
- Rybbit analytics script loaded from `app.rybbit.io`. This is a third-party script;
  standard CSP considerations apply if headers are added to the Nginx config.

## Known Issues

- Mode count is inconsistent across files: README.md TOC says "26 Modes" (line 45)
  but the heading says "27 Modes at a Glance" (line 240). `docs/user-guide.html` says
  "25 modes" in both the og:description and body text. `docs/index.html` meta
  description says "Twenty-six modes." None of these counts agree.
- README.md contains two stale `MDD version: v8` examples (lines 566, 1088-1089).
  These should reference the current version or be genericised.
- Schema.org JSON-LD in `docs/index.html` has `"softwareVersion": "1.0.0"` hardcoded
  and does not reflect the current npm version.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
