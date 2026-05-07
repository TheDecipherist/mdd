---
id: 01-docs-site
title: Comprehensive Documentation & GitHub Pages Site
edition: MDD
depends_on: []
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
last_synced: 2026-05-07
status: complete
phase: all
mdd_version: 8
known_issues: []
---

# 01 — Comprehensive Documentation & GitHub Pages Site

## Purpose

Write an exhaustively detailed README.md and a GitHub Pages documentation site for the `@thedecipherist/mdd` npm package. The README must cover every mode, phase, gate, and concept in MDD. The docs site is adapted from the Claude Code Mastery Project Starter Kit's docs but rewritten to be solely about MDD as a standalone package, including a dedicated section explaining its history as a component of the starter kit before being extracted into its own package.

## Architecture

The documentation lives in two places:

1. **README.md** — the canonical text reference consumed in GitHub, npm, and IDE previews. Extremely comprehensive — every mode, every command, every concept explained.

2. **`docs/` (GitHub Pages site)** — a static HTML/CSS/JS site adapted from the starter kit docs. Two pages: `index.html` (landing page) and `user-guide.html` (deep-dive reference). Deployed at `https://thedecipherist.github.io/mdd`.

The docs site is self-contained — no build step, no framework, no bundler. Static HTML with Prism.js for syntax highlighting (CDN), Rybbit analytics, and the same dark-theme design system from the starter kit.

## Data Model

Not applicable — documentation only. No database, no API.

## API Endpoints

Not applicable — documentation only.

## Business Rules

- README must document **every** MDD mode (21 commands), every phase, every gate
- README must include the history section: how MDD was extracted from the starter kit
- Docs site must include Rybbit analytics (site-id from starter kit: `e7e29192d813`)
- Docs site `index.html` is the landing page — hero, overview, quick-start, all modes
- Docs site `user-guide.html` is the deep-dive — one section per mode with full explanations
- GitHub Pages URL: `https://thedecipherist.github.io/mdd`
- `docs/mdd_hero.webp` already exists — use it as the hero image
- Copy `thedecipherist.png` from the starter kit docs to `docs/` for the favicon and brand logo
- The migration section must explicitly mention the starter kit by name and link to it

## Data Flow

Greenfield — no existing docs to trace.

## Dependencies

None.

## Known Issues

(none)
