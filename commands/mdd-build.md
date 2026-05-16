## BUILD MODE — New Feature Development

### Phase 0 — Branch Safety Check

Before gathering any context, verify the current branch is compatible with the requested feature.

```bash
BRANCH=$(git branch --show-current)
AHEAD=$(git log --oneline main..HEAD 2>/dev/null | wc -l | tr -d ' ')
```

**Skip this check entirely if:**
- Branch is `main` or `master` — auto-branch (end of this file) will create the right branch
- Branch starts with `fix/mdd-audit-` — it is an audit branch, not a feature branch
- Branch name contains significant keywords from `$ARGUMENTS` — it is a match

**Detect a mismatch:**

Derive a slug from `$ARGUMENTS` (e.g., "add payment system" → `payment-system`).  
Strip the branch prefix (`feat/`, `fix/`, `refactor/`, etc.) to get the branch's feature name.  
If the two names share fewer than half of their significant words → mismatch detected.

**If a mismatch is detected**, ask the user via AskUserQuestion:

```
⚠️  Branch mismatch detected

You are currently on: <branch-name>
Commits ahead of main: <N>

The feature you are starting ("<$ARGUMENTS>") does not appear to match this branch.

MDD expects one feature per branch. Mixing unrelated features on the same branch
makes PR review, rollback, and history harder — and breaks the MDD workflow.

What would you like to do?

  (a) Commit, merge, and branch fresh (recommended)
      Stage current changes → commit → merge <branch-name> to main → create feat/<new-slug>
  (b) Continue on this branch anyway
      Work on the new feature here (not recommended — mixes features)
  (c) Abort
      Stop so I can handle git manually
```

**If (a) — Commit, merge, and branch fresh:**
1. `git add -A` — stage all current changes
2. Use the `/commit` skill to generate a conventional commit message
3. Commit the staged changes
4. `git checkout main`
5. `git merge <branch-name> --no-ff -m "Merge <branch-name>: <feature summary>"`
6. Ask: "Push `<branch-name>` to origin now? (yes / no)"
   - If yes: `git push origin main`
7. `git checkout -b feat/<new-feature-slug>`
8. Report: "✅ Merged and branched to `feat/<new-feature-slug>`. Continuing with your MDD task..."
9. Proceed to Phase 1.

**If (b) — Continue on this branch anyway:**
- Report: "⚠️  Continuing on `<branch-name>` — consider merging this branch before opening a PR."
- Proceed to Phase 1.

**If (c) — Abort:**
- Report: "Aborted. Commit your current work, merge `<branch-name>` to main, then re-run `/mdd $ARGUMENTS` on a fresh branch."
- Stop.

### Phase 1 — Understand the Feature

Read the user's description: **$ARGUMENTS**

Before writing anything, gather context using **3 parallel Explore agents**. Launch all three simultaneously — do not wait for one before starting the others:

**Agent A (Rules):** Read `CLAUDE.md` and `project-docs/ARCHITECTURE.md`. Return: key coding rules, quality gates, port assignments, architecture summary, any project-specific conventions relevant to this feature.

**Agent B (Features):** Glob `.mdd/docs/*.md` and read each. Return: list of existing feature IDs + titles + status + `depends_on` chains. Flag any features that might relate to `$ARGUMENTS`. Separate task docs (`type: task`) from feature docs — return them as a distinct list. Task docs must NOT appear in the depends_on candidates list presented to the user.

**Agent C (Codebase):** Glob `src/**/*` and list files. Return: directory structure, key files per subdirectory, detected tech stack (framework, DB, test runner).

**Agent prompt requirements (each must be self-contained):** Include the feature description (`$ARGUMENTS`), the project working directory, and an explicit instruction to return a concise summary — not raw file contents. This prevents context explosion.

**After all 3 return:** synthesize into a working context in the main conversation. If any agent fails, silently fall back to direct `Read`/`Glob` for that agent's data — never surface agent failures to the user unless all 3 fail.

**Detect task type before asking questions.** If `src/` has fewer than 3 TypeScript/source files AND the feature description contains words like `workflow`, `command`, `config`, `docs`, `tooling`, `hook`, `script`, or `prompt` — mark as a **tooling task** and skip the database and API questions entirely.

