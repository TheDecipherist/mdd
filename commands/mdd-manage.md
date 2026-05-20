## Phase Logging

At the **start** of every mode or phase (before any action) and the **end** (after all actions), run the command below. Substitute `PHASE` with the mode/phase identifier (e.g., `STATUS`, `Phase SC1`, `Phase U1`) and `EVENT` with `start` or `end`:

```bash
bash -c 'D=$(date +%Y-%m-%d); T=$(date +%H:%M:%S); K=$(compressmcp --status 2>/dev/null | grep -oE "[0-9]+K/[0-9]+K" | head -1 || echo "-"); mkdir -p ~/.claude/mdd; printf "| %s | mdd-manage | PHASE | EVENT | %s | %s |\n" "$D" "$T" "$K" >> ~/.claude/mdd/log.md' 2>/dev/null || true
```

Log file: `~/.claude/mdd/log.md`

---

## STATUS MODE — `/mdd status`

Quick overview of MDD state for the project:

1. **Scan `.mdd/docs/`** — count feature docs
2. **Scan `.mdd/audits/`** — find latest audit report
3. **Scan `.mdd/jobs/`** — detect any active audit job (see below)
4. **Count tests** — `pnpm test:unit --reporter=json 2>/dev/null | jq '.numTotalTests'`
5. **Count known issues** — grep `known_issues` across all docs
6. **Read current mdd_version** — from `mdd.md` frontmatter. Check `.claude/commands/mdd.md` first (local install), then `~/.claude/commands/mdd.md` (global install). Use whichever exists.
7. **Scan all `.mdd/` files** — grep `mdd_version` from each, group by version number
8. **Scan `.mdd/initiatives/`** — count initiative files, group by status
9. **Scan `.mdd/waves/`** — count wave files, group by status; for each active wave count complete vs total features

**Audit in progress detection:** If any `jobs/audit-*/` folder exists, count manifest entries by state (`[ ]`, `[~]`, `[x]`, `[!]`, `[e]`) from its `MANIFEST.md`. Show as a warning line in the status output.

Present:
```
📊 MDD Status

⚠️  Audit in progress: .mdd/jobs/audit-<date>/ (<done>/<total> files complete)
   Run /mdd audit to resume or discard.
   (omit this line entirely if no jobs/audit-*/ folder exists)

Feature docs:     <N> files in .mdd/docs/
Ops runbooks:     <N> files in .mdd/ops/
Last audit:       <date> (<N> findings, <N> fixed, <N> open)
Test coverage:    <N> unit tests, <N> E2E tests
Known issues:     <N> tracked across <N> features
Quality gates:    <N> files over 300 lines

Initiatives:      <N> total (<N> active, <N> planned, <N> complete, <N> cancelled)
  Active waves:   <wave-title> [<done>/<total> features complete]  (one line per active wave)
  (shown only if .mdd/initiatives/ exists and has files; omit section entirely if directory is absent)

MDD version:      v<N> (current)
  v<N>: <N> files — up to date
  v<N-1>: <N> files — run /install-mdd to update the command, then /mdd audit to refresh docs
  v0 (unversioned): <N> files — created before versioning was introduced

Drift check:
  <N> features in sync
  <N> features possibly drifted  ← run /mdd scan for details
  <N> features untracked         ← no last_synced field yet

Run `/mdd audit` to refresh, `/mdd scan` to see drift details, `/mdd plan-initiative` to start an initiative, `/mdd ops <description>` to create a deployment runbook, or `/mdd <feature>` to build something new.
```

If all files are on the current `mdd_version`, omit the version breakdown and just show: `MDD version: v<N> — all files up to date`

**Drift check logic** (lightweight — no full git log, just a quick presence check):
1. For each `.mdd/docs/*.md`, read `last_synced` from frontmatter.
2. If `last_synced` is missing → untracked.
3. If `last_synced` exists: run `git log --oneline --after="<last_synced>" -- <source_files>` for the first source file only (quick check). If output is non-empty → possibly drifted.
4. Count each category and show totals. Full details go in SCAN MODE.

### Rebuild `.mdd/.startup.md`

After collecting status, rebuild the auto-generated zone of `.mdd/.startup.md`:

1. Read the current `.mdd/.startup.md` (if it exists) and extract the **Notes section** — everything after the `---` divider line. This is the user's append-only zone and must be preserved exactly.
2. Rebuild the **auto-generated section** (everything above `---`) with fresh data:
   - `Generated: <YYYY-MM-DD>` (date only, no time)
   - `Branch:` from `git branch --show-current`
   - `Stack:` from `CLAUDE.md` or `claude-mastery-project.conf` if detectable, otherwise `(unknown)`
   - `Features Documented:` sorted list of `.mdd/docs/*.md` filenames with status and tags — format: `- <id> (<status>) [tag1, tag2, ...]`. If `tags:` is missing from a doc, omit the bracket section for that entry.
   - `Ops Runbooks:` sorted list of `.mdd/ops/*.md` filenames with tags — format: `- <slug> [tag1, tag2, ...]`. Omit section entirely if `.mdd/ops/` is empty.
   - `Last Audit:` from the most recent `.mdd/audits/report-*.md` — extract findings/fixed/open counts
   - `Rules Summary:` static block (does not change)
3. Write the rebuilt auto-generated section + `---` divider + preserved Notes section back to `.mdd/.startup.md`. Update `mdd_version` in the file's frontmatter to current.
4. If no `.mdd/.startup.md` exists yet, create it fresh using the template with an empty Notes section, stamped with current `mdd_version`.

### Check `.mdd/connections.md` Freshness

After rebuilding `.startup.md`, check connections.md:

1. If `.mdd/connections.md` does not exist → report: `⚠️  connections.md missing — run /mdd connect to generate`
2. Read `generated:` date from connections.md frontmatter. Find the most recent `last_synced` date across all docs.
   - If `generated` < most recent `last_synced` → report: `⚠️  connections.md stale (generated: <X>, newest doc synced: <Y>) — run /mdd connect`
   - If up to date → report: `✅ connections.md current (generated: <X>, <N> docs, <N> edges)`

---

## NOTE MODE — `/mdd note`

Triggered when arguments start with `note`. Three subcommands:

```
/mdd note "your note here"    -- append a timestamped note to .startup.md
/mdd note list                -- print only the Notes section
/mdd note clear               -- wipe the Notes section (asks for confirmation)
```

### `/mdd note "your note here"` — Append

