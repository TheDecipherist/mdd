<p align="center">
  <img src="docs/mdd_hero.webp" alt="MDD — Manual-Driven Development for Claude Code" width="100%" />
</p>

# MDD — Manual-Driven Development for Claude Code

> **One command. Twenty-one modes. Complete feature lifecycle from documentation to verified deployment.**

MDD turns Claude Code from a code generator into a structured development partner. Every feature starts with documentation. Every fix starts with an audit. No exceptions.

```bash
npm install -g @thedecipherist/mdd
mdd install
```

Then in Claude Code:
```
/mdd add user authentication with JWT tokens
```

---

## Why MDD?

Most people prompt Claude Code like this: *"fix the bug in my auth system."* Claude reads 40 files, burns through context trying to understand your architecture, and produces something that technically compiles but misses the bigger picture.

MDD flips this. You write structured documentation first, then Claude reads **one doc** instead of 40 files. It gets the full picture in 200 tokens instead of 20,000.

**The workflow: Document → Audit → Fix → Verify**

| Phase | What happens |
|-------|-------------|
| 📋 Document | Write feature docs with YAML frontmatter in `.mdd/docs/` |
| 🔍 Audit | Read source code, write incremental notes to disk (survives compaction) |
| 📊 Analyze | Read notes only → produce severity-rated findings report |
| 🔧 Fix | Execute pre-planned fixes with tests |
| ✅ Verify | Tests pass, types check, documentation updated |

---

## Installation

```bash
npm install -g @thedecipherist/mdd
mdd install          # copies Claude commands to ~/.claude/commands/
```

```bash
mdd update           # update to latest version
mdd install --dir /custom/path   # install to a custom directory
```

After running `mdd install`, the `/mdd` command is available in every Claude Code session globally — no per-project setup needed.

---

## Usage

### Build a new feature

```bash
/mdd add user authentication with JWT tokens
/mdd build payment integration with Stripe
/mdd create admin dashboard for user management
```

Claude interviews you about requirements, writes structured documentation, generates test skeletons (red gate), presents a block-by-block build plan, implements with a 5-iteration green gate loop, then verifies against the real runtime environment.

### Audit existing code

```bash
/mdd audit                    # full codebase audit
/mdd audit database           # audit a specific section
/mdd audit authentication     # audit just auth-related code
```

Scales across parallel agents (1–8 depending on file count). Notes written to disk every file so findings survive context compaction. Produces a severity-rated report (P1 Critical → P4 Low) with effort estimates.

### Day-to-day operations

```bash
/mdd status                   # overview: docs, tests, audit state, drift
/mdd scan                     # detect features whose source files changed since last session
/mdd update 04                # re-sync a feature doc after code changes
/mdd note "switched to PostgreSQL"   # append a timestamped note to session context
/mdd commands                 # show this reference table in Claude
```

### Feature lifecycle

```bash
/mdd reverse-engineer src/handlers/payments.ts   # generate docs from undocumented code
/mdd graph                    # dependency map with broken/risky dep warnings
/mdd deprecate 03             # retire a feature cleanly, flag dependents
/mdd upgrade                  # batch-patch missing frontmatter across all docs
```

### Initiative & wave planning

```bash
/mdd plan-initiative "auth system"           # create a multi-wave initiative
/mdd plan-wave auth-system "Auth Foundation" # plan a wave with a demo state
/mdd plan-execute auth-system-wave-1         # implement all features in a wave
/mdd plan-sync auth-system                   # re-stamp waves after initiative changes
/mdd plan-remove-feature auth-system-wave-1 auth-signup
/mdd plan-cancel-initiative auth-system
```

### Ops runbooks

```bash
/mdd ops deploy swarmk to dokploy     # create a deployment runbook
/mdd ops list                         # list all runbooks (global + project)
/mdd runop swarmk-dokploy             # execute: pre-flight → canary → primary → post-flight
/mdd update-op swarmk-dokploy         # edit an existing runbook
```

---

## What Gets Installed

`mdd install` copies 7 files to `~/.claude/commands/`:

| File | Contents | Lines |
|------|----------|-------|
| `mdd.md` | Router — Steps 0/0a/0b, mode dispatch, auto-branch | ~120 |
| `mdd-build.md` | BUILD MODE — Phases 0–7d (branch check, understand, data flow, docs, test skeletons, red gate, plan, implement, verify, commit) | ~680 |
| `mdd-audit.md` | AUDIT MODE — Phases A1–A7 (scope, agent config, parallel execution, convergence, merge, analyze, fix) | ~240 |
| `mdd-manage.md` | STATUS + NOTE + SCAN + UPDATE + DEPRECATE modes | ~340 |
| `mdd-lifecycle.md` | REVERSE-ENGINEER + GRAPH + UPGRADE modes | ~350 |
| `mdd-plan.md` | PLAN-INITIATIVE + PLAN-WAVE + PLAN-EXECUTE + PLAN-SYNC + PLAN-REMOVE-FEATURE + PLAN-CANCEL-INITIATIVE modes | ~350 |
| `mdd-ops.md` | OPS DOCUMENT + OPS EXECUTE + OPS UPDATE + OPS LIST + COMMANDS modes | ~380 |