Then ask the user targeted questions using AskUserQuestion. Ask ALL relevant questions upfront in a single interaction — don't spread them across multiple turns:

**Always ask:**
- "Does this feature depend on any existing features?" (list only feature docs — omit task docs, which are one-off and frozen and not valid dependency targets)
- "Are there any edge cases or error scenarios you already know about?"

**Ask only for non-tooling tasks:**
- "Does this feature need database storage? If so, what data does it store?"
- "Does this feature have API endpoints? What operations (create, read, update, delete)?"

**Ask if relevant:**
- "Does this need authentication/authorization?"
- "Does this need real-time updates (WebSocket)?"
- "Does this need background processing (queues, cron)?"
- "Does this integrate with any external services?"

Wait for all answers before proceeding.

### Phase 2 — Data Flow & Impact Analysis

**Skip condition:** If `.mdd/docs/` has no existing files AND `src/` has fewer than 5 source files, skip this phase entirely and note: "Greenfield detected — skipping data flow analysis." Then jump to Phase 3.

Otherwise, use the answers from Phase 1 (depends_on, endpoints, models) to identify which existing files to read. Do NOT scan blindly — read only what the feature will touch or extend.

#### Step 2a — Identify Touched Files

From Phase 1 answers:
- Which existing features does this depend on? → Read their `source_files` from `.mdd/docs/`
- Which endpoints or models does this extend? → Grep `src/` for those names
- Which TypeScript types does this use? → Read `src/types/`

Read each identified file. The goal is to **understand data flows**, not audit code quality.

#### Step 2b — Trace Each Data Value

For every piece of data the new feature will **consume, transform, or display**, document the full chain:

1. **Backend origin** — where is this value computed? What formula or logic? Note the file and line number.
2. **API transport** — what is the exact shape in the API response? Is it typed correctly?
3. **Frontend consumption** — how does the UI receive and use this value? Is there any transformation between the API response and what is displayed?
4. **Parallel computations** — is this same concept computed anywhere else in the codebase? Does it use the same logic?

Write findings to `.mdd/audits/flow-<feature-slug>-<date>.md` as you go. Do not accumulate in memory.

#### Step 2c — Impact Analysis

For each endpoint or function the feature will **modify**, grep for all existing usages:

```bash
grep -r "<endpoint-or-function-name>" src/ --include="*.ts" --include="*.tsx" -l
```

List every file that also consumes what this feature changes. These files may break silently after the change.

#### Step 2d — Gate

Present findings to the user before writing any documentation:

```
🔍 Data Flow Analysis — <feature-name>

Values this feature touches:
  <field-name>
    Computed:  <file>:<line> — <brief description of logic>
    Transport: <HTTP method> <route> → <TypeScript type>.<field>
    Consumed:  <component/file> (<transformation if any>)

Consistency issues:
  ✅ None found
  — OR —
  ⚠️  HIGH: <description of divergence between parallel computations>

Impact:
  Endpoints/functions modified: <list>
  Also consumed by: <list of other files/views>

Data flow doc: .mdd/audits/flow-<feature-slug>-<date>.md
```

Ask the user: **"Proceed with documentation? (yes / adjust scope based on findings / stop)"**

**This gate is mandatory.** Do not proceed to Phase 3 until the user confirms. If consistency issues were found, discuss whether to fix them as part of this feature or track them as pre-existing known issues first.

### Phase 3 — Write the MDD Documentation

Create the feature documentation file at `.mdd/docs/<NN>-<feature-name>.md`.

**Auto-number:** Read `.mdd/docs/` directory, find the highest existing number, increment by 1.

The doc MUST follow this exact structure:

```markdown
---
id: <NN>-<feature-name>
title: <Feature Title>
edition: <project name or "Both">
depends_on: [<list of documentation IDs this feature depends on>]  ← feature docs only; never include task doc IDs (tasks are one-off and frozen)
source_files:
  - <files that will be created>
routes:
  - <API routes if applicable>
models:
  - <database collections if applicable>
test_files:
  - <test files that will be created>
data_flow: <path to .mdd/audits/flow-*.md, or "greenfield" if skipped>
last_synced: <YYYY-MM-DD>
status: draft
phase: <last completed phase name, or "all" when fully built>
mdd_version: <read from mdd.md frontmatter mdd_version field>
tags: [<4-8 domain-concept keywords — systems touched, technology, feature names. NOT file paths>]
path: <Area/Section>
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# <NN> — <Feature Title>

## Purpose

<2-3 sentences explaining what this feature does and why it exists>

## Architecture

<How this feature fits into the system. Include a simple diagram if helpful.>

## Data Model

<Collection/table schema if applicable. Field names, types, constraints, indexes.>

## API Endpoints

<For each endpoint: method, path, auth required, request body, response shape, error cases.>

## Business Rules

<Validation rules, state machines, invariants, edge cases.>

## Data Flow

<For each value this feature consumes or displays: backend computation → API transport → frontend consumption → any UI transformation. "Greenfield" if no existing code was analyzed.>

## Dependencies

<What this feature requires from other features. List by documentation ID.>

## Security

<Only required when this feature: provides a security enforcement function, accepts external/user/MCP input, stores or caches data, spawns processes, or makes network calls. Leave empty otherwise.>

<For security enforcement features: list integration_contracts — which call sites must invoke which functions.>
<For input-accepting features: document trusted vs untrusted input boundary, sanitization requirements, and what a malicious caller could attempt.>
<For caching features: document what masking or sanitization runs before storage.>

## Known Issues

<Empty for new features. Will be populated by future audits.>
```

**CRITICAL:** This documentation is the source of truth. Everything that follows is generated FROM this doc. Take time to make it complete and accurate.

**Always set `last_synced` to today's date** when writing or updating a feature doc. This is what SCAN MODE uses to detect drift. Set `status: draft` for new docs; update to `in_progress` when implementation begins, `complete` when Phase 7 is done.

#### Phase 3a — Integration Contract Resolution (mandatory when `depends_on` is non-empty)

After writing the feature doc, resolve integration obligations from dependencies:

1. For each feature ID in `depends_on`, read its `.mdd/docs/*.md` file
2. Check whether it has `integration_contracts` entries
3. For each contract that applies to the current feature, add it to `satisfies_contracts` as a **placeholder** showing what must be wired:

```yaml
satisfies_contracts:
  - from: <dependency-feature-id>
    function: <function-name>(<args>)
    when: <condition — e.g. "before any file read in executeInclude">
    status: pending  ← change to "verified: <file>:<line>" during Phase 6
```

**Leaving `satisfies_contracts` empty when a dependency has mandatory `integration_contracts` is a build error.** Do not proceed past Phase 3a until all applicable contracts are acknowledged.

**Cross-cutting concerns that always require contract resolution:**
- Any dependency tagged with `security`, `auth`, `masking`, `filesystem`, `audit`, `immutable` — its contracts are always mandatory
- Any dependency that provides a "check before X" or "enforce Y" function — that function must be in your `satisfies_contracts`

During Phase 6 implementation, update each `satisfies_contracts` entry from `status: pending` to `verified: <file>:<line>` as each call site is wired. Phase 7c will verify all entries are `verified` before marking the feature complete.

#### Phase 3b — Special Case Rules

These rules apply regardless of what the feature doc says. They are not optional.

**Immutability rule:** Any spec language describing values as "immutable," "cannot be overridden," "always enforced," or "built-in" requires both:
- `readonly string[]` (or `as const`) TypeScript typing
- `Object.freeze()` applied at definition

Using a plain `const` array is not sufficient and will fail audit.

**MCP and external-caller threat model:** Any feature that exposes functions to MCP clients, CLI users, API callers, or any untrusted external party must include a Security section in its doc that explicitly:
- Lists which inputs are untrusted
- States what a malicious caller could send
- Specifies validation/sanitization required before use
- States what the function is NOT permitted to expose (e.g., full `process.env`, raw credentials, unrestricted filesystem paths)

**Node substitution completeness rule:** Any function that transforms, substitutes, or dispatches across AST node types must handle ALL node types defined in `types.ts` — either explicitly or with a documented explicit-skip decision. An unhandled node type that silently falls through is a bug, not a design choice.

