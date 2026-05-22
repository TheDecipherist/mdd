---
id: 04-global-claude-guidance
title: MDD Awareness — Tags, Startup Briefs & Claude Guidance Injection
edition: mdd
depends_on: []
source_files:
  - src/install.ts
  - src/cli.ts
  - commands/mdd.md
  - commands/mdd-build.md
  - commands/mdd-manage.md
  - commands/mdd-audit.md
  - commands/mdd-lifecycle.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-14
status: complete
phase: all
mdd_version: 9
tags: [guidance, claude-md, mdd-suggest, install, tags, startup, rebuild-tags, ops, awareness]
path: Tooling/Claude Guidance
known_issues: []
---

# 04 — MDD Awareness — Tags, Startup Briefs & Claude Guidance Injection

## Purpose

Claude should intelligently suggest the right MDD workflow when users make implementation, infrastructure, or modification requests without the `/mdd` flag — but only when MDD is active in the project (`.mdd/` directory exists). This requires three coordinated changes: (1) a `tags:` field on every feature and ops doc so Claude can detect overlap at a glance, (2) an updated `.startup.md` format that surfaces those tags in every conversation, and (3) a guidance block injected into the user's `CLAUDE.md` by `mdd install` that tells Claude what to do with that information.

## Architecture

```
mdd install
  └─ install()
       ├─ copy .md command files (existing)
       └─ injectClaudeGuidance(claudeMdPath)
            ├─ check CLAUDE.md exists (create if not)
            ├─ check idempotency marker
            └─ append guidance block if absent

.startup.md (already injected every conversation)
  └─ Features Documented
       - 01-docs-site (complete) [github-pages, documentation, landing-page]
       - 03-install-local-flag (complete) [cli, install, local-install, flags]
  └─ Ops Runbooks
       - swarmk-dokploy [deploy, dokploy, docker, eu-west, canary]

/mdd rebuild-tags
  └─ scan .mdd/docs/*.md + .mdd/ops/*.md
       ├─ docs WITH tags: → skip (use as-is)
       ├─ docs WITHOUT tags: → generate from title + purpose + frontmatter
       └─ rebuild .startup.md with tag format

/mdd audit
  └─ existing flow...
       └─ before final startup rebuild: run tag generation for docs missing tags
```

**CLAUDE.md target resolution (cli.ts):**
- `--install-local` (no `--dir`): target `<cwd>/CLAUDE.md`
- default global install: target `~/.claude/CLAUDE.md`
- `--dir` explicitly set: skip injection (non-standard path, no reliable target)

## Data Model

No database.

**`tags:` frontmatter field** — required on all feature docs and ops docs:
- 4–8 domain-concept keywords
- NOT file paths (source_files already covers that)
- Covers: systems touched, technology, feature names, key terms

**Idempotency marker for CLAUDE.md injection:** `## MDD — Manual-First Development`

**`.startup.md` feature line format (updated):**
```
- <NN>-<feature-name> (<status>) [tag1, tag2, tag3]
```

**`.startup.md` ops line format (updated):**
```
- <slug> [tag1, tag2, tag3]
```

## API Endpoints

None — CLI tool only.

## Business Rules

### tags: field
1. Required on all new feature docs (Phase 3 template) and ops docs (Phase OP3 template)
2. Required on reverse-engineered docs (Phase R3 template)
3. `rebuild-tags` generates tags for docs missing the field; skips docs that already have it
4. `rebuild-tags --force` regenerates tags even on docs that already have them
5. Tag generation uses: title, `## Purpose` first paragraph, `source_files`, `routes`, `models`

### rebuild-tags command
1. Scans `.mdd/docs/*.md` and `.mdd/ops/*.md` (excluding `archive/`)
2. For each doc missing `tags:`: Claude reads the doc and generates 4–8 tags, writes to frontmatter before `known_issues`
3. Shows a summary of what was generated
4. Always rebuilds `.startup.md` after patching tags
5. `--force` flag: regenerate tags even on docs that already have them

### Audit integration
1. Before the final startup rebuild in Phase A4 (after report is written), run tag generation for any docs missing `tags:`
2. Docs that already have `tags:` are untouched
3. Rebuilt `.startup.md` reflects updated tags

### CLAUDE.md injection (install.ts)
1. Idempotent: check for `## MDD — Manual-First Development` before appending
2. Non-destructive: append to end of CLAUDE.md only
3. If CLAUDE.md does not exist: create it with the guidance block as sole content
4. If `--dir` explicitly passed: skip injection entirely
5. Report in install output: `✓ CLAUDE.md — guidance injected` / `· CLAUDE.md — already present` / `✗ CLAUDE.md — <error>`

### CLAUDE.md guidance block content
```markdown
## MDD — Manual-First Development

If a `.mdd/` directory exists in the current project, apply this logic whenever
the user asks you to implement, build, modify, deploy, or automate something —
and they have NOT used `/mdd` to initiate the request:

**Step 1 — Does it already exist?**
Scan `.mdd/.startup.md` (Features AND Ops Runbooks sections). Do any tags or
names match what the user is asking about?
→ Feature match: "This looks related to `<NN>-<feature-name>`. Want to use
  `/mdd update <NN>` to modify it, or `/mdd audit <NN>` to review it first?"
→ Ops match: "You already have a `<slug>` runbook for this. Want to run it
  with `/mdd runop <slug>` or update it with `/mdd update-op <slug>`?"

**Step 2 — What kind of request is it?**

Infrastructure or ops? (deploy, CI/CD, Docker, commit hooks, pipelines,
cron jobs, webhooks, DNS, SSL, rollback, health checks, server config)
→ "This sounds like an ops procedure. Want to document it as a repeatable
  runbook with `/mdd ops <description>`?"

Feature work touching 3+ independent concerns?
→ "This looks initiative-scale. Want to plan it with `/mdd plan-initiative`?"

Single feature or bounded change?
→ "Want me to use `/mdd <description>` to build this with docs and tests first?"

Always ask — never auto-invoke. If the user says no, proceed as normal.

For bug fixes → suggest `/mdd bug <description>` to track and fix with doc integration.

Skip entirely for: typos, config tweaks, single-line changes, one-off shell commands.
```

## Data Flow

Tags are constants authored by Claude during doc creation or generated by `rebuild-tags`. The CLAUDE.md guidance text is a constant in `install.ts`. Target CLAUDE.md path is computed in `cli.ts` and passed as `claudeMdPath` to `install()`.

## Dependencies

None.

## Known Issues

(none)
