---
id: 06-doc-path-field
title: Doc Path Field — Hierarchical Grouping for Dashboard & Navigation
edition: Both
depends_on: [04-global-claude-guidance]
source_files:
  - commands/mdd-build.md
  - commands/mdd-manage.md
  - commands/mdd-lifecycle.md
  - commands/mdd.md
  - .mdd/docs/01-docs-site.md
  - .mdd/docs/02-dashboards-showcase.md
  - .mdd/docs/03-install-local-flag.md
  - .mdd/docs/04-global-claude-guidance.md
  - .mdd/docs/05-import-spec.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-14
status: draft
phase: documentation
mdd_version: 9
tags: [path, taxonomy, dashboard, grouping, frontmatter, schema, navigation, ia]
path: Tooling/Path Field
known_issues: []
---

# 06 — Doc Path Field — Hierarchical Grouping for Dashboard & Navigation

## Purpose

Adds a required `path` field to every MDD feature doc's frontmatter. The field records where a feature conceptually "lives" in the product — expressed as a slash-delimited breadcrumb string (e.g. `Auth/Login`, `Website/Detail Page/Accessories`). This gives dashboards and listing tools a human-meaningful grouping axis that is orthogonal to technical dependencies (`depends_on`) and unrelated to file structure. Nothing in the codebase changes; the change is entirely in MDD's doc schema and Claude's instructions for populating it.

## Architecture

```
Frontmatter field added to every .mdd/docs/*.md:
  path: <Area>              # one level
  path: <Area/Section>      # two levels (most common)
  path: <Area/Section/Page> # three levels (rare, for large product maps)

Consumers of this field:
  mdd-dashboard  → tree view grouped by path prefix
  mdd-tui        → outline navigation panel
  /mdd status    → grouped feature list
  /mdd scan      → flags docs with missing path field
  /mdd import-spec → assigns paths during spec-to-docs conversion
```

The `path` field is purely for display and navigation. It carries no semantic meaning for build order or dependency resolution — that remains in `depends_on`.

## Data Model

No database. Schema change only — one new frontmatter field per doc.

### Field Specification

| Property | Value |
|----------|-------|
| Field name | `path` |
| Type | String |
| Required | Yes — all new docs; backfill required for existing docs |
| Format | Title Case segments separated by `/` |
| Depth | 1–3 levels (2 is the norm) |
| Example values | `Auth/Login`, `E-commerce/Cart/Checkout`, `Dashboard` |

### Format Rules

1. **Title Case** — `Auth/Login` not `auth/login` or `AUTH/LOGIN`
2. **Product vocabulary** — use the terms users/stakeholders say, not code module names (`"Shopping Cart"` not `"cart_service"`)
3. **No trailing slash** — `Auth/Login` not `Auth/Login/`
4. **1–3 levels only** — if you need 4+ levels, restructure the top level
5. **Consistent siblings** — if `Auth/Login` exists and `Auth/Register` exists, their parent segment must be spelled identically (`Auth`, not `Authentication`)
6. **Singular root preferred** — `Auth` not `Authentication`, `E-commerce` not `E-Commerce`

### Good Examples

```yaml
path: Auth/Login
path: Auth/Register
path: Auth/OAuth/Google
path: E-commerce/Cart
path: E-commerce/Checkout/Payment
path: Dashboard/Analytics
path: Dashboard/Settings/Notifications
path: Website/Home
path: Website/Product Detail/Gallery
path: API/Rate Limiting
path: Tooling/Import Spec
```

### Bad Examples (and why)

```yaml
path: auth_login          # snake_case — not Title Case
path: Authentication      # too generic at top level — prefer "Auth"
path: Website/login-page  # kebab-case — not Title Case
path: A/B/C/D/Feature     # 4+ levels — restructure
path: src/handlers/auth   # code path, not product path
```

## Business Rules

### Rule 1 — Required on all new docs

`mdd-build.md` Phase 3 (Write the MDD Documentation) must instruct Claude to determine and populate `path` before writing the doc. The field must appear in the frontmatter template.