The router loads only the mode file needed for each invocation — a `/mdd status` loads ~460 tokens instead of the full ~28,000. The full set is available but never loaded unnecessarily.

---

## The `.mdd/` Directory

All MDD artifacts live in a single dotfile directory:

```
.mdd/
├── docs/                         # Feature documentation (one .md per feature)
│   ├── 01-<feature-name>.md      # auto-numbered, YAML frontmatter
│   └── archive/                  # Deprecated feature docs
├── initiatives/                  # Initiative files (/mdd plan-initiative)
├── waves/                        # Wave files (/mdd plan-wave)
├── ops/                          # Ops runbooks (/mdd ops)
├── audits/                       # Audit artifacts (gitignored)
│   ├── flow-<feature>-<date>.md  # Data flow analysis (Phase 2)
│   ├── notes-<date>.md           # Raw reading notes (Audit Phase A2)
│   ├── report-<date>.md          # Severity-rated findings (Audit Phase A3)
│   ├── scan-<date>.md            # Drift report (/mdd scan)
│   └── graph-<date>.md           # Dependency graph (/mdd graph)
├── jobs/                         # Active audit jobs (gitignored, auto-deleted)
└── .startup.md                   # Auto-generated session context
```

`.mdd/audits/` and `.mdd/jobs/` are automatically added to `.gitignore` on first run.

---

## Build Mode in Detail

Build mode runs 7 phases with 3 mandatory gates:

**Pipeline:** Understand → Analyze → Document → Test Skeletons → **Red Gate** → Plan → Implement → **Green Gate** → Verify → **Integration Gate**

- **Phase 1** gathers context using 3 parallel Explore agents (rules, existing features, codebase structure)
- **Phase 2** is a mandatory Data Flow & Impact Analysis gate — traces every data value end-to-end before writing a line of docs; automatically skipped on greenfield projects
- **Red Gate** runs every test skeleton to confirm it actually fails before implementation begins
- Build plan uses commit-worthy blocks with runnable end-states, verification commands, and handoff contracts; independent blocks annotated for parallel execution
- **Green Gate** implements each block with a 5-iteration diagnosis-first loop — states root cause before each fix; stops at 5 and escalates rather than continuing blindly
- **Integration Gate** verifies real behavior (real HTTP calls, real DB, real browser) before marking complete

---

## Audit Mode in Detail

Audit mode scales with file count (1–8 parallel agents):

| Files in scope | Agents |
|---|---|
| < 10 | 1 (single-agent mode) |
| 10–25 | 2 |
| 26–50 | 3 |
| 51–100 | 5 |
| 100+ | 8 |

Each agent gets a shard of files and a config file. Agents clear context between every file — every file gets a full context window with maximum analysis budget. Notes are written to disk so findings survive compaction. The manifest tracks `[ ] pending → [~] in progress → [x] complete → [!] findings → [e] error` for every file.

---

## MDD Versioning

Every feature doc, wave, and initiative created by MDD is stamped with `mdd_version: N` in its frontmatter. `/mdd status` shows a breakdown of which docs are on which version. `mdd install` compares `mdd_version` between the installed and available versions before overwriting — no silent overwrites.

The current MDD version is `8` (bumped with each release to this package).

---

## Real Results: Self-Audit

The [Claude Code Mastery Starter Kit](https://github.com/TheDecipherist/claude-code-mastery-project-starter-kit) used MDD to audit itself:

| Audit Step | Time | Output |
|------------|------|--------|
| Create Docs (pre-audit) | ~25 min | 9 feature docs in `.mdd/docs/` |
| A2: Read + Notes | 9 min 51s | 57+ files read, 837 lines of notes |
| A3: Analyze | 2 min 39s | 298-line report, 20 findings |
| A5: Fix All | 10 min 53s | 17/20 fixed, 125 tests written |
| **Total** | **~48 min** | **20 findings, 125 tests from zero** |

---

## Companion Tools

- **[mdd-tui](https://github.com/TheDecipherist/mdd-tui)** — Terminal dashboard for browsing your `.mdd/` workspace (docs, audits, graph, ops runbooks) in a live TUI. Install: `npm install -g @thedecipherist/mdd-tui`
- **[Claude Code Mastery Starter Kit](https://github.com/TheDecipherist/claude-code-mastery-project-starter-kit)** — Full project scaffolding with hooks, rules, skills, and agents. MDD is one component of the kit.
- **[strictdb](https://www.npmjs.com/package/strictdb)** — Database wrapper with guardrails used across starter kit projects

---

## License

MIT — [TheDecipherist](https://github.com/TheDecipherist)
