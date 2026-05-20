## Phase Logging

At the **start** of every phase (before any action) and the **end** of every phase (after all actions), run the command below. Substitute `PHASE` with the phase identifier (e.g., `Phase PI1`, `Phase PW3`, `Phase PE2`) and `EVENT` with `start` or `end`:

```bash
bash -c 'D=$(date +%Y-%m-%d); T=$(date +%H:%M:%S); K=$(compressmcp --status 2>/dev/null | grep -oE "[0-9]+K/[0-9]+K" | head -1 || echo "-"); mkdir -p ~/.claude/mdd; printf "| %s | mdd-plan | PHASE | EVENT | %s | %s |\n" "$D" "$T" "$K" >> ~/.claude/mdd/log.md' 2>/dev/null || true
```

Log file: `~/.claude/mdd/log.md`

---

## PLAN-INITIATIVE MODE — `/mdd plan-initiative`

Triggered when arguments start with `plan-initiative`. Creates a new initiative doc.

### Phase PI0 — Branch Guard

Run before any file creation:

```bash
BRANCH=$(git branch --show-current)
DIRTY=$(git status --porcelain)
```

- **On `main` or `master` with uncommitted changes** → STOP. Show the Scenario A prompt from mdd.md Branch Guard.
- **On `main` or `master`, clean** → auto-branch to `feat/init-<initiative-slug>`. If the slug is not yet known (title not asked), use `feat/mdd-initiative` as a temporary name and rename the branch after the title is collected.
- **On a feature branch** → working dirty is fine. Proceed — initiative planning docs belong on whatever branch is current.
- **Never proceed on main.** Hard block.

### Phase PI1 — Mode choice

Ask the user:
```
How do you want to create this initiative?
  (a) Guide me — I'll ask questions and build the file
  (b) Template — generate a blank file I'll fill out manually
```

**If (b) Template:**
1. Ask for a title (e.g. "Auth System") → slugify to `auth-system`
2. Check for slug collision: if `initiatives/auth-system.md` already exists → hard stop:
   *"An initiative with this name already exists (`initiatives/auth-system.md`)."*
   - Check all wave docs for active feature docs (`wave_status` not `complete`/`archived`/`deprecated`)
   - If active docs found → *"This initiative has active feature docs. Deprecate them first before re-initialising."* List them.
   - If no active docs → ask "Overwrite? (yes/no)"
3. Create `.mdd/initiatives/<slug>.md` with blank template (all sections as placeholders, `version: 1`, `hash: ` empty)
4. Tell user: *"Fill it out in your editor, then run `/mdd plan-sync` to register the hash, then `/mdd plan-wave <wave-slug>` when ready."*
5. Stop.

**If (a) Guide me:** proceed to Phase PI2.

### Phase PI2 — Questions

Ask all questions in a single interaction:
1. "What is the title of this initiative?"
2. "Describe it — what does it deliver and why does it exist?"
3. "Roughly how many waves do you think this needs? (2–6 is typical)"
4. For each wave: "Wave N — name and one-sentence demo-state (what can the user DO when this wave is done?)"
5. "What's still undecided that could affect architecture?" → these become open product questions (unchecked `- [ ]` items)

### Phase PI3 — Write initiative doc

**Slug format:** lowercase, hyphens, no special characters. "Auth System" → `auth-system`.

**Collision check:** same as template mode above.

Create `.mdd/initiatives/<slug>.md`:

```markdown
---
id: <slug>
title: <title>
status: active
version: 1
hash:
created: <YYYY-MM-DD>
---

# <title>

## Overview
<description>

## Open Product Questions
- [ ] <question 1>
- [ ] <question 2>

## Waves
| Wave | File | Demo-state | Status |
|------|------|------------|--------|
| Wave 1 | waves/<slug>-wave-1.md | <demo-state> | planned |
| Wave 2 | waves/<slug>-wave-2.md | <demo-state> | planned |
```

Compute and write `hash:` field after writing (hash of file content excluding the hash line).

Rebuild `.mdd/.startup.md`.

### Phase PI4 — Chain to plan-wave

Show the created doc to the user. Ask:
*"Want to plan Wave 1 now? (yes / no — I'll run /mdd plan-wave <slug>-wave-1 later)"*

If yes → run Phase PW1 inline for `<slug>-wave-1`.

---

## PLAN-WAVE MODE — `/mdd plan-wave <wave-slug>`

