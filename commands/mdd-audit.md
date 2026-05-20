## AUDIT MODE — `/mdd audit [section]`

Triggered when arguments start with `audit`.

### Phase A1 — Scope

```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A1" start "$AUDIT_TARGET"
```

**Stale job detection (runs first):** Check `.mdd/jobs/` for any existing `audit-*/` folder.
- If found: check whether a corresponding `audits/report-<date>.md` exists.
  - If yes: job completed but cleanup failed — delete the stale jobs folder and proceed normally.
  - If no: job was interrupted — read `MANIFEST.md` from the jobs folder and count complete vs total entries. Present to user:
    ```
    Found interrupted audit from <date>.
    MANIFEST shows <done>/<total> files complete.

      [R] Resume — continue from where it left off
      [D] Discard — delete and start fresh
    ```
  - Resume: reuse the existing job folder, existing agent notes, pick up from the first `[ ]` in the manifest. Files already marked `[x]`, `[!]`, or `[e]` are never re-processed. Skip to Phase A3.
  - Discard: delete the jobs folder, proceed normally.

**Scope resolution:**
1. **Read all `.mdd/docs/*.md` files** — build the feature map. Also read all `.mdd/ops/*.md` files — check for: missing mandatory sections, literal credential values (critical violation), stale `last_synced`, services with no `health_check` defined.
2. **If no `.mdd/` directory exists:** Create it with `docs/`, `audits/`, `ops/`, and `jobs/` subdirectories. Then tell the user: "No MDD documentation found. Run `/mdd` for each feature to create docs first, or I can scan the codebase and create them now. Which do you prefer?"
   - If "scan": read all source files and generate documentation files (Phase 0)
   - If "manual": exit and let the user create docs per feature
3. Resolve every source file referenced across all feature docs. Deduplicate (same file may appear in multiple feature docs).

**Feature doc cross-checks (run in Phase A1, before any agents are spawned):**

These checks require comparing feature docs to each other and to disk. They cannot be done by per-file agents and must be done here:

- For each feature, verify every path in `source_files` exists on disk. Missing files = P2 finding.
- For each feature with `depends_on` that includes a feature with `integration_contracts`: verify this feature's `satisfies_contracts` is not empty. Missing acknowledgment = P2 finding.
- For each feature with `satisfies_contracts` entries where `status: pending`: flag every pending entry as P1 — contract was documented but never wired.
- For each feature with `integration_contracts`: verify every listed `caller_feature` exists as a feature doc. Non-existent caller referenced = P3 finding.

Record all findings from this step in a dedicated `audits/doc-findings-<date>.md` file. These are merged into the final report in Phase A5 as a separate "Feature Doc Issues" section.

**Incremental vs full (only when a previous completed audit exists):**
```
A completed audit exists from <date>.

  [F] Full audit — regenerate manifest from all source files
      Use when: significant new code added, want a clean baseline, or last audit was >2 weeks ago
  [I] Incremental — manifest contains only files whose content changed since last audit
      Use when: applied fixes and want to verify them, or auditing only a new feature
```

For incremental scope, use git to detect truly changed files — not mtime, which is unreliable:
```bash
git diff --name-only <last-audit-commit>   # files changed since audit commit
git ls-files --others --exclude-standard   # untracked new files
```
If no audit commit is recorded, fall back to files modified after `audits/MANIFEST-<date>.md` mtime.
Store the current HEAD commit in the job folder (`job-commit.txt`) so future incremental audits have an exact reference point. Files modified and then reverted will NOT appear in the diff — correct behaviour.

**Agent scaling:**

| Files in scope | Agents |
|---|---|
| < 10 | 1 (Single-Feature Audit Mode — see below) |
| 10–25 | 2 |
| 26–50 | 3 |
| 51–100 | 5 |
| 100+ | 8 (default ceiling) |

Default ceiling is 8. Overridable via `MDD_MAX_AGENTS` environment variable. Values below 1 fall back to 1. The scale table still determines count within the ceiling — `MDD_MAX_AGENTS` only raises or lowers the cap.

**Shard sizing:** Balanced by estimated token load (file size), not raw file count. Main inspects file sizes before assigning and redistributes to keep shards roughly equal in estimated read cost.

**Create the job folder and write MANIFEST.md (nothing else proceeds until the manifest exists on disk):**

