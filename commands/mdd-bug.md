## BUG MODE

**Trigger:** `/mdd bug <description>`

The user is reporting a bug in an existing feature. Do NOT create a new feature doc.
Instead: scan existing docs to identify which feature(s) own the broken behavior,
document the bug in those docs, fix it, and mark it complete.

---

### Phase B0 — Parse

Extract the bug description from `$ARGUMENTS` by stripping the leading `bug ` prefix.
Store as `$BUG_DESC`.

If `$BUG_DESC` is empty after stripping, ask the user:
> "What is the bug? Describe what's broken and where you'd expect it to work correctly."

---

### Phase B1 — Triage

Read the frontmatter of every file in `.mdd/docs/` (excluding `archive/` subdirectory).
Do **not** read doc bodies during triage — frontmatter only. You need: `id`, `title`, `tags`, `source_files`.

**Scoring algorithm** — for each doc, compute a match score against `$BUG_DESC`:

1. Tokenize `$BUG_DESC` into significant words (strip: a, an, the, is, it, in, on, for, and, or, to, with, that, this, when, after, before, not, can, can't, doesn't, won't, fails, fail, fix, bug, issue, broken, error)
2. For each remaining word `W`:
   - If `W` appears in the doc's `tags` list (case-insensitive) → +2
   - If `W` appears in the doc's `title` (case-insensitive) → +1.5
   - If `W` appears in any `source_files` entry (file name only, not path) → +1
3. Round score to 1 decimal place
4. Threshold: score ≥ 2.0 qualifies as a candidate

Sort candidates descending by score.

**If zero docs score ≥ 2.0**, display:

```
🔍 No feature docs matched: "<$BUG_DESC>"

This could mean:
  - The bug is in undocumented code (run /mdd reverse-engineer first to document it)
  - The description uses different words than the feature tags (try feature names or file names)
  - This is a new undocumented area (use /mdd <description> to create a feature doc first)

Documented features:
  <list all feature IDs and titles from .mdd/docs/>

Run /mdd status to see the full project overview.
```

**STOP — do not proceed past Phase B1 without at least one confirmed related doc.**

---

### Phase B2 — Confirm Related Docs

Present the triage results and ask the user to confirm which docs the bug relates to.
Always show the full doc list so the user can add docs that scored below the threshold.

Ask via AskUserQuestion with `multiSelect: true`:

```
Question: "Which feature docs does this bug relate to?"

Header: "Related docs"

Show as options:
  - Top candidates (score ≥ 2.0): label = "<id> — <title> (score: N)", description = "Matched on: <which tags/title words matched>"
  - Remaining docs (score < 2.0): label = "<id> — <title>", description = "Low match — include if relevant"
```

Require at least one selection. If the user selects none, ask again.

Store the confirmed list as `$RELATED_DOCS`.

---

### Phase B3 — Document the Bug

For each doc in `$RELATED_DOCS`:

1. Read the full doc file
2. Generate the next bug ID for this doc:
   - If a `## Bugs` section exists: find the highest existing B-number and increment by 1
   - If no `## Bugs` section exists: start at B1
3. Create the bug entry row:

```
| B<N> | <$BUG_DESC> | Open | - | <today YYYY-MM-DD> | - |
```

4. **If `## Bugs` section already exists** in the doc:
   - Append the new row to the existing table
   - Do not modify any existing rows

5. **If `## Bugs` section does not exist** in the doc:
   - Insert the entire section after `## Known Issues` (if present), or after the last `##` section if not
   - Never insert before `## Purpose`, `## Architecture`, `## Business Rules`, or `## Data Model`
   - Use this format:

```markdown
## Bugs

| ID | Description | Status | Fixed In | Reported | Fixed |
|----|-------------|--------|----------|----------|-------|
| B1 | <$BUG_DESC> | Open | - | <today> | - |
```

6. **If the bug spans multiple docs**: each doc gets its own entry with the same description and its own sequential B-ID. Entries are independent per-doc — they are not cross-referenced at this stage.

After updating all related docs, tell the user:

```
📝 Bug documented in <N> feature doc(s):
   <id>  →  B<N> added  (<title>)
   ...

Status: Open — ready to fix.
```

Store the bug IDs per doc as `$BUG_IDS` (map of doc-id → B-number) for use in Phase B5.

---

### Phase B4 — Fix

Ask the user via AskUserQuestion how to proceed with the fix:

```
Question: "How do you want to fix this bug?"

Options:
  (a) Lightweight — identify affected files, fix, verify, done
      description: Best for focused, well-understood bugs. No test scaffolding.
  (b) Full MDD process — test skeletons, red gate, green gate
      description: Best for complex bugs or regression prevention. Follows BUILD MODE phases 4-7.
```

#### Path A — Lightweight Fix

1. **Identify affected files:** Read `source_files` from each doc in `$RELATED_DOCS`. Also grep the `src/` directory for symbols mentioned in `$BUG_DESC`:

```bash
grep -r "<keyword>" src/ --include="*.ts" --include="*.tsx" -l
```

2. **Read each candidate file** to understand the current behavior.

3. **Diagnose:** Before writing any fix, state:
   - What the code currently does
   - Why that causes the reported bug
   - What change will fix it
   - What could break as a side effect

4. **Fix:** Make the minimal targeted change. Do not refactor surrounding code.

5. **Verify:** Run the project's typecheck and test commands:

```bash
pnpm typecheck
pnpm test:unit   # if a test runner is configured
```

   If no test runner: run the compiled CLI or relevant command to confirm the fix works.

6. **Report verification result:**

```
✅ Fix verified:
   Changed: <file>:<line> — <one-line description of change>
   Typecheck: clean
   Tests: <N>/<N> passing  OR  Manual verification: confirmed
```

7. Proceed to Phase B5.

#### Path B — Full MDD Process

Follow **mdd-build.md Phases 4 through 7** for the fix. Treat the related feature docs as the documentation — skip Phase 3 (no new doc). Skip Phase 1 and 2 entirely.

Specifically:
- **Phase 4** (test skeletons): write failing tests that reproduce the bug
- **Phase 4b** (red gate): confirm all new tests fail before fixing
- **Phase 5** (build plan): plan the fix blocks
- **Phase 6** (implement): fix the bug, run green gate per block
- **Phase 7** (verify + report): integration verification, completion signal

At the end of Phase 7, return here to Phase B5 to mark the bug complete in the docs.

---

### Phase B5 — Mark Complete

After the fix is verified (via either Path A or Path B), update every doc in `$RELATED_DOCS`:

For each doc, find the bug entry created in Phase B3 (use `$BUG_IDS` to find the right B-number):

1. Change `Open` → `Completed` in the Status column
2. Fill in `Fixed In` with `<file>:<line>` of the primary fix location
   - If the fix spans multiple files, use the file where the root cause was addressed
   - For docs where the fix was in a different feature's files: use `see <other-doc-id>:B<N>` instead
3. Fill in the Fixed date column with today's date

**Example — before:**
```
| B2 | Users can't log in after password reset | Open | - | 2026-05-17 | - |
```

**Example — after:**
```
| B2 | Users can't log in after password reset | Completed | src/auth.ts:142 | 2026-05-17 | 2026-05-17 |
```

After updating all docs, regenerate `.mdd/connections.md` using the same logic as BUILD MODE Phase 7c:
- Read all `.mdd/docs/*.md` frontmatter only
- Rebuild path tree, Mermaid graph, source file overlap, warnings
- Write to `.mdd/connections.md`

Display the completion signal:

```
✅ Bug fixed and documented:

Bug:       <$BUG_DESC>
Fixed in:  <file>:<line>

Docs updated:
  <id>  B<N>  Completed  (<title>)
  ...

Connections: .mdd/connections.md updated

Branch: <current branch>
Ready for review — run `git diff main...HEAD` to see all changes.
```

Then ask the user via AskUserQuestion:

```
Question: "Ready to commit?"
Options:
  (a) Commit & merge to main
  (b) Commit only — stay on this branch
  (c) Skip — I'll handle git manually
```

Follow the same commit/merge logic as BUILD MODE Phase 7d.