Triggered when arguments start with `plan-wave`. Takes a wave slug (e.g. `auth-system-wave-2`), resolves the parent initiative from it.

### Phase PW1 — Load and validate

**Step 0 — Branch guard:**

```bash
BRANCH=$(git branch --show-current)
DIRTY=$(git status --porcelain)
```

- **On `main` or `master` with uncommitted changes** → STOP. Show Scenario A from mdd.md Branch Guard.
- **On `main` or `master`, clean** → auto-branch to `feat/<wave-slug>`.
- **On a feature branch** → proceed (planning docs belong on this branch).
- **Never proceed on main.** Hard block.

1. Parse `<wave-slug>` from arguments — hard stop *"Wave slug required. Usage: /mdd plan-wave <wave-slug>"* if missing.
2. Derive initiative slug: everything before `-wave-N` (e.g. `auth-system-wave-2` → `auth-system`).
3. Read `initiatives/<initiative-slug>.md` fresh from disk — hard stop *"Initiative does not exist: `initiatives/<slug>.md`"* if not found.
4. **Hash check:** compute hash of initiative file (excluding `hash:` line), compare to stored `hash:` field. If mismatch → hard stop: *"Initiative file has been manually edited since last sync. Run `/mdd plan-sync` first."*
5. **Open questions gate:** check for any unchecked `- [ ]` items in Open Product Questions. If found → hard stop, quote each unchecked question back: *"These questions must be answered before planning a wave."*
6. **Depends-on gate:** read existing wave docs for this initiative. If the new wave's `depends_on` wave exists and is not `complete` → hard stop.
7. Surface context summary to user: initiative title, overview, wave count, which waves are done.

### Phase PW2 — Mode choice

Same as PI1: ask "(a) Guide me / (b) Template".

**If (b) Template:** create `waves/<wave-slug>.md` with blank template, tell user to fill it out and run `/mdd plan-sync` then `/mdd plan-execute <wave-slug>`.

**If (a) Guide me:** proceed to Phase PW3.

### Phase PW3 — Questions

Ask in a single interaction:
1. "Here's the demo-state from the initiative: [X]. Does this need sharpening for this wave?"
2. "List the features needed to reach that demo-state — name + one-line description each."
3. "Do any features depend on other features within this wave?"
4. "Any open research questions before building? Or none?"

### Phase PW4 — Write wave doc

Create `waves/<wave-slug>.md`:

```markdown
---
id: <wave-slug>
title: "Wave N: <title>"
initiative: <initiative-slug>
initiative_version: <current initiative version>
status: planned
depends_on: none
demo_state: "<demo-state>"
created: <YYYY-MM-DD>
hash:
---

# Wave N: <title>

## Demo-State
<demo-state>
*(This wave is not complete until this can be manually demonstrated.)*

## Features
| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | <feature-slug> | — | planned | — |
| 2 | <feature-slug> | — | planned | <dep-slug or —> |

## Open Research
<research items or (none)>
```

Compute and write `hash:` field. Update the Waves table in `initiatives/<slug>.md` to add this wave row. Increment `version` and recompute `hash` on the initiative file.

Rebuild `.mdd/.startup.md`.

### Phase PW5 — Chain

Ask: *"Want to plan Wave N+1 now? (yes / no)"*
If yes → run Phase PW1 inline for the next wave slug.

---

## PLAN-EXECUTE MODE — `/mdd plan-execute <wave-slug>`

Triggered when arguments start with `plan-execute`. Runs the full MDD build flow for each feature in the wave.

### Phase PE1 — Load and validate

**Step 0 — Branch guard (runs before everything else):**

```bash
BRANCH=$(git branch --show-current)
DIRTY=$(git status --porcelain)
```

- **On `main` or `master` with uncommitted changes** → STOP. Show the Scenario A prompt from the Branch Guard in mdd.md. Do not proceed until resolved.
- **On `main` or `master`, clean** → auto-branch to `feat/<wave-slug>` immediately. Report: `✅ Branched to feat/<wave-slug>`.
- **On a feature branch that doesn't match `<wave-slug>`** → mismatch. Show:
  ```
  ⚠️  Branch mismatch for wave execution.

  Current branch: <branch-name>
  Expected:       feat/<wave-slug>

  MDD expects one wave per branch. What would you like to do?
    (a) Commit, merge to main, and branch fresh to feat/<wave-slug>
    (b) Continue on this branch (not recommended — mixes work)
    (c) Abort
  ```
  Follow the same (a)/(b)/(c) logic as mdd-build.md Phase 0.
