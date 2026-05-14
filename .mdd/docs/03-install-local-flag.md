---
id: 03-install-local-flag
title: Local Install Flag (--install-local)
edition: mdd npm package
depends_on: []
source_files:
  - src/cli.ts
  - src/install.ts
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-14
status: complete
phase: all
mdd_version: 8
known_issues: []
---

# 03 — Local Install Flag (--install-local)

## Purpose

Adds an `--install-local` flag to the `mdd install` and `mdd update` commands so users can install MDD command files into their current project's `.claude/commands/` directory rather than the global `~/.claude/commands/`. This lets developers test MDD on a single project without touching their global Claude setup.

## Architecture

The MDD CLI uses Commander.js. The install command resolves a destination directory and copies `.md` command files from the bundled `commands/` folder. Adding `--install-local` introduces a shorthand that overrides the default global destination with `<cwd>/.claude/commands/`.

**Decision — `--dir` wins over `--install-local`:** If the user explicitly passes `--dir`, it takes precedence. Commander's `getOptionValueSource('dir')` detects whether `--dir` came from the CLI vs the default, making the priority rule reliable.

**Gitignore hint:** After a successful local install, print a reminder to add `.claude/commands/` to `.gitignore`.

## Data Model

No database. No persistent state beyond the files copied to disk.

## API Endpoints

None — CLI tool only.

## Business Rules

1. Default behaviour is unchanged: global install to `~/.claude/commands/`.
2. `--install-local` sets the destination to `<cwd>/.claude/commands/`.
3. If both `--install-local` and `--dir` are provided, `--dir` wins silently (no error).
4. `mdd update --install-local` works identically to `mdd install --install-local --force`.
5. After a local install, print: `Tip: add .claude/commands/ to your .gitignore to keep these files out of git.`

## Data Flow

```
User: mdd install --install-local
  → Commander parses options: { dir: '~/.claude/commands' (default), installLocal: true, force: false }
  → Action handler: getOptionValueSource('dir') === 'default'
  → effectiveDir = process.cwd() + '/.claude/commands'
  → install({ dir: effectiveDir, force: false, local: true })
  → mkdirSync(effectiveDir, { recursive: true })
  → copy .md files from commands/ → effectiveDir
  → print results + gitignore hint

User: mdd install --install-local --dir /custom
  → getOptionValueSource('dir') === 'cli'
  → effectiveDir = /custom  (--dir wins)
  → install({ dir: /custom, force: false, local: false })
  → no gitignore hint
```

## Dependencies

None.

## Known Issues

(none)