**Existence gate for source_files:** When marking `status: complete`, all files listed in `source_files` must exist on disk. Missing files block completion. Add missing files to `known_issues` with a TODO, or implement them before closing the feature.

**Determine the `path` field** before writing the doc. Read the `path` values of all existing docs in `.mdd/docs/` to understand established product vocabulary and category names. Then ask: "What would a user navigate to in order to reach this feature?" — answer in their mental model of the product, not the code structure. Use 1–3 segments, Title Case, product vocabulary (e.g. `Auth/Login`, `E-commerce/Cart`, `Dashboard/Analytics`). Siblings must use identical parent spelling — if `Auth/Login` exists, use `Auth` not `Authentication`. If you can infer the path from context with confidence, set it and show the user. If genuinely ambiguous (feature could belong in 2+ places), ask: "Where does this feature live in the product? (e.g. `Auth/Login` or `Dashboard/Reports`)"

**After writing the feature doc**, trigger the `.mdd/.startup.md` rebuild (same logic as in Status Mode — rebuild auto-generated zone, preserve Notes zone) so the Features list stays current.

Show the completed doc to the user and ask: **"Does this accurately describe what you want to build? Anything to add or change?"**

Wait for confirmation before proceeding.

### Phase 4 — Generate Test Skeletons

Read the documentation file created in Phase 3. From the endpoints, business rules, and edge cases documented, generate test skeletons.

**Skeleton template (unit):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('<Feature Name>', () => {
  // For each endpoint documented:
  describe('<operation>', () => {
    it('should <expected behavior from docs>', async () => {
      // Arrange
      // Act
      // Assert — minimum 3 assertions based on documented response shape
      expect.fail('Not implemented — MDD skeleton');
    });

    it('should return <error> when <edge case from docs>', async () => {
      expect.fail('Not implemented — MDD skeleton');
    });
  });
});
```

**Rules for skeleton generation:**
- One `describe` block per endpoint or business rule
- One `it` block per documented behavior (happy path + each error case)
- Every `it` block has `expect.fail('Not implemented — MDD skeleton')` as placeholder
- NO implementation yet — just the structure from the docs
- Include the exact response shapes and status codes from the documentation

**Parallelization rule:**
- If BOTH unit AND E2E tests are needed → launch 2 parallel `general-purpose` agents. Each receives: the full MDD doc content, the skeleton template above, project testing conventions, and the exact output file path. Agent A writes `tests/unit/<feature-name>.test.ts`, Agent B writes `tests/e2e/<feature-name>.spec.ts`. These are different files — no write conflict is possible.
- If only unit tests needed → generate directly in the main conversation (no agent overhead for a single file).

**E2E skeleton template (if applicable):**
```typescript
import { test, expect } from '@playwright/test';

test.describe('<Feature Name>', () => {
  test('should <expected user flow from docs>', async ({ page }) => {
    // Navigate
    // Interact
    // Assert
    test.fail(); // Not implemented — MDD skeleton
  });
});
```

Tell the user:
```
📋 Test skeletons created:
   - tests/unit/<feature-name>.test.ts (<N> test cases)
   - tests/e2e/<feature-name>.spec.ts (<N> test cases) [if applicable]

These tests will FAIL until implementation is complete.
That's the point — they're the finish line.
```

---

### Phase 4b — Red Gate (mandatory)

**No skip condition.** This phase runs after every skeleton generation, every time.

Run ONLY the new test file(s) — not the full suite:

```bash
pnpm test:unit -- <path/to/new-test-file>
```

If E2E skeletons were generated, also run:
```bash
pnpm test:e2e:chromium -- <path/to/new-e2e-file>
```

**For each test result:**

- **FAIL (expected):** ✓ — skeleton confirmed red
- **PASS (unexpected):** investigate immediately before proceeding
  - No real assertion (empty `it` body, or `expect.fail` was removed)? Fix the skeleton to add proper assertion — do NOT adjust the test to pass, write the assertion correctly.
  - Pre-existing code already satisfies the test? Adjust the skeleton to test the new behavior specifically, and document the overlap in the MDD doc's `known_issues`.
  - Test file itself has a syntax error that's causing a false skip? Fix the syntax.

**Gate:** ALL tests must fail before proceeding to Phase 5. Block until confirmed red.

Report to the user:
```
🔴 Red Gate: <N>/<N> failing (expected)
   All skeletons confirmed RED — ready to implement.