- **Never proceed on main.** This is a hard block regardless of clean/dirty state.

1. Parse `<wave-slug>` — hard stop *"Wave does not exist"* if `.mdd/waves/<wave-slug>.md` not found.
2. Read the wave doc.
3. Derive and read the parent initiative — hard stop if not found.
4. **Hash check:** verify both initiative and wave file hashes. Hard stop on any mismatch: *"File has been manually edited since last sync. Run `/mdd plan-sync` first."*
5. **Depends-on gate:** if wave's `depends_on` is not `none`, verify that wave is `complete`. Hard stop if not.
6. **Feature ordering check:** build dependency graph of features within the wave. If any ordering violation found → hard stop, explain exact conflict, offer auto-reorder.
7. **Stale job detection:** Check `.mdd/jobs/` for any existing `wave-<wave-slug>/` folder.
   - If found: read its `MANIFEST.md` and count entries by state (`[ ]`, `[~]`, `[x]`, `[!]`). Present to user:
     ```
     Found interrupted wave job from <date>.
     MANIFEST shows <done>/<total> features complete.
     Features done: <list of [x] slugs>
     Remaining:     <list of [ ] and [~] slugs>

       [R] Resume — continue from where it left off
       [D] Discard — delete job and start wave from scratch
     ```
   - **Resume:** skip PE2, skip to PE3 starting from the first `[ ]` or `[~]` entry. Features marked `[x]` are already complete — do not re-run them.
   - **Discard:** delete the `wave-<wave-slug>/` folder, proceed to PE2 normally.
   - If no stale job exists: proceed to PE2 normally.

### Phase PE2 — Interaction mode + Job Setup

Ask:
```
How do you want to run this wave?
  (a) Automated — minimal interruptions, pauses only on errors
  (b) Interactive — full MDD gates on every feature
```

**Automated:** data flow shown but not gated, build plan shown but not gated, green gate runs silently. On 5-iteration failure or integration failure → pause and surface to user with options (continue / narrow scope / stop). Does NOT fail the whole wave.

**Interactive:** full Phase 2 gate, Phase 5 plan confirmation, green gate iteration prompts on every feature.

**After the interaction mode is chosen — create the job folder and MANIFEST (nothing proceeds until this exists on disk):**

Create `.mdd/jobs/wave-<wave-slug>/MANIFEST.md`:

```markdown
# Wave Job Manifest
# Job: wave-<wave-slug>
# Wave: .mdd/waves/<wave-slug>.md
# Initiative: <initiative-slug>
# Started: <ISO timestamp>
# Mode: <automated | interactive>
# Features: <N>
# Status: IN PROGRESS
#
# States: [ ] planned  [~] in_progress  [x] complete  [!] error

## Features (in build order)
[ ] <feature-slug-1>    .mdd/docs/<NN>-<slug>.md
[ ] <feature-slug-2>    .mdd/docs/<NN>-<slug>.md
[ ] <feature-slug-3>    .mdd/docs/<NN>-<slug>.md
```

List every feature from the wave's Features table in order. Features already marked `complete` in the wave doc get `[x]` from the start.

### Phase PE3 — Execute features

For each feature in the wave's feature table, in dependency order, skipping `complete` features:

1. Tell user: *"Starting Feature N: <feature-slug>"*
2. Mark the feature `[~]` in `MANIFEST.md` immediately (before any other work).
3. Flip `wave_status: active` for this feature in the wave doc immediately.
4. Update the wave doc's `Doc` column with the feature doc path (once created in MDD Phase 3).
5. Run full MDD Build Mode (Phases 1–7) for the feature, at the chosen interaction level.
   - Feature doc is auto-numbered from `.mdd/docs/` and gets `initiative`, `wave`, `wave_status` fields added.
6. **PE3 Completion Gate** — run these checks BEFORE marking `[x]`. This is a hard gate, not advisory.

   **a. source_files existence check** — read `source_files` from the feature doc. For each file listed, verify it exists on disk:
   ```bash
   # For each file in source_files:
   test -f <path> && echo "OK: <path>" || echo "MISSING: <path>"
   ```
   If any file is missing: mark the feature `[!]` in MANIFEST with the list of missing files. Do NOT proceed to step 7 — implement the missing files or explicitly document them as deferred in `known_issues`.

   **b. satisfies_contracts verification** — read `satisfies_contracts` from the feature doc. If any entry is still `status: pending`, the security/integration contract was never wired. Find the call site, wire it, update to `verified: <file>:<line>`. A feature cannot be `[x]` with pending contracts.

   **c. Doc status write** — confirm `status: complete` is in the feature doc frontmatter. Phase 7c should have written this. If it is missing (still `draft` or `in_progress`), write it now along with `last_synced: <today>` and `phase: all`. This is NOT optional — a missing status write means the doc audit will flag the feature as incomplete on the next run.

