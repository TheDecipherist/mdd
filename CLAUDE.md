# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Always Do

After completing any change that adds, removes, or modifies a CLI flag, command, mode, or user-facing behaviour — and **before committing** — ask the user:

> "Do you want to update the documentation? This change may affect `README.md`, `docs/index.html`, and/or `docs/user-guide.html`."

If yes, update whichever of these three files are affected before staging the commit:
- `README.md` — installation instructions, command reference table, mode descriptions - AND publish the updated NPM package
- `docs/index.html` — the GitHub Pages landing page
- `docs/user-guide.html` — the full command and mode reference

Ask for all doc updates in a single question, not one file at a time.

## What This Repo Is

`@thedecipherist/mdd` is an npm package that installs 7 Claude command (`.md`) files into `~/.claude/commands/` (or a local `.claude/commands/`) so the `/mdd` slash command is available in Claude Code sessions. The TypeScript source is a thin CLI wrapper; the real product is the Markdown files in `commands/`.

## Commands

```bash
pnpm install      # install deps
pnpm build        # compile TypeScript → dist/ (runs tsc)
pnpm dev          # watch mode
```

There is no test runner. Verify changes by running the compiled CLI directly:

```bash
node dist/cli.js install --help
node dist/cli.js install --install-local   # installs to <cwd>/.claude/commands/
node dist/cli.js install --dir /tmp/test   # install to an arbitrary path
```

Publishing workflow:
1. Bump `version` in `package.json`
2. `npm publish --access public` — `prepublishOnly` runs `pnpm build` automatically
3. Commit the version bump and push

## Architecture

### Source files (`src/`)

Two files only:

- **`cli.ts`** — Commander.js entrypoint. Defines `install` and `update` commands with their options. Action handlers resolve the effective install directory (handling `--install-local` vs `--dir` priority) and delegate to `install()`.
- **`install.ts`** — Core logic. Reads `.md` files from `commands/`, resolves the destination, copies files with version-aware skipping (compares `mdd_version` frontmatter field before overwriting `mdd.md`). Prints a formatted results table.

### The `commands/` directory

Seven Markdown files that become Claude slash commands. This is the product:

```
mdd.md                Router — ~120 lines. Handles worktree check, bootstrap, mode dispatch, Branch Guard.
mdd-build.md          BUILD MODE — Phases 0–7d (understand, document, test skeletons, plan, implement, verify)
mdd-audit.md          AUDIT MODE — multi-agent parallel audit with manifest-based resume
mdd-manage.md         STATUS, NOTE, SCAN, UPDATE, DEPRECATE modes
mdd-lifecycle.md      REVERSE-ENGINEER, GRAPH, UPGRADE modes
mdd-plan.md           PLAN-INITIATIVE, PLAN-WAVE, PLAN-EXECUTE, PLAN-SYNC, PLAN-REMOVE-FEATURE, PLAN-CANCEL-INITIATIVE
mdd-ops.md            OPS DOCUMENT, OPS EXECUTE (runop), OPS UPDATE, OPS LIST, COMMANDS modes
mdd-branch-guard.sh   PreToolUse hook — blocks Write/Edit/NotebookEdit on main/master in .mdd projects
```

**Why split:** Each invocation of `/mdd` loads only the router + the one mode file needed. A `/mdd status` costs ~460 tokens; loading the full set would cost ~28,000. Never consolidate these files back into one.

### Branch Guard hook

`mdd-branch-guard.sh` is a Claude Code `PreToolUse` hook installed to `~/.claude/hooks/` (or `.claude/hooks/` for local installs). It fires before every `Write`, `Edit`, and `NotebookEdit` tool call. If the current branch is `main` or `master` and the project has a `.mdd/` directory, the hook exits with code `2`, blocking the tool call with a clear message. Exit `0` everywhere else (non-MDD projects, non-main branches).

`install.ts` also merges a hook entry into `settings.json` (`~/.claude/settings.json` or `.claude/settings.json`) with an idempotency check: if any existing PreToolUse entry's command already contains `mdd-branch-guard`, the merge is skipped.

### Install flag priority

`--install-local` sets the destination to `<cwd>/.claude/commands/`. If `--dir` is also provided, `--dir` wins. The CLI detects this via Commander's `getOptionValueSource('dir') === 'cli'` — a returned value of `'default'` means the user did not explicitly pass `--dir`. The `settingsPath` follows the same logic: local → `.claude/settings.json`, global → `~/.claude/settings.json`, `--dir` explicit → `undefined` (skips hook install).

### Version safety

`mdd install` reads the `mdd_version: N` frontmatter from both the source `mdd.md` (bundled in the package) and the destination `mdd.md` (already installed). It skips the copy if the installed version is already equal or newer, unless `--force` is passed. Mode files (everything other than `mdd.md`) are always overwritten silently.

## TypeScript Config

ESM (`"type": "module"`), `NodeNext` module resolution, strict mode. All imports in `src/` must use `.js` extensions (resolved to `.ts` at compile time by NodeNext). Target is ES2022, Node ≥ 18.