1. Read `.mdd/.startup.md`. If it does not exist, create it first using the startup template (same as generated by `/mdd status` with placeholder values), then continue.
2. Find the `---` divider line.
3. Append below the divider: `- [YYYY-MM-DD] your note here` (use today's date).
4. Write the file back.
5. Print: `Note added to .mdd/.startup.md`

### `/mdd note list` — List Notes

1. Read `.mdd/.startup.md`.
2. Print everything after the `---` divider (the Notes section).
3. If the Notes section is empty or contains only the placeholder text, print: `(no notes yet)`

### `/mdd note clear` — Clear Notes

1. Ask the user: `Clear all notes in .mdd/.startup.md? This cannot be undone. (yes/no)`
2. If yes: rewrite the Notes section (everything after `---`) as `(no notes)`
3. If no: abort with `Cancelled.`

---

---

## SCAN MODE — `/mdd scan`

Triggered when arguments start with `scan`. Detects features whose source files have changed since the last MDD session, and checks for initiative/wave drift.

### Phase SC1 — Read all feature docs, ops runbooks, and initiative/wave files

Read every `.mdd/docs/*.md` (excluding `archive/`) and every `.mdd/ops/*.md` (excluding `archive/`). For each, extract:
- `last_synced` from frontmatter
- `source_files` list from frontmatter (feature docs) or the ops doc slug for ops runbooks

### Phase SC2 — Check each feature for drift (parallelized)

After Phase SC1 has the full feature list (IDs, `last_synced`, `source_files`), delegate all git log checks to a **single Explore agent** rather than running them sequentially in the main conversation.

**Why a single agent (not multiple):** `git log` commands are individually fast — the bottleneck is issuing them one at a time in the main conversation. One agent can run all of them in quick succession and return a complete classification table.

#### Agent instructions (self-contained)

The agent receives:
- Complete feature list: each feature's ID, `last_synced` date, and `source_files`
- Classification rules (below)
- Explicit instruction: run the git checks and return a structured table — do NOT write any files

For each feature, the agent runs:
```bash
# Check file existence
ls <source_file> 2>/dev/null

# Check for commits after last_synced (only if files exist)
git log --oneline --after="<last_synced>" -- <source_file>
```

#### What the agent returns

A classification table — one row per feature:

```
| Feature ID | Classification | Detail |
|---|---|---|
| 01-project-scaffolding | in_sync | last synced: 2026-03-15, no commits after |
| 04-content-builder | drifted | 3 commits since 2026-03-01, latest: "fix: heading parser" |
| 07-github-pages | broken | docs/index.html not found on disk |
| 09-integrations | untracked | no last_synced field |
```

**Classifications:**
- **untracked** — `last_synced` missing from frontmatter
- **no-path** — `path` field missing from frontmatter (run `/mdd upgrade` to add)
- **broken** — one or more `source_files` not found on disk
- **drifted** — `last_synced` exists, files exist, commits found after `last_synced`
- **in_sync** — `last_synced` exists, all files exist, no commits after `last_synced`

#### Main conversation: build drift report

After the agent returns its table, the main conversation writes the drift report. No file writes happen inside the agent.

**Fallback:** If the agent fails, run git checks sequentially in the main conversation using the same logic.

### Phase SC3 — Present drift report

```
🔍 MDD Scan — Drift Report
Generated: <YYYY-MM-DD>

  ✅ 01-project-scaffolding   — in sync (last synced: 2026-03-15)
  ⚠️  04-content-builder       — DRIFTED (3 commits since 2026-03-01)
                                  Latest: "fix: markdown heading parser"
  ❌  07-github-pages           — broken reference (docs/index.html not found)
  ❓  09-integrations           — untracked (no last_synced field)

Summary: 1 in sync · 1 drifted · 1 broken · 1 untracked
Missing path: <N> docs — run /mdd upgrade to populate  ← omit this line when N = 0

Recommended actions:
  /mdd update 04   — re-sync content-builder doc with code
  /mdd update 07   — fix broken file reference
  /mdd update 09   — add last_synced by running update mode
  /mdd upgrade     — add path field to <N> docs missing it  ← omit this line when there are no docs missing path
  /mdd connect     — rebuild connections.md if stale or missing
```

**Initiative/wave drift check** (only shown if `.mdd/initiatives/` exists):

For each initiative in `.mdd/initiatives/`:
- Read its `version` field from frontmatter
- For each of its waves (in `.mdd/waves/`), check that the wave's `initiativeVersion` matches the initiative's current `version`
- If a wave's `initiativeVersion` is older → flag as stale (run `/mdd plan-sync <initiative-id>` to refresh)

```
Initiatives:
  ✅ auth-system (v2) — all waves in sync
  ⚠️  payment-flow (v3) — 1 stale wave
       payment-flow-wave-2 (initiativeVersion: 2, initiative now: 3) → run /mdd plan-sync payment-flow
```

**Ops runbook drift check** (appended when `.mdd/ops/` has files):

For each ops runbook, check `last_synced` against the last git commit on the runbook file itself. Since ops runbooks track live service state (not source files), drift means the runbook file hasn't been touched since the last `runop`.

```
Ops Runbooks:
  ✅ swarmk-dokploy   — last runop: 2026-04-17
  ⚠️  rulecatch-dokploy — runbook edited 3 days ago but no runop since → run /mdd runop rulecatch-dokploy
```

**Connections map check:**

Check `.mdd/connections.md`:
- Missing → classify as `broken` and include in findings: `❌  connections.md — missing (run /mdd connect)`
- `generated:` older than most recent `last_synced` → classify as `drifted`: `⚠️  connections.md — stale (run /mdd connect)`
- Up to date → `✅ connections.md — current`

Save the full report to `.mdd/audits/scan-<date>.md`.

---

## UPDATE MODE — `/mdd update <feature-id>`

Triggered when arguments start with `update`. Updates an existing feature doc to reflect code that has changed since the last MDD session.

### Phase U1 — Load the feature

Parse `<feature-id>` from arguments (e.g., `04` or `04-content-builder`). Find the matching `.mdd/docs/*.md` file. Read it fully.

If the feature-id is not found, list all available docs and ask the user to pick one.

### Phase U2 — Read current source files

Read every file listed in `source_files` frontmatter. If a file is missing, note it as a broken reference — ask the user for the new path before continuing.

### Phase U3 — Diff doc vs code

Compare what the doc says against what the code actually does:
- New functions, endpoints, or exports not in the doc
- Removed or renamed functions that the doc still mentions
- Data model fields that changed
- Business rules that changed (different validation, new states)
- New edge cases visible in error handling

Write findings to `.mdd/audits/update-notes-<feature-id>-<date>.md`.

### Phase U4 — Present changes

```
📝 Update Review: <NN>-<feature-name>

Changes detected since <last_synced>:
  + Added:   <new thing>
  - Removed: <removed thing>
  ~ Changed: <changed thing>

Doc sections needing update:
  - API Endpoints (new route: POST /api/v1/...)
  - Business Rules (validation logic changed)

Proceed with doc update? (yes / review findings first / cancel)
```

Wait for user confirmation.

### Phase U5 — Rewrite affected sections

Rewrite ONLY the sections that changed. Preserve:
- `known_issues` section (don't remove existing issues)
- `depends_on` list (only add, never remove without asking)
- Any manually written prose that is still accurate

After rewriting, update frontmatter:
- `last_synced: <today's date>`
- `status:` — ask the user if they want to update the status (e.g., draft → complete)
- `phase:` — update to reflect current state
- `path:` — if the doc is missing a `path` field, offer to add it: "This doc is missing a `path` field. Where does this feature live in the product? (e.g. `Auth/Login`)" — if the user provides a value, write it between `tags` and `known_issues` in the frontmatter.

### Phase U6 — Regenerate test skeletons for new behaviors

For any NEW documented behaviors (not previously in the doc), generate test skeleton entries and append them to the existing test file. Do NOT modify existing test implementations.

Report:
```
✅ Update Complete: <NN>-<feature-name>

Doc updated: .mdd/docs/<NN>-<feature-name>.md
last_synced: <today>
Sections rewritten: <list>
New test skeletons: <N> appended to tests/unit/<feature-name>.test.ts

Branch: <current branch>
```

After updating the doc, regenerate connections.md:

**Regenerate `.mdd/connections.md`:**
Read all `.mdd/docs/*.md` (excluding `archive/`) — frontmatter only (id, title, status, path, depends_on, source_files). Never read doc bodies. Then:
1. **Path tree:** sort docs by path alphabetically, then by id within the same path. Render as an indented tree using `├──` / `└──` characters. Each leaf line: `<path-leaf-segment>  <id>  <status>`.
2. **Mermaid graph:** one node per doc (short node ID), one `-->` edge per `depends_on` entry, `:::<status>` suffix on each node. Include `classDef complete fill:#00e5cc,color:#000`, `in_progress fill:#ffaa00,color:#000`, `draft fill:#888,color:#fff`, `deprecated fill:#555,color:#aaa`.
3. **Source overlap:** build a map of source_file → docs that reference it. Include only files with 2+ docs.
4. **Warnings:** flag broken `depends_on` references (target does not exist), circular dependencies, docs missing `path` field.
5. **Write** `.mdd/connections.md` with YAML frontmatter (`generated: <today>`, `doc_count: <N>`, `connection_count: <N edges>`, `overlap_count: <N overlap files>`) followed by four sections: Path Tree, Dependency Graph (Mermaid), Source File Overlap, Warnings.

---

## DEPRECATE MODE — `/mdd deprecate <feature-id>`

Triggered when arguments start with `deprecate`. Archives a feature cleanly.

### Phase D1 — Load + impact check

Find and read the target feature doc. Then scan all other `.mdd/docs/*.md` for any that list this feature in `depends_on`. Build the impact list.

### Phase D2 — Present impact

```
🗑️  Deprecate: <NN>-<feature-name>

This will:
  - Set status: deprecated in the doc frontmatter
  - Move doc to .mdd/docs/archive/<NN>-<feature-name>.md

Dependents (docs that depend on this feature):
  - 05-testing-framework (depends_on includes this)
  - 09-integrations (depends_on includes this)

Source files registered:
  - src/handlers/content.ts
  - scripts/build-content.ts

Test files registered:
  - tests/unit/content-builder.test.ts

Deprecate? (yes / review dependents first / cancel)
```

If user says yes:

### Phase D3 — Archive

1. Set `status: deprecated` and `last_synced: <today>` in the doc frontmatter.
2. Create `.mdd/docs/archive/` directory if it doesn't exist.
3. Move the doc file to `.mdd/docs/archive/`.
4. For each dependent doc, add an entry to its `known_issues`: `<NN>-<feature-name> has been deprecated — review this feature's dependency.`
5. Ask the user separately: "Delete source files? (yes / no)" and "Delete test files? (yes / no)" — never auto-delete.
6. Rebuild `.mdd/.startup.md`.

Then regenerate connections.md:

**Regenerate `.mdd/connections.md`:**
Read all `.mdd/docs/*.md` (excluding `archive/`) — frontmatter only (id, title, status, path, depends_on, source_files). Never read doc bodies. Then:
1. **Path tree:** sort docs by path alphabetically, then by id within the same path. Render as an indented tree using `├──` / `└──` characters. Each leaf line: `<path-leaf-segment>  <id>  <status>`.
2. **Mermaid graph:** one node per doc (short node ID), one `-->` edge per `depends_on` entry, `:::<status>` suffix on each node. Include `classDef complete fill:#00e5cc,color:#000`, `in_progress fill:#ffaa00,color:#000`, `draft fill:#888,color:#fff`, `deprecated fill:#555,color:#aaa`.
3. **Source overlap:** build a map of source_file → docs that reference it. Include only files with 2+ docs.
4. **Warnings:** flag broken `depends_on` references (target does not exist), circular dependencies, docs missing `path` field.
5. **Write** `.mdd/connections.md` with YAML frontmatter (`generated: <today>`, `doc_count: <N>`, `connection_count: <N edges>`, `overlap_count: <N overlap files>`) followed by four sections: Path Tree, Dependency Graph (Mermaid), Source File Overlap, Warnings.

Report:
```
✅ Deprecated: <NN>-<feature-name>

Doc archived: .mdd/docs/archive/<NN>-<feature-name>.md
Dependents flagged: <N> docs updated with known_issues warning
Source files: <kept/deleted per user choice>
Test files: <kept/deleted per user choice>
```

---

## REBUILD-TAGS MODE — `/mdd rebuild-tags [--force]`

Triggered when arguments start with `rebuild-tags`. Scans all feature docs and ops runbooks, generates `tags:` for any doc missing the field, then rebuilds `.startup.md`.

**Use case:** Migrating existing projects to the tag system. Safe to run multiple times — docs that already have `tags:` are skipped unless `--force` is passed.

### Phase RT1 — Inventory

1. Glob `.mdd/docs/*.md` (excluding `archive/`) and `.mdd/ops/*.md` (excluding `archive/`).
2. For each doc, check frontmatter for a `tags:` field.
3. Build an inventory table:

```
🏷️  Rebuild Tags — Inventory

Doc                              | Has tags?
─────────────────────────────────|──────────
01-docs-site                     | ❌ missing
02-dashboards-showcase           | ❌ missing
03-install-local-flag            | ✅ present
swarmk-dokploy (ops)             | ❌ missing

Docs needing tags: <N> of <total>
```

If 0 docs need tags (and `--force` not passed) → report "All docs already have tags. `.startup.md` will be rebuilt." and jump to Phase RT3.

### Phase RT2 — Generate Tags

For each doc missing `tags:` (or all docs if `--force`):

1. Read the doc's frontmatter and `## Purpose` section (first paragraph only).
2. Generate 4–8 domain-concept keywords that identify what the doc is about:
   - Use: title words, purpose concepts, platform/technology names, key system names, operation types
   - Do NOT use: raw file paths, generic words like "feature" or "system", version numbers
   - For ops docs: emphasise platform, services, environments, operation type (e.g. `deploy`, `dokploy`, `docker`, `canary`)
   - For feature docs: emphasise domain concepts, technology, feature names (e.g. `auth`, `cli`, `install`, `flags`)
3. Write `tags:` to the doc frontmatter, inserting it **before** `known_issues:`.
4. Report one line per doc: `✅ 01-docs-site — tags: [github-pages, documentation, landing-page, user-guide]`

**`--force` behaviour:** Regenerate and overwrite `tags:` even on docs that already have them. Show old → new for each.

### Phase RT3 — Rebuild Startup

Trigger the `.mdd/.startup.md` rebuild (same logic as Status Mode — rebuild auto-generated zone, preserve Notes zone). The rebuilt startup now reflects tags on every feature and ops line.

Then regenerate connections.md:

**Regenerate `.mdd/connections.md`:**
Read all `.mdd/docs/*.md` (excluding `archive/`) — frontmatter only (id, title, status, path, depends_on, source_files). Never read doc bodies. Then:
1. **Path tree:** sort docs by path alphabetically, then by id within the same path. Render as an indented tree using `├──` / `└──` characters. Each leaf line: `<path-leaf-segment>  <id>  <status>`.
2. **Mermaid graph:** one node per doc (short node ID), one `-->` edge per `depends_on` entry, `:::<status>` suffix on each node. Include `classDef complete fill:#00e5cc,color:#000`, `in_progress fill:#ffaa00,color:#000`, `draft fill:#888,color:#fff`, `deprecated fill:#555,color:#aaa`.
3. **Source overlap:** build a map of source_file → docs that reference it. Include only files with 2+ docs.
4. **Warnings:** flag broken `depends_on` references (target does not exist), circular dependencies, docs missing `path` field.
5. **Write** `.mdd/connections.md` with YAML frontmatter (`generated: <today>`, `doc_count: <N>`, `connection_count: <N edges>`, `overlap_count: <N overlap files>`) followed by four sections: Path Tree, Dependency Graph (Mermaid), Source File Overlap, Warnings.

### Phase RT4 — Report

```
✅ Rebuild Tags Complete

Feature docs processed: <N>
Ops runbooks processed: <N>
Tags generated:         <N> docs
Tags skipped (present): <N> docs

.startup.md rebuilt with tag format:
  - 01-docs-site (complete) [github-pages, documentation, landing-page, user-guide]
  - 03-install-local-flag (complete) [cli, install, local-install, flags]
  ...

Run /mdd status to see the full updated startup snapshot.
```

---

## CONNECT MODE — `/mdd connect`

Triggered when arguments start with `connect`. Performs a full rebuild of `.mdd/connections.md` unconditionally — no staleness check, always regenerates from scratch.

**Regenerate `.mdd/connections.md`:**
Read all `.mdd/docs/*.md` (excluding `archive/`) — frontmatter only (id, title, status, path, depends_on, source_files). Never read doc bodies. Then:
1. **Path tree:** sort docs by path alphabetically, then by id within the same path. Render as an indented tree using `├──` / `└──` characters. Each leaf line: `<path-leaf-segment>  <id>  <status>`.
2. **Mermaid graph:** one node per doc (short node ID), one `-->` edge per `depends_on` entry, `:::<status>` suffix on each node. Include `classDef complete fill:#00e5cc,color:#000`, `in_progress fill:#ffaa00,color:#000`, `draft fill:#888,color:#fff`, `deprecated fill:#555,color:#aaa`.
3. **Source overlap:** build a map of source_file → docs that reference it. Include only files with 2+ docs.
4. **Warnings:** flag broken `depends_on` references (target does not exist), circular dependencies, docs missing `path` field.
5. **Write** `.mdd/connections.md` with YAML frontmatter (`generated: <today>`, `doc_count: <N>`, `connection_count: <N edges>`, `overlap_count: <N overlap files>`) followed by four sections: Path Tree, Dependency Graph (Mermaid), Source File Overlap, Warnings.

Report when done:
```
🔗 connections.md rebuilt

  Docs:            <N>
  Dependency edges: <N>
  Source overlaps:  <N files referenced by 2+ docs>
  Warnings:         <N> (or "none")

✅ .mdd/connections.md updated (<today>)
```