Create `.mdd/jobs/audit-<date>/` and write `MANIFEST.md`:

```markdown
# Audit Manifest
# Job: audit-<date>
# Generated: <ISO timestamp>
# Total files: <N>
# Agents: <N>
# Status: IN PROGRESS
#
# States: [ ] pending  [~] in progress  [x] complete  [!] findings  [e] error

## Shard 1 (Agent 1) — files 1-<N>
[ ] src/handlers/auth.ts
[ ] src/handlers/users.ts
...

## Shard 2 (Agent 2) — files <N+1>-<M>
[ ] src/handlers/billing.ts
...
```

---


```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A1" end "$AUDIT_TARGET"
```
### Phase A2 — Per-Agent Config Setup

```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A2" start "$AUDIT_TARGET"
```

Main writes a shard file and config file for each agent into the job folder **before spawning anything**.

**`shard-N.md`** — flat list of files assigned to this agent, extracted from the manifest. The agent uses this to know its scope without parsing the full manifest.

**`integration-context.md`** — built once by main from all `.mdd/docs/*.md` files and written to the job folder. Every agent reads this at startup. Format:

```markdown
# Integration Context
# Job: audit-<date>

## Feature Source Files
<!-- Maps source files back to the feature that owns them -->
<feature-name>: src/foo.ts, src/bar.ts
<feature-name>: src/baz.ts

## Integration Contracts
<!-- What each security/shared feature requires ALL callers to implement -->
<!-- "Caller source files" = look up each caller_feature name in "Feature Source Files" above and list those files -->
### <feature-name>
- Contract: <description of what caller must call/implement>
  Caller features: <featureA>, <featureB>
  Caller source files: src/a.ts, src/b.ts, src/c.ts

## Satisfied Contracts
<!-- What each feature has acknowledged and wired -->
### <feature-name>
- Satisfies: <other-feature> contract — status: <done|pending>
```

If no feature has `integration_contracts`, write an empty file with `# No integration contracts defined`. This file is always created — agents must not fail if it is empty.

**`agent-N-config.md`** format:

```markdown
# Agent <N> Audit Config

## Identity
You are Audit Agent <N> of <total>.
Job: audit-<date>

## Paths (relative to project root)
Shard file:            .mdd/jobs/audit-<date>/shard-<N>.md
Notes file:            .mdd/jobs/audit-<date>/agent-<N>-notes.md
Manifest:              .mdd/jobs/audit-<date>/MANIFEST.md
Integration context:   .mdd/jobs/audit-<date>/integration-context.md

## Rules
- Write findings to your notes file ONLY. Never touch another agent's file.
- Mark each file in MANIFEST before clearing context.
- Clear context after every single file — no exceptions.
- On every startup (including post-clear): follow STARTUP SEQUENCE below.

## Standard Audit Criteria (apply to every file)

### P1 Critical
- `eval()` used anywhere — only `vm.runInNewContext` is permitted
- Cloud metadata endpoints (169.254.169.254, 169.254.170.2, fd00:ec2::254, metadata.google.internal) reachable without block
- Secrets, API keys, or credentials hardcoded in source
- Security enforcement function required by a dependency contract is absent from this file — two-step check: (1) find this file under "Feature Source Files" in `integration-context.md` to identify its owning feature; (2) scan "Integration Contracts" for any contract where this file's owning feature appears under "Caller features" — those are contracts this file must satisfy. Verify each required call is present.
- "Immutable" rule arrays exported as plain mutable arrays — not `Object.freeze()` + `readonly`
- Untrusted MCP/API/CLI input used without validation or sanitization
- Data cached or stored without masking applied first
- Local reimplementation of security logic — any function named `isConfined`, `isAllowed`, `isSafe`, `isBlocked`, or similar that replicates what a documented security module already provides. Require replacement with the canonical security module function.
- Contract function undefined — if `integration_contracts` specifies a function name, grep the entire package for that name as an export. If the function does not exist anywhere, flag P1 regardless of whether call sites are present.

**Note:** `satisfies_contracts status: pending` is checked by main in Phase A1, not here — agents cannot read feature docs.

### P2 High
- TypeScript `any` used — must use `unknown` with narrowing
- Missing `.js` extension on ESM imports in src/ files (NodeNext resolution)
- `console.log` in library code (should use logger)
- File exceeds 300 lines
- Function exceeds 50 lines
- Transformation/substitution function handles some but not all AST/domain types (silent fallthrough for unhandled types)
- Switch on a string-union type or operation enum with no `default:` case, or where `default:` returns a value rather than throwing. Check all `switch` statements in execution, adapter, and transformation code. Approved pattern: `default: throw new Error(\`unhandled type: \${x satisfies never}\`)` — the `satisfies never` check produces a compile error when a new variant is added without updating the switch.
- MCP-exposed function accepts untrusted params with no explicit validation
- Security parameter never passed — if a function accepts a policy param (allowedKeys, blockedDomains, securityConfig, etc.) that must come from a caller, verify the caller passes a non-empty, non-null value. If the parameter always arrives as `undefined`, `null`, or `[]`, the enforcement is a no-op.

### P3 Medium
- TypeScript strict mode not enabled in tsconfig
- Missing error handling at system/user-input boundaries
- Missing test cases for documented business rules
- CLI command missing any of the universal flags (--env, --cwd, --verbose, --strict, --silent) — check all commands against the CLI feature doc's universal flags requirement
- `file.*` filesystem helpers or path-resolving functions accept arbitrary paths without confinement to a documented jailRoot
- Code that constructs a `SecurityConfig` or equivalent security object sets `jailRoot: null`. A null jailRoot disables filesystem confinement — the default should be the document's directory (`dirname(resolvedPath)`), not `null`, unless the caller explicitly provides an override.
- `String.replace()` uses a captured group reference (`$1`, `$2`, etc.) in the replacement argument where the captured value originates from untrusted input. Values containing `$1`, `$&`, `$'`, etc. are silently mangled by JavaScript's substitution semantics. Sanitize with `.replace(/\$/g, '$$$$')` before interpolating into a replacement string.
- Silent error swallow: catch block returns empty/undefined without pushing to warnings array
- Template/substitution function matches `{{varname}}` without spaces but not `{{ varname }}` with spaces — spec uses spaced form; use regex `\s*` not exact string

**Note:** Feature-doc cross-checks (source_files on disk, integration_contracts vs satisfies_contracts) are handled by main in Phase A1 — not by per-file agents. Do not duplicate those checks here.

### P4 Low
- Code style inconsistencies
- Dead code / unused imports
- Minor spec divergences

## Startup Sequence
1. Read this config file
2. Read shard-<N>.md to know your file list
3. Read MANIFEST.md — find the first [ ] entry in Shard <N>
4. Read the last 20 lines of agent-<N>-notes.md for continuity
5. Read integration-context.md — load this into working memory. Use it when checking P1: (a) find this file under "Feature Source Files" to identify its owning feature; (b) scan "Integration Contracts" for any entry where that feature appears under "Caller features" — those are the contracts this file must satisfy.
6. Begin the per-file loop at that first [ ] entry
```

This config file contains no source code or findings — only paths and instructions. It is the only thing an agent needs to resume correctly after a context clear.

---


```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A2" end "$AUDIT_TARGET"
```
### Phase A3 — Parallel Agent Execution

```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A3" start "$AUDIT_TARGET"
```

Main spawns all agents simultaneously. Each agent receives only the path to its config file.

**Per-file loop (each agent follows exactly):**

```
STARTUP (run on every fresh start and after every context clear):
  1. Read agent-N-config.md
  2. Read shard-N.md
  3. Read MANIFEST.md — find first [ ] in own shard
  4. Read last 20 lines of agent-N-notes.md for continuity
  5. Read integration-context.md — holds feature ownership map and all integration contracts
  6. Begin per-file loop

PER-FILE LOOP:
  1. Mark file as [~] in MANIFEST.md        ← write to disk first
  2. Read the source file fully
  3. Analyze against audit criteria
  4. Append to agent-N-notes.md:
       ## src/handlers/auth.ts
       <findings, or "No issues found">
       Contracts: <explicit result for every contract that applies to this file>
         - [feature-name] contract: SATISFIED — [function name] called at line N
         - [feature-name] contract: VIOLATION — required call absent (P1)
         - (none) — no contracts apply to this file per integration-context.md
  5. Mark file as [x] or [!] in MANIFEST.md ← [!] = has findings
  6. Clear context                           ← every file, no exceptions
  7. On restart: run STARTUP above

The Contracts line is mandatory for every file. It allows Phase A6 to distinguish
"agent checked and confirmed satisfied" from "agent never checked." If integration-context.md
shows no contracts apply to this file, write "(none)" — never omit the line entirely.
```

**Hard rules:**
- Write to own notes file ONLY — never another agent's file
- Checkpoint order: mark `[~]` → read → analyze → write notes → mark `[x]`/`[!]` → clear. Never clear before the final mark.
- If a file cannot be read (missing, binary, too large): mark `[e]` in manifest, append one-line error to notes, proceed to next file
- Skip any file already marked `[x]`, `[!]`, or `[e]` — never re-process

**Why clear after every file:** Every file gets a full, fresh context window with maximum analysis budget. The notes file and manifest are the memory — the analysis does not need to survive the clear.

**Why mark `[~]` before reading:** A stuck `[~]` is re-processed at convergence. Duplicate analysis is better than missing analysis.

---


```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A3" end "$AUDIT_TARGET"
```
### Phase A4 — Convergence Check

```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A4" start "$AUDIT_TARGET"
```

After all agents signal completion, main reads `MANIFEST.md` and checks for any `[ ]` or `[~]` entries.

- **`[ ]` entries:** agent never reached this file — re-run that agent's shard for remaining files
- **`[~]` entries:** agent cleared between `[~]` mark and final mark — re-process that file
- **`[e]` entries:** main attempts to read the file itself; if still unreadable, it remains `[e]` and is flagged in the final report as unaudited with the reason

Audit does not advance to Phase A5 until every file is `[x]`, `[!]`, or `[e]`.

---


```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A4" end "$AUDIT_TARGET"
```
### Phase A5 — Merge

```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A5" start "$AUDIT_TARGET"
```

Main merges all agent notes into the canonical output file:

1. Read `MANIFEST.md` to get canonical file order
2. For each file in manifest order, locate its `## <filepath>` section in the correct agent notes file
3. Append to `audits/notes-<date>.md` in that order
4. If `audits/doc-findings-<date>.md` exists and is non-empty, append its contents to `audits/notes-<date>.md` under a `## Feature Doc Issues` header
5. Verify entry count in `audits/notes-<date>.md` matches manifest file count (doc findings are supplemental — they don't affect the per-file count)

Merge is in manifest order, not agent completion order. The job folder is not touched during or after merge — all temp files remain until the report is confirmed in Phase A6.

---


```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A5" end "$AUDIT_TARGET"
```
### Phase A6 — Analyze

```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A6" start "$AUDIT_TARGET"
```

Read `audits/notes-<date>.md` as the primary source. Produce `audits/report-<date>.md` — include `mdd_version: <current from mdd.md frontmatter>` as the first line of frontmatter.

**Source code access in this phase:** Standard synthesis (items 1-8 below) uses only the notes file. The integration contract verification step that follows may re-read specific source files — that is the only exception, and it is mandatory.

1. Executive summary
2. Feature completeness matrix
3. Findings by severity (P1 Critical / P2 High / P3 Medium / P4 Low)
4. Test coverage summary
5. Fix plan with effort estimates and affected files per finding
6. Root Cause Analysis — for each cluster of findings, explain WHY the code writer made the mistake (not just what is wrong). Common root causes: "security module built in isolation without integration contracts," "immutability described in spec but not enforced at the code level," "MCP tool written without a threat model," "node type added after transformation function was written."
7. Prevention Rules — derive concrete, actionable rules that would have prevented each finding cluster. Format: "When implementing X, always Y. Never Z. Reasoning: [which finding caused this]." These rules are proposed for addition to CLAUDE.md at the end of the audit.
8. MDD Workflow Self-Improvement — for each finding, ask: "Could the MDD audit criteria, build phase requirements, or doc field definitions have caught or prevented this?" Only flag patterns that would recur across different projects — skip purely project-specific issues (business logic, naming, one-off mistakes). Classify each as:
   - `[criteria-gap]` — not covered by current audit criteria; suggest exact wording for a new P1/P2/P3/P4 rule
   - `[criteria-ambiguous]` — covered in criteria but wording too vague to reliably catch; suggest sharper wording or a concrete example
   - `[build-gap]` — the build phase doc or test requirements should have forced something that would have prevented this; suggest the exact addition to mdd-build.md
   - `[doc-field-gap]` — a new feature doc frontmatter field would have surfaced this earlier; suggest the field name and schema
   For each item, name the exact MDD file and section that needs changing.

**Integration contract verification (proactive — does not depend on what agents flagged):**

This step runs independently of agent findings. It uses `integration-context.md` from the job folder (already built in Phase A2) and re-reads specific source files as needed. The "Read ONLY notes" constraint applies to standard synthesis only — this step may re-read source files.

For each contract in `integration-context.md`:
1. Identify all source files listed under "Caller source files" for that contract
2. For each such source file, check the job folder's `MANIFEST.md` for that file's status — the permanent copy at `audits/MANIFEST-<date>.md` does not exist yet at this stage (it is written after Phase A6 completes). If the file is marked `[e]`, skip contract verification for it and note in the Contract Violations section: "Could not verify — file was unreadable during audit."
3. For files not marked `[e]`, find the file's `## <filepath>` entry in `audits/notes-<date>.md` and read the `Contracts:` line:
   - `SATISFIED` — agent confirmed the call is present. No action.
   - `VIOLATION` — agent flagged it. Include as P1 in Contract Violations section.
   - `(none)` written but this file IS a caller per integration-context.md — agent made an error. **Re-read that source file now** and check independently.
   - `Contracts:` line is missing entirely — agent ran before this version of the workflow. **Re-read that source file now** and check independently.
4. Report each confirmed gap as P1. Note whether it was caught by the agent or discovered by Phase A6.

Additionally read all `.mdd/docs/*.md` to catch any cases the Phase A1 doc cross-check might have missed (e.g., docs added after Phase A1 ran, or pending contracts that weren't flagged):
- Any `satisfies_contracts` with `status: pending` not already in doc-findings = P1
- Any `depends_on` with `integration_contracts` and empty `satisfies_contracts` not already in doc-findings = P2

Report all findings from this step as a "Contract Violations" section before the standard findings table.

**Once `audits/report-<date>.md` is confirmed written and non-empty:**
1. Copy `jobs/audit-<date>/MANIFEST.md` → `audits/MANIFEST-<date>.md`
2. Delete entire `jobs/audit-<date>/` folder

The manifest is kept permanently in `audits/` — `[x]` vs `[!]` per file shows what had findings without parsing the full notes file.

---


```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A6" end "$AUDIT_TARGET"
```
### Phase A7 — Present Findings + Fix

```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A7" start "$AUDIT_TARGET"
```

Show the user:
```
🔍 MDD Audit Complete

Findings: <N> total (<N> P1 Critical, <N> P2 High, <N> P3 Medium, <N> P4 Low)
Report: .mdd/audits/report-<date>.md
MANIFEST: .mdd/audits/MANIFEST-<date>.md (<N> files with findings / <total> audited)

Top issues:
  1. <most critical finding>
  2. <second most critical>
  3. <third most critical>

Estimated fix time: <N> hours (traditional) → <N> minutes (MDD)

Fix all now? (yes / review report first / fix only P1+P2)
```

**After the report is written**, run a tag pass before the startup rebuild: for any `.mdd/docs/*.md` or `.mdd/ops/*.md` file missing a `tags:` field, generate and write tags now (same logic as Phase RT2 in REBUILD-TAGS MODE). Docs that already have `tags:` are untouched. Then regenerate `.mdd/connections.md` (same logic as Phase 7c in BUILD MODE — path tree, Mermaid graph, source overlap, warnings). Then trigger the `.mdd/.startup.md` rebuild (same logic as in Status Mode — rebuild auto-generated zone, preserve Notes zone) so the Last Audit block, connections graph, and tag-enriched feature list are all current.

If user says yes (or selects a subset):

**Fix loop:**

Detect test runner once from `package.json` scripts (look for `test:unit`, `test`, `vitest`, `jest`, `pytest`, `go test`). Identify the file-scope flag for that runner:
- Vitest / Jest: `pnpm test:unit -- <path/to/file.test.ts>`
- pytest: `pytest <path/to/test_file.py>`
- Go: `go test ./<package>/...`

For each finding to fix:
1. Read the specific source file(s)
2. Apply the fix
3. Write or update the corresponding test file(s)
4. Run ONLY the test file(s) that cover the changed source — not the full suite.
   Derive test path from source path by convention (e.g. `src/foo/bar.ts` → `tests/unit/foo/bar.test.ts`).
   If the mapping is ambiguous, grep for imports of the changed file to find the right test.

After ALL findings are fixed: run the full test suite once as a regression check.

Report progress per finding. Update documentation `known_issues` to remove fixed items. Update `mdd_version` to current on every `.mdd/docs/*.md` file that is edited during fixes.

**After fixes are complete and results are written to `.mdd/audits/results-<date>.md`**, run the same tag pass (generate missing tags for any doc still lacking them), regenerate `.mdd/connections.md`, then trigger the `.mdd/.startup.md` rebuild so the Last Audit block, connections graph, and tag list all reflect the final state.

---


```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A7" end "$AUDIT_TARGET"
```
### Phase A8 — MDD Self-Review

```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A8" start "$AUDIT_TARGET"
```

Runs at the end of every audit, after fixes (or immediately after A7 if user chose not to fix now).

**Opt-in gate — check before doing anything else:**
Read `.claude/settings.json` (local install) or `~/.claude/settings.json` (global install).
- If `mdd.selfImprovement === false`: skip Phase A8 entirely. Do not log, do not ask, do not mention it.
- If `mdd.selfImprovement === true` or the key is absent: proceed normally.

**Step 1 — Extract self-improvement items**

Read the "MDD Workflow Self-Improvement" section from `audits/report-<date>.md`. If there are zero items, skip to Step 3 with a one-line note.

**Step 2 — Append to persistent learnings log**

Append to `.mdd/audits/mdd-learnings.md` (create if it does not exist):

```markdown
## <date> — <audit-scope> (<N> workflow items)

### [<classification>] <short title>
- **Finding**: <what was found in the project>
- **Severity**: <P1/P2/P3/P4> — <N> instance(s)
- **Why MDD missed it**: <one sentence>
- **Suggested MDD change**: <exact rule wording or field name to add>
- **Affects**: `<mdd-file.md>` — <section name>
- **Status**: pending
```

Classifications: `criteria-gap` | `criteria-ambiguous` | `build-gap` | `doc-field-gap`

Never overwrite existing entries. Each audit appends its own dated block. Entries with `Status: pending` are unactioned improvements waiting for a GitHub issue or patch.

**Step 3 — Present to user**

```
🔧 MDD Workflow Self-Review

<N> patterns found that MDD could prevent in future projects:

  1. [criteria-gap]    <short title> — add P2 rule to mdd-audit.md
  2. [build-gap]       <short title> — update Phase 3 docs in mdd-build.md
  3. [criteria-ambiguous] <short title> — sharpen P1 wording in mdd-audit.md
  ...

Logged to: .mdd/audits/mdd-learnings.md

Open a GitHub issue for these improvements?
  [Y] Yes — open issue at https://github.com/TheDecipherist/mdd/issues
  [D] Draft — show me the issue text first
  [N] No — skip for now
```

**If user selects [Y] or [D]:**

Compose a GitHub issue with:
- **Title**: `Audit self-review: <N> workflow gaps found (<date>)`
- **Body**:
  - One paragraph summary of the audit context (project type, scope)
  - Numbered list of each improvement item with classification, the exact MDD file/section, and the suggested fix
  - A "Proposed changes" section with ready-to-apply rule wording for each `criteria-gap` and `criteria-ambiguous` item

If [D]: display the draft and ask "Open this issue? (yes / edit / cancel)".
If [Y]: open the issue immediately using `gh issue create`.

After the issue is opened, update the `Status` field of each logged entry in `mdd-learnings.md` from `pending` to `issue: #<number>`.

---

### Single-Feature Audit Mode

When running `/mdd audit <section>` with fewer than 10 resolved files, skip the shard/config/agent system. Main conversation runs the per-file loop directly — context clear between each file, writing to a single `agent-1-notes.md` in the job folder. The job folder structure and completion sequence are otherwise identical.

**Integration context still applies in this mode.** Before starting the per-file loop, build `integration-context.md` into the job folder using the same logic as Phase A2 (read all `.mdd/docs/*.md`, extract contracts and feature-to-file mappings). Read `integration-context.md` at the start of the per-file loop and after every context clear — identical to the multi-agent startup sequence. The mandatory `Contracts:` line in notes applies here too.

---


```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "Phase A8" end "$AUDIT_TARGET"
```

```bash
bash ~/.claude/hooks/mdd-log-phase.sh "mdd-audit" "-" "complete" "$AUDIT_TARGET"
```