```

If any test passes unexpectedly and the fix isn't trivial, ask the user:
```
⚠️  Red Gate: <N>/<N> failing, <N> passing unexpectedly.
   Test(s) passing: <test name(s)>
   Diagnosis: <what's happening>
   Proposed fix: <skeleton adjustment>
   Proceed with fix? (yes / adjust differently / stop)
```

### Phase 5 — Present the Build Plan

**Auto-detect feature size** before choosing plan format:

- **Simple** — fewer than 3 new files, no API routes, no database: use flat steps (block overhead not warranted)
- **Medium or Large** — anything else: use block structure

#### Block structure (medium/large features)

Each block is a unit of work that satisfies three criteria:
1. **Runnable end-state** — after the block completes, code compiles, tests pass, no half-open interfaces
2. **Commit-worthy scope** — the block has a clear "why" that justifies a standalone conventional commit
3. **Own verification** — a concrete command that proves the block is done

**Block template:**
```
Block N (Name) [small | medium | large]
  End-state:    <what is compilable and runnable when this block finishes>
  Commit scope: <conventional commit one-liner, e.g. "feat: add order types and DB schema">
  Verify:       <exact command — e.g. pnpm typecheck or pnpm test:unit -- --grep "orders">
  Handoff:      <what the next block expects to exist when this one finishes>
  Runs in:      main conversation | parallel agents (N)

  Steps:
    1. <specific file action — e.g. Create src/types/orders.ts — Order, OrderStatus, OrderLine>
    2. <specific file action>
```

**Large block rule:** Must include `Justification: <why this block cannot be split>`. A valid justification is a shared type contract that forces backend + frontend into one atomic change. If the justification doesn't hold, auto-suggest the split before the user confirms.

**Parallelization annotation:**
Before assigning `Runs in: parallel agents`, verify both gates:
1. **File declaration gate:** List every file each parallel agent will write. If any file appears in more than one agent's list → mark as `Runs in: main conversation`. No exceptions.
2. **Type dependency gate:** If Block X creates types that Block Y's code imports → Block X must run first (Block Y gets `Depends on Block X`, sequential).

If both gates pass and the blocks are in the same dependency layer → mark as `Runs in: parallel agents (2)`.

**Dependency layers** (used to sequence blocks):
```
Layer 1 (no dependencies):      Types, shared interfaces
Layer 2 (depends on Layer 1):   Services, components, handlers
Layer 3 (depends on Layer 2):   Route wiring, integration points
Layer 4 (depends on all):       Test implementation, final wiring
```

**Build plan display:**
```
🔨 MDD Build Plan for: <Feature Name>

Documentation: .mdd/docs/<NN>-<feature-name>.md ✅
Test skeletons: <N> tests across <N> files ✅
Red Gate: <N>/<N> confirmed red ✅

Block 1 (Foundation) [small]  →  main conversation
  End-state:    Shared types compile clean
  Commit scope: feat: add <feature> types and interfaces
  Verify:       pnpm typecheck
  Handoff:      User, Order, OrderStatus exported from src/types/orders.ts

Block 2 (Services) [medium]  →  parallel agents (2)
  Backend sub-block:   src/handlers/orders.ts, src/adapters/orders.ts
  Frontend sub-block:  src/components/OrderList.tsx, src/hooks/useOrders.ts
  File overlap:        NONE — safe to parallelize
  Each agent receives: Block 1 output + full MDD doc + project conventions

Block 3 (Wiring) [small]  →  main conversation
  End-state:    Route registered, feature reachable at /api/v1/orders
  Commit scope: feat: wire orders route into server
  Verify:       pnpm test:unit -- --grep "orders"
  Handoff:      POST /api/v1/orders returns 201

