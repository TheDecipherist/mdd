---
id: 10-framework
title: Framework Mode - MDD Ecommerce Module and Client Scaffolding
edition: MDD
depends_on: [01-mdd, 02-build]
relates: [00-frontmatter-spec]
source_files:
  - commands/mdd-framework.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [framework, ecommerce, init-client, module, scaffold, site-config, seed, monorepo]
path: Commands/Framework
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 10 - Framework Mode - MDD Ecommerce Module and Client Scaffolding

## Purpose

FRAMEWORK MODE extends the `mdd-ecommerce` monorepo with new modules and scaffolds complete
client projects from proposal documents. It is specific to the `@thedecipherist/mdd-ecommerce`
project. Three sub-modes: `framework <feature>`, `init-client <path-to-proposal.md>`, and
`client-status`. Triggered by `/mdd framework`, `/mdd init-client`, or `/mdd client-status`.

## Architecture

Three sub-modes:

```
framework <feature>        — add a module to the mdd-ecommerce monorepo (delegates to BUILD MODE)
init-client <proposal.md>  — scaffold a complete client project from a proposal document
client-status              — report mdd-ecommerce installation state of a client project
```

### framework mode

Delegates to standard BUILD MODE with additional placement constraints:
- Modules go in `packages/modules/<name>/`
- Services go in `packages/<name>/`
- Feature doc frontmatter adds `type: framework-module` and a `slot:` field
- Before marking complete: run `pnpm --filter app build`; fix all TypeScript errors first

### init-client mode

Six phases:
1. Read proposal document
2. Extract config values: project name, domain, theme colors, feature flags, locales, currency
3. Parse product catalog table (sku, manufacturer, name, description, brand, price in cents, stock)
4. Determine module wiring from feature flags
5. Generate `site.config.ts`, `scripts/seed.ts`, `.env.example`
6. Report files written

Prices are stored as integers in cents/öre (multiply by 100, round). Seed script duplicates
LocaleString values across all locales (client fills actual translations later). Seed script
must exit cleanly after seeding with no dangling database connections.

### client-status mode

Four phases:
1. Read `package.json`; list `@thedecipherist/mdd-ecommerce-*` packages with versions
2. Read `site.config.ts`; extract wired slots and enabled feature flags
3. Check `.mdd/docs/` for MDD documentation count
4. Output status table

## Business Rules

- Framework modules that fill a slot must be wired into `apps/demo/site.config.ts`
- `skeleton-ready` status = component exists with stub data; `complete` = wired end-to-end
  with real data
- Init-client prices must be integers (cents/öre), never floats
- Seed scripts must call `process.exit(0)` cleanly after seeding
- `$FEATURE_SLUG` is used in all phase log calls but is never defined in this file
- `$MDD_DIR` is referenced in the file's first step ("Read `$MDD_DIR/mdd-build.md`") but
  is expected to be set by the caller (`mdd.md` Step 0c)

## Data Flow

Reads: proposal file (init-client), `package.json`, `site.config.ts`, `.mdd/docs/` (client-status).
Writes: feature docs with `type: framework-module` (framework mode), `site.config.ts`,
`scripts/seed.ts`, `.env.example` (init-client).

## Dependencies

Requires `01-mdd`. The `framework` sub-mode delegates to `02-build` for the full build workflow.

## Security

Not applicable - reads and writes local project files only. Init-client generates `.env.example`
with placeholder values, never actual credentials.

## Known Issues

- The `complete` log block for `framework <feature>` mode fires at lines 63-65, mid-file,
  before `init-client` steps execute. This is a copy-paste structural error: `framework`
  mode will be logged as complete before `init-client` runs.
- `init-client` mode has no `complete` log block of its own. The second completion event at
  lines 301-303 belongs to `client-status`. `init-client` is never logged as completing.
- `$FEATURE_SLUG` is undefined in all phase log calls (same pattern as mdd-build.md).
- `$MDD_DIR` is referenced at line 15 but may not be set if the caller does not export it.
- The file is 304 lines (just over the 300-line limit).

## Bugs

(none yet - populated by /mdd bug when issues are reported)
