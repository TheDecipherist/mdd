# mdd-tui

A terminal dashboard for [MDD (Manual-First Development)](https://github.com/TheDecipherist/claude-code-mastery-project-starter-kit) projects created by the starter kit.

Reads your `.mdd/` directory and renders a live, navigable TUI showing doc health, drift status, audit reports, and full markdown content — without leaving the terminal.

![MDD Dashboard](./mdd_dashboard.png)

---

## Install

```bash
npm install -g mdd-tui
```

## Usage

Run from any project directory that has a `.mdd/` folder:

```bash
mdd dashboard
```

---

## Navigation

| Key | Action |
|-----|--------|
| `↑` / `k` | Move up in left panel / scroll up in right panel |
| `↓` / `j` | Move down in left panel / scroll down in right panel |
| `→` / `Enter` | Focus right panel |
| `←` / `Esc` | Focus left panel |
| `Page Up` | Scroll right panel up one page |
| `Page Down` | Scroll right panel down one page |
| `Home` | Jump to top of right panel |
| `End` | Jump to bottom of right panel |
| `r` | Refresh workspace |
| `q` / `Ctrl+C` | Quit |

---

## What it shows

**Left panel** — scrollable list of all feature docs and audit reports with drift status icons:

| Icon | Meaning |
|------|---------|
| ✅ | In sync with source files |
| ⚠️ | Drifted — commits since last sync |
| ❌ | Broken — source files missing |
| ❓ | Untracked — no source files defined |

**Right panel** — full detail view for the selected item:
- Status chips (draft / in_progress / complete)
- Source files, dependencies, known issues
- Drift commits since last sync
- Full markdown body with rendered headings, tables, code, and bold

**Status bar** — live counts: DOCS · IN SYNC · DRIFTED · BROKEN · UNTRACKED · ISSUES · AUDITS

---

## What is MDD?

MDD (Manual-First Development) is a documentation-first workflow for building features with AI coding assistants. Every feature starts with a `.mdd/docs/*.md` file that defines architecture, API, data model, and business rules before any code is written.

`mdd-tui` is the companion dashboard — run it alongside your editor to track doc health across the project.

---

## Requirements

- Node.js 18+
- A project with a `.mdd/` directory

---

## License

MIT
