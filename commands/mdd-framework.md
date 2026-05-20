## FRAMEWORK MODE

Routes to one of three sub-modes based on the command used.

## Phase Logging

At the **start** of every step (before any action) and the **end** of every step (after all actions), run the command below. Substitute `PHASE` with the step identifier (e.g., `Step 1`, `Step 3`) and `EVENT` with `start` or `end`:

```bash
bash -c 'D=$(date +%Y-%m-%d); T=$(date +%H:%M:%S); K=$(compressmcp --status 2>/dev/null | grep -oE "[0-9]+K/[0-9]+K" | head -1 || echo "-"); mkdir -p ~/.claude/mdd; printf "| %s | mdd-framework | PHASE | EVENT | %s | %s |\n" "$D" "$T" "$K" >> ~/.claude/mdd/log.md' 2>/dev/null || true
```

Log file: `~/.claude/mdd/log.md`

---

## `framework <feature>` — Add a Module to mdd-ecommerce

**$ARGUMENTS** is the feature description.

### Step 1 - Run normal BUILD MODE

Read `$MDD_DIR/mdd-build.md` and follow every phase (branch check, context gather, questions, doc, implementation, tests). All standard MDD rules apply.

Apply these additional constraints throughout:

**Placement:**
- New framework module (fills a slot) → `packages/modules/<name>/`
- New service package (no slot) → `packages/<name>/`

Confirm placement with the user during Phase 1 questions if unclear.

**MDD doc frontmatter additions:**
```yaml
type: framework-module
slot: <slot-name-or-none>
```

**Status values specific to framework modules:**
- `skeleton-ready` — component exists, exports the correct interface, but returns stub/mock data
- `complete` — wired end-to-end with real data flowing

Use `skeleton-ready` when the module compiles but is not yet connected to real data sources. Use `complete` only when the full data path works.

**After implementation:**

1. Run the compile check:
   ```bash
   pnpm --filter app build
   ```
   Fix any TypeScript errors before marking the doc `complete`.

2. If the module fills a slot, add it to the demo site config:
   - Open `apps/demo/site.config.ts`
   - Import the new module
   - Wire it into the appropriate slot in `defineSiteConfig()`

3. Update the doc status to `skeleton-ready` or `complete` based on the state above.

---

## `init-client <path-to-proposal.md>` — Scaffold a Client Project

**$ARGUMENTS** is the path to a completed proposal markdown file.

### Step 1 - Read the proposal

Read the file at `$ARGUMENTS`. If `$ARGUMENTS` is empty, ask: "What is the path to the proposal file?"

Stop if the file does not exist. Report the path and ask the user to check it.

### Step 2 - Extract config values

Parse the proposal for these values:

| Config key | Where to find it |
|---|---|
| `config.name` | Business name heading or intro |
| `config.domain` | Domain / URL section |
| `config.theme.tokens.accent` | Theme colors section |
| `config.theme.tokens.warmBand` | Theme colors section |
| `config.theme.tokens.footerDark` | Theme colors section |
| `config.features.*` | Feature toggles section (yes/no flags) |
| `config.locales` | Language selector section |
| `config.defaultLocale` | Language selector section (first/primary listed) |
| `config.payments.currency` | Payments section |

If any required value is missing, list the gaps and ask the user to supply them before continuing.

### Step 3 - Parse the product catalog

The proposal contains a markdown table with columns: `sku`, `mfr`, `name`, `description`, `brand`, `price`, `stock`.

Extract every row. Convert `price` to integers (cents/öre - multiply by 100 and round). Build TypeScript seed data from this table.

If the table is missing or empty, ask: "No products found in the catalog table. Add products to the proposal and re-run, or continue with an empty seed?"

### Step 4 - Determine module wiring

Based on the feature flags extracted in Step 2, decide which `@thedecipherist/mdd-ecommerce-*` packages to import and wire into `site.config.ts`:

- `newsletter: true` → include `@thedecipherist/mdd-ecommerce-newsletter`
- `trustBadges: true` → include `@thedecipherist/mdd-ecommerce-trust-badges`
- Add any other feature-to-package mappings that are evident from the proposal

Always include `@thedecipherist/mdd-ecommerce-core`.

### Step 5 - Generate files

Write all files to the current working directory.

**`site.config.ts`:**
```typescript
import { defineSiteConfig } from '@thedecipherist/mdd-ecommerce-core'
// import enabled modules
// (one import per enabled feature module)

export const siteConfig = defineSiteConfig({
  name: '<extracted name>',
  domain: '<extracted domain>',
  locales: ['<locales array>'],
  defaultLocale: '<default locale>',
  theme: {
    tokens: {
      accent: '<extracted>',
      warmBand: '<extracted>',
      footerDark: '<extracted>',
    },
  },
  features: {
    // one key per extracted feature flag
  },
  payments: {
    currency: '<extracted>',
  },
  slots: {
    // wire enabled modules into their slots here
  },
})
```

**`scripts/seed.ts`:**

TypeScript file that:
1. Connects to MongoDB using `process.env.MONGODB_URI`
2. Seeds categories derived from the product catalog (`brand` or `mfr` as category)
3. Seeds products using `@thedecipherist/mdd-ecommerce-cms` models
4. For `LocaleString` fields (`name`, `description`): duplicate the value across all locales in `config.locales` - client fills in translations later
5. Converts price integers back to the correct unit when displaying, but stores as integers (cents/öre)
6. Exits cleanly after seeding - no dangling connections

**`.env.example`:**

```bash
# Client database: <business-name-in-snake_case>
# Copy this to .env and fill in values

MONGODB_URI=
NEXT_PUBLIC_SITE_URL=https://<domain>
NEXT_PUBLIC_RYBBIT_SITE_ID=
NEXT_PUBLIC_RYBBIT_URL=https://app.rybbit.io
# add any other vars from the main mdd-ecommerce .env.example
```

### Step 6 - Report

List every file written with its path. Then output:

```
Next steps:
1. Fill in .env from .env.example
2. Run: pnpm install
3. Run: npx tsx scripts/seed.ts
```

---

## `client-status` — Framework Install Report

Run this from the root of a client project directory.

### Step 1 - Read package.json

Read `package.json` in the current directory. Find all dependencies and devDependencies whose names start with `@thedecipherist/mdd-ecommerce-`. List each with its pinned version.

If no such dependencies exist, report: "No mdd-ecommerce packages found in package.json. Is this the right directory?"

### Step 2 - Read site.config.ts

Read `site.config.ts`. Extract:
- Which slots have modules wired (non-null slot values)
- Which feature flags are `true`

### Step 3 - Check MDD docs

Check if `.mdd/docs/` exists. If yes, count the `.md` files inside.

### Step 4 - Output status table

```
mdd-ecommerce Client Status
============================

Packages installed:
  @thedecipherist/mdd-ecommerce-core          v<version>
  @thedecipherist/mdd-ecommerce-<module>      v<version>
  (one line per installed package)

Slots wired:       <list of wired slot names, or "none">
Features enabled:  <list of true feature flags, or "none">

MDD docs:          <N> files in .mdd/docs/  (or "directory not found")
```

If `site.config.ts` does not exist, report that and skip slots/features rows.