Block 4 (Tests) [small]  →  main conversation
  End-state:    All <N> skeletons passing, no regressions
  Commit scope: test: implement orders feature test suite
  Verify:       pnpm test:unit

Total blocks: <N> (<N> sequential, <N> parallel batch)
Total new files: <N>
Tests to satisfy: <N>

Ready to build? (yes / modify plan / stop here)
```

**Step naming is MANDATORY** — every block has a unique name the user can reference when asking for changes.

**Flat step format (simple features only):**
```
🔨 MDD Build Plan for: <Feature Name>

Documentation: .mdd/docs/<NN>-<feature-name>.md ✅
Test skeletons: <N> tests ✅  Red Gate: <N>/<N> red ✅

Steps:
  Step 1 (<name>): <what will be created>
  Step 2 (<name>): <what will be created>

Tests to satisfy: <N>

Ready to build? (yes / modify plan / stop here)
```

Wait for user confirmation.

### Phase 6 — Implement (Test-Driven)

#### Step 6a — Layered execution

Execute blocks in dependency layer order (Layer 1 → 2 → 3 → 4). Within the same layer, blocks marked `Runs in: parallel agents (2)` run simultaneously. Blocks marked `Runs in: main conversation` run sequentially.

**For parallel blocks:**

1. Verify file declaration gate one final time (list every file each agent writes — any overlap → fall back to sequential)
2. Launch both agents simultaneously. Each agent prompt must be **completely self-contained** and include:
   - The full MDD doc content (embedded, not referenced by path)
   - The specific block description and steps
   - ALL output from Layer 1 (types files — embed the file contents, do not reference paths)
   - Project coding conventions from CLAUDE.md
   - Exact output file paths
   - Explicit instruction: write the implementation only, do not run tests or typecheck
3. Collect both outputs
4. Run `pnpm typecheck` before proceeding to the next layer
5. If typecheck fails after a parallel batch: diagnose which agent's output is the cause before retrying. Fix in main conversation — do not re-launch agents blindly.

**For sequential blocks:** read the MDD doc, read the relevant test skeletons, implement, run the Green Gate loop below.

#### Step 6b — Green Gate loop (per block)

After each block's implementation (sequential or parallel), run the Green Gate:

```
Green Gate — Block N (Name)

Iteration 1–5:
  Run: pnpm test:unit -- --grep "<feature>" AND pnpm typecheck

  If ALL green:
    → proceed to regression check

  If failing:
    DIAGNOSE (required before any fix):
      - What is the exact error message, file, and line?
      - Which implementation assumption was wrong?
      - Is this a known pattern? (check CLAUDE.md, project conventions)
      - What is the ONE targeted fix?
    
    FIX — implementation only:
      - Tests are NEVER modified.
      - If a test seems wrong → re-read the MDD doc first.
      - If the doc seems wrong → STOP and ask the user before changing anything.
    
    REPORT ONE LINE per iteration:
      "Iteration N — Root cause: <X> / Fix applied: <Y>"

Iteration 5 exhausted, still failing:
  STOP immediately. Do not attempt iteration 6.
  Report to user:
    "5 iterations reached. Still failing:
       - <test name>: <diagnosis summary>
       - <test name>: <diagnosis summary>
     Options:
       (a) continue debugging — I'll keep trying
       (b) narrow scope — remove or defer these cases
       (c) pause and review together"
  Wait for user input.
```

**Regression check (after each block goes green):**

```bash
pnpm test:unit  # full suite, including pre-existing tests
```

Any regression failure is treated as a new failure for the SAME block — it counts against the remaining iteration budget. This prevents regressions from being silently deprioritized.

**Progress reporting:**
```
Block 1 (Foundation): ✅ — src/types/orders.ts created, typecheck clean
Block 2 (Services):   🔄 parallel agents running...
Block 2 (Services):   ✅ — 8/8 tests passing, no regressions
Block 3 (Wiring):     🔄 in progress...
```

### Phase 7 — Verify + Report

#### Phase 7a — Quality Gates

```bash
pnpm typecheck   # must pass — no errors
pnpm test:unit   # all tests must pass (pre-existing + new)
```

These must both pass before proceeding to Phase 7b. If either fails here, return to Phase 6 (Green Gate) to fix.

#### Phase 7b — Integration Verification

Quality gates passing does not mean the feature works. This phase verifies actual behavior against the real runtime environment.

**Detect feature type** from MDD doc frontmatter (`routes`, `models`, source file paths, feature description):

**Backend feature** (has routes or handler files):
```
□ Start the server if not running
□ Trigger the full happy-path request — real HTTP call, real DB, not mocked
□ Watch backend logs during the run:
    Any unexpected error, warning, or rate anomaly → investigate immediately