**How Claude determines the path (Phase 3 instruction):**

> Read the `path` fields of all existing docs in `.mdd/docs/` to understand current grouping conventions. Then ask: "What would a user click or navigate to in order to reach this feature?" — answer in the user's mental model, not the code structure. Use 1–3 segments, Title Case, product vocabulary. If you can determine it from context, set it and show the user. If genuinely ambiguous (the feature could reasonably belong in 2+ places), ask: `"Where does this feature live in the product? (e.g. 'Auth/Login' or 'Dashboard/Reports')"`

### Rule 2 — Scan detects missing path fields

`/mdd scan` must flag any doc that is missing a `path` field or has `path: ""`. Output:

```
⚠️  Missing path field:
   02-dashboards-showcase.md — add path: <Area/Section>
   03-install-local-flag.md  — add path: <Area/Section>
```

### Rule 3 — Update mode writes path if missing

`/mdd update <NN>` must offer to add a `path` field if it is absent:
```
path field is missing. Where does this feature live? (e.g. 'Auth/Login')
```

### Rule 4 — Backfill existing docs

All docs that exist before this feature is implemented must be backfilled with a `path` value. The backfill runs as part of this feature's implementation — Claude reads each existing doc and determines the appropriate path, then writes it. Backfill is gated on user confirmation (dry-run shown first).

Proposed backfill for this project's existing docs:
| Doc | Proposed path |
|-----|--------------|
| 01-docs-site | Tooling/Docs Site |
| 02-dashboards-showcase | Tooling/Dashboard |
| 03-install-local-flag | Tooling/Install |
| 04-global-claude-guidance | Tooling/Claude Guidance |
| 05-import-spec | Tooling/Import Spec |

### Rule 5 — `/mdd upgrade` support

`/mdd upgrade` (in `mdd-lifecycle.md`) must be updated to include `path` in its inventory and patching logic. Handling differs from `last_synced`/`status` because `path` cannot be inferred from git history — Claude must read each doc's title and purpose section to propose a value.

**Upgrade flow for `path`:**

1. Inventory phase: add `path` column to the upgrade table (✅ present / ❌ missing)
2. For each doc missing `path`: read its `title` and `## Purpose` section, then propose a `path` value using the same rules as Phase 3 of mdd-build (product vocabulary, Title Case, 1–3 levels)
3. Show the full batch plan before writing — same confirm/review-individually/cancel gate as other fields
4. Write `path` non-destructively in the canonical field order (between `tags` and `known_issues`)
5. After patching, report: `✅ path added: Auth/Login` per doc

Because path inference requires reading doc content, `/mdd upgrade` must NOT skip this step silently — it runs the inference pass and shows it to the user before writing.

### Rule 6 — Consistency enforcement

When writing a new doc, Claude must check for existing path siblings and use the same spelling. If `Auth/Login` exists, a new doc cannot use `Authentication/Login` — it must use `Auth/<something>`.

### Rule 6 — Dashboard tree rendering

The `path` field is the primary grouping key for `mdd-dashboard` and `mdd-tui`. Rendering logic (for implementors):
1. Split each doc's `path` by `/`
2. Build a tree from the segments
3. Leaf node = the doc itself (title + status)
4. Interior nodes = path segments (expandable groups)
5. Docs with the same path prefix appear under the same group node

```
Tooling
  ├── Claude Guidance   ● complete  04-global-claude-guidance
  ├── Dashboard         ● complete  02-dashboards-showcase
  ├── Docs Site         ● complete  01-docs-site
  ├── Import Spec       ○ draft     05-import-spec
  └── Install           ● complete  03-install-local-flag
```

## Data Flow

Greenfield — no existing runtime data flows. The path field is read and written entirely within Claude Code sessions operating on `.mdd/docs/*.md` files.

## Dependencies

- `04-global-claude-guidance` — establishes the pattern for Claude instructions injected into the MDD command files; the `path` determination instruction follows the same injection pattern

## Known Issues

(none — new feature)
