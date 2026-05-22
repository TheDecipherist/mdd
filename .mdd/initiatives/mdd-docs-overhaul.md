---
id: mdd-docs-overhaul
title: MDD Docs Overhaul
status: complete
version: 6
hash: 1985e57f
created: 2026-05-21
---

# MDD Docs Overhaul

## Overview
Rebuild MDD's feature documentation from scratch, organized by command and concern rather than
build order. Introduces `00-frontmatter-spec.md` as a canonical schema reference and the `relates`
frontmatter field as a co-change signal. Wires the bootstrap step to auto-create the spec doc on
first run, and updates all doc-generating phases to read from the spec instead of using embedded
templates - eliminating the root cause of field-name drift found in the 2026-05-21 audit.

## Open Product Questions
(none)

## Waves
| Wave | File | Demo-state | Status |
|------|------|------------|--------|
| Wave 1 | waves/mdd-docs-overhaul-wave-1.md | `00-frontmatter-spec.md` exists and is readable; `01-mdd.md` documents the router, bootstrap, branch guard, and settings with correct field references | complete |
| Wave 2 | waves/mdd-docs-overhaul-wave-2.md | Every core MDD mode (build, audit, plan, ops, bug) has an accurate feature doc with correct frontmatter | complete |
| Wave 3 | waves/mdd-docs-overhaul-wave-3.md | All secondary command modes (lifecycle, security-rules, import-spec, framework, manage, manual) are documented | complete |
| Wave 4 | waves/mdd-docs-overhaul-wave-4.md | All infrastructure, tooling, and historical docs (rules, npm-cli, documentation, scripts, deploy, logging, github-issue-fixes, dashboards) exist | complete |
| Wave 5 | waves/mdd-docs-overhaul-wave-5.md | Old docs archived, new docs are source of truth, bootstrap auto-creates the spec on first run, no doc-generating phase uses embedded frontmatter templates | complete |