□ Verify: response shape matches documented response shape
□ Verify: response status code matches documented status code
□ Verify: DB state changed as expected (run a direct query to confirm)
□ Test at least one documented error case (bad input, missing auth, etc.)
□ Verify: error response matches documented error response
```

**Frontend feature** (has component or UI files):
```
□ Open the target page in the browser
□ Verify expected data is visible — "page loaded" is NOT sufficient
□ Click through the documented user flow step by step
□ Open network tab: confirm expected API calls are made
□ Open network tab: confirm expected responses are received
□ Check browser console: no errors or warnings from this feature's code
□ Test an error state (bad input, empty state, etc.) — verify it renders correctly
```

**Database feature** (has schema or model changes):
```
□ Write: verify rows/documents actually written — direct DB query, not insert return value
□ Read: verify reads return the expected data shape
□ Constraints: test invalid data produces the documented error (not a silent failure)
□ Performance: run EXPLAIN on primary query patterns — no full-table scans on large collections
```

**Tooling feature** (command, script, hook, or workflow):
```
□ Run against a real scenario — not contrived minimal input
□ Verify output exactly matches documented behavior (check actual output against doc)
□ Test documented error cases — verify each produces the documented error message
□ Confirm no unintended side effects on unrelated files or state
```

**Spec invariants — applies when the feature doc references spec language like "cannot be overridden", "always blocked", "immutable", "confinement", or "required":**
```
□ Every spec-stated invariant must be verifiably enforced in code:
    "cannot be overridden" → Object.freeze() on arrays/objects + readonly type
    "always blocked" → the block path runs BEFORE any allow logic
    "confinement" → an actual path check exists at every entry point, not just a gate module
    "required" → ParseError or equivalent thrown for missing values (no silent empty string)
□ Run grep for the invariant keyword in source — verify it appears in a test assertion, not just prose
□ If the spec says module X enforces Y, verify X is actually CALLED at the relevant call site
    (building a security module is not the same as wiring it)
```

**Ownership Default — applies to ALL feature types:**

```
Any external failure (API unreachable, DB missing test data, service slow, key not set)
is a HYPOTHESIS — not an accepted fact — until empirically disproven.

Required procedure before accepting any external blocker as real:
  Step 1: Read backend logs in full — what did the server actually receive and return?
  Step 2: Run a minimal probe — the smallest possible request or script targeting the real interface
  Step 3: Form a specific, falsifiable hypothesis — "The failure is at X because Y shows Z"