7. Mark the feature `[x]` in `MANIFEST.md`. If the completion gate blocked (step 6a or 6b failed), mark `[!]` with a one-line note listing what was missing.
8. Ask: *"Feature N done ✓. Start Feature N+1? (yes / pause here)"*

**Resume behaviour:** if re-run on a partially complete wave, stale job detection in PE1 handles resume. MANIFEST is the authoritative progress record — it is always written before and after each feature so an interrupted session can pick up at the exact right point.

### Phase PE4 — Wave completion

When all features are `complete`:
1. Update `MANIFEST.md` — set `# Status: COMPLETE` in the header.
2. Show the demo-state: *"Wave complete. Demo-state: '<demo-state>'. Have you verified this?"*
2. User confirms → flip wave `status: complete` in both `waves/<slug>.md` AND the waves table in `initiatives/<slug>.md`.
3. **Cascade status to feature docs** — for every feature listed in this wave, read its `.mdd/docs/<NN>-<slug>.md` and check `status:`. For any doc that is NOT already `complete` or `deprecated`, write:
   - `status: complete`
   - `last_synced: <today>`
   - `mdd_version: <current from mdd.md frontmatter>`
   This is the authoritative completion signal — a wave being marked complete means all its features are done regardless of whether Phase 7c ran correctly during build.
4. Recompute hashes for both wave and initiative files.
5. If all waves in initiative are `complete` → ask: *"All waves done. Mark initiative complete? (yes / no)"*
   - If yes → **Update initiative frontmatter** — write these fields now:
     - `status: complete`
     - `last_synced: <today>`
     - `mdd_version: <current from mdd.md frontmatter>`
6. Rebuild `.mdd/.startup.md`.

Then regenerate connections.md:

**Regenerate `.mdd/connections.md`:**
Read all `.mdd/docs/*.md` (excluding `archive/`) — frontmatter only (id, title, status, path, depends_on, source_files). Never read doc bodies. Then:
- **Path tree:** sort docs by path alphabetically, then by id within the same path. Render as indented tree using `├──` / `└──` characters. Each leaf: `<path-leaf-segment>  <id>  <status>`.
- **Mermaid graph:** one node per doc (short node ID), one `-->` edge per `depends_on` entry, `:::<status>` suffix on each node. Include `classDef complete fill:#00e5cc,color:#000`, `in_progress fill:#ffaa00,color:#000`, `draft fill:#888,color:#fff`, `deprecated fill:#555,color:#aaa`.
- **Source overlap:** build map of source_file → docs that reference it. Include only files with 2+ docs.
- **Warnings:** broken `depends_on` refs (target doesn't exist), circular dependencies, docs missing `path`.
- **Write** `.mdd/connections.md` with YAML frontmatter (`generated: <today>`, `doc_count: <N>`, `connection_count: <N>`, `overlap_count: <N>`) and four sections: Path Tree, Dependency Graph (Mermaid), Source File Overlap, Warnings.

**Clean up job folder:** Delete `.mdd/jobs/wave-<wave-slug>/` entirely. The wave doc and feature docs are the authoritative completion record — the job folder is ephemeral tracking only.

---

## PLAN-SYNC MODE — `/mdd plan-sync`

Triggered when arguments start with `plan-sync`. Detects manual edits to initiative/wave files via hash comparison and reconciles them.

### Phase PS1 — Scan all files

Read every file in `.mdd/initiatives/` and `.mdd/waves/` (including `archive/`). For each, compute the hash of the file content (excluding the `hash:` line). Compare against stored `hash:` field.

Build a change table:
```
Initiative / Wave                | Stored hash | Computed hash | Changed?
auth-system.md                   | a3f5b2c1    | a3f5b2c1      | No
auth-system-wave-1.md            | def456      | abc999        | YES
billing-module.md                | (empty)     | xyz111        | YES (new — no hash yet)
```

### Phase PS2 — Present changes + confirm

Show the full change table. Tell the user what will happen:

- **Initiative changed:** version incremented, hash updated, completed waves with old `initiative_version` flagged for review
- **Wave changed:** hash updated, completed features in that wave flagged for review
- **No hash yet (new file):** hash computed and written — no version bump needed

Ask: *"Apply these updates? (yes / review each / cancel)"*

### Phase PS3 — Apply

For each changed file, in initiative-first order:

**Initiative changed:**
1. Increment `version` field
2. Rewrite `hash:` field
3. Find all wave docs for this initiative where `status: complete` AND `initiative_version` < new version
4. Prompt: *"Initiative updated (v1 → v2) since these waves were completed: [list]. Mark them back to in_progress for review? (yes / no / skip)"*
   - `yes` → flip those waves back to `in_progress`
   - `no` / `skip` → leave them complete

**Wave changed:**
1. Rewrite `hash:` field
2. Find all features in this wave with `wave_status: complete`
3. Prompt: *"Wave file edited since these features were completed: [list]. Flag for review? (yes / no)"*
   - `yes` → add a `known_issues` entry to each feature doc: *"Wave file was manually edited after this feature completed — review for consistency."*

**New file (no hash):**
1. Write computed hash to `hash:` field — no other changes

Rebuild `.mdd/.startup.md`.

Report:
```
✅ plan-sync complete

  auth-system.md            — no change
  auth-system-wave-1.md     — hash updated, 2 features flagged
  billing-module.md         — hash written (new file)
```

---

## PLAN-REMOVE-FEATURE MODE — `/mdd plan-remove-feature <wave-slug> <feature-slug>`

Triggered when arguments start with `plan-remove-feature`.

### Phase PRF1 — Load and validate

1. Parse `<wave-slug>` and `<feature-slug>` from arguments.
2. Read wave doc — hard stop *"Wave does not exist"* if not found.
3. Find the feature row — hard stop *"Feature `<slug>` does not exist in wave `<wave-slug>`"* if not found.
4. **Dependency guard:** check if any other feature in the wave lists `<feature-slug>` in its `Depends on` column. If so → hard stop: *"`<other-feature>` depends on `<feature-slug>`. Remove or reassign that dependency first."*

### Phase PRF2 — Confirm and remove

Show summary:
```
Remove feature from wave?

  Feature:  auth-login
  Wave:     auth-system-wave-1
  Doc:      docs/02-auth-login.md (draft)
  Status:   planned

Remove from wave? (yes/no)
```

If yes and a feature doc exists: *"Archive feature doc? (yes/no)"*

If confirmed:
1. Remove the feature row from the wave doc table.
2. Renumber the `#` column sequentially (cosmetic — `Depends on` uses slugs, not numbers, so renumbering is safe).
3. If archiving doc: move to `.mdd/docs/archive/`, set `status: archived`, `wave_status: archived`.
4. Recompute and update `hash:` on wave doc.
5. Tell user: *"Re-run `/mdd plan-execute <wave-slug>` to continue the wave."*

Rebuild `.mdd/.startup.md`.

---

## PLAN-CANCEL-INITIATIVE MODE — `/mdd plan-cancel-initiative <slug>`

Triggered when arguments start with `plan-cancel-initiative`.

### Phase PCI1 — Load

1. Parse `<slug>` — hard stop *"Initiative does not exist"* if `initiatives/<slug>.md` not found.
2. Read initiative doc. Count: waves, wave statuses, associated feature docs (those with `initiative: <slug>` frontmatter).

### Phase PCI2 — Confirm

Show summary:
```
Cancel initiative: Auth System

  Status:        active
  Waves:         3 (1 complete, 2 active)
  Feature docs:  5 created

Cancel this initiative? (yes/no)
```

If yes:

### Phase PCI3 — Cancel

1. Set `status: cancelled` in initiative frontmatter. Recompute hash.
2. Ask: *"Archive wave docs? (yes/no)"* — if yes, move all wave files to `.mdd/waves/archive/`
3. Ask: *"Flag feature docs with a warning? (yes/no)"* — if yes, add to each associated feature doc's `known_issues`: `"Initiative <slug> was cancelled — review whether this feature is still needed."`

Rebuild `.mdd/.startup.md`.

Report:
```
✅ Initiative cancelled: auth-system

  Status set: cancelled
  Wave docs: archived (3 files)
  Feature docs: 5 flagged with known_issues warning
```

---