Default stance: "My code is wrong until proven otherwise."
This takes ~1 minute and eliminates the entire class of wrong-attribution bugs
where the agent patches the wrong thing because it accepted an external excuse too quickly.
```

#### Phase 7c — Completion Signal

**If integration verified:**

1. **Contract verification gate** — before marking complete, check the feature doc's `satisfies_contracts`:
   - Any entry still `status: pending` means the integration was never wired
   - For each pending entry: locate the call site in the implementation, verify it exists, update to `verified: <file>:<line>`
   - If the call site is missing: implement it now (do not mark complete without it)
   - **A feature with any `pending` contract cannot be marked `status: complete`**

   Also check that all files in `source_files` exist on disk. Any missing file must be implemented or moved to `known_issues` with explicit documentation of why it was deferred.

2. **Update the feature doc frontmatter** — write these fields now, before displaying the signal:
   - `status: complete`
   - `phase: all`
   - `last_synced: <today>`
   - `mdd_version: <current from mdd.md frontmatter>`

2. **Regenerate `.mdd/connections.md`:**
   Read all `.mdd/docs/*.md` (excluding `archive/`) — frontmatter only (id, title, status, path, depends_on, source_files). Never read doc bodies. Then:
   - **Path tree:** sort docs by path alphabetically, then by id within the same path. Render as indented tree using `├──` / `└──` characters. Each leaf: `<path-leaf-segment>  <id>  <status>`.
   - **Mermaid graph:** one node per doc (short node ID), one `-->` edge per `depends_on` entry, `:::<status>` suffix on each node. Include `classDef` block for complete/in_progress/draft/deprecated.
   - **Source overlap:** map source_file → docs that reference it. Include only files with 2+ docs.
   - **Warnings:** broken `depends_on` refs, circular deps, docs missing `path`.
   - **Write** `.mdd/connections.md` with YAML frontmatter (`generated: <today>`, `doc_count`, `connection_count`, `overlap_count`) and four sections: Path Tree, Dependency Graph, Source File Overlap, Warnings.

3. Display the completion signal:
```
✅ MDD Complete: <Feature Name>

Documentation: .mdd/docs/<NN>-<feature-name>.md
Data flow doc: .mdd/audits/flow-<feature-slug>-<date>.md (or "greenfield")
Files created: <list>
Blocks: <N>/<N> complete
Tests: <N>/<N> passing
Integration: verified (<feature type> — real environment)
Typecheck: clean
Connections: .mdd/connections.md updated

New patterns established: <any new rules worth adding to CLAUDE.md>

Branch: feat/<feature-name>
Ready for review — run `git diff main...HEAD` to see all changes.
```

**If integration NOT verified (external condition blocked it):**

1. **Update the feature doc frontmatter** — write these fields now, before displaying the signal:
   - `status: in_progress`
   - `phase: integration-pending`
   - `last_synced: <today>`
   - `mdd_version: <current from mdd.md frontmatter>`

2. Display the blocked signal:
```
⏸️  MDD Blocked: <Feature Name>

Blocked on:  <exact condition — e.g. "STRIPE_API_KEY not set in .env">
Evidence:    <what was run and what it returned>
Diagnosis:   <specific hypothesis about the cause>
Next step:   <concrete action to unblock — e.g. "Add STRIPE_API_KEY to .env, then re-run Phase 7b">

Code is complete. All <N> tests pass. Typecheck clean.
Feature is NOT marked done until Phase 7b passes.

When unblocked: resume at Phase 7b only. No re-implementation needed.
```

3. **Update documentation** — add any `known_issues` discovered during implementation
4. **Update CLAUDE.md** if new patterns were established

#### Phase 7d — Commit & Merge

**This phase runs after every completed MDD run (integration verified).** It does NOT run when blocked (Phase 7b failed).

Run `git diff main...HEAD --stat` and show the user a compact summary of all changes on the branch.

Then ask the user via AskUserQuestion:

```
🚀 Ready to ship?

Branch: feat/<feature-name>
Changes: <N files changed, N insertions, N deletions> (from git diff --stat)

  (a) Commit & merge to main — stage all changes, commit, merge, return to main
  (b) Commit only — stage and commit on this branch, stay here
  (c) Skip — I'll handle git manually
```

**If (a) Commit & merge:**
1. Stage all changes: `git add -A`
2. Commit using the `/commit` skill (which generates a conventional commit message from context)
3. Switch to main: `git checkout main`
4. Merge: `git merge feat/<feature-name> --no-ff -m "Merge feat/<feature-name>: <feature title>"`
5. Ask: "✅ Merged to main. Push to origin now? (yes / no)"
   - If yes: `git push origin main`
   - If no: report "Branch `feat/<feature-name>` preserved. Run `git push` when ready."

**If (b) Commit only:**
1. Stage all changes: `git add -A`
2. Commit using the `/commit` skill
3. Ask: "✅ Committed on `feat/<feature-name>`. Push this branch to origin? (yes / no)"
   - If yes: `git push origin feat/<feature-name>`
   - If no: report "Run `git push` when ready."

**If (c) Skip:**
Report: "Skipped. Branch `feat/<feature-name>` — run `/commit` and then merge when ready."

---
