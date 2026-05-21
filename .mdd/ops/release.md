---
id: release
title: MDD npm Release
type: ops
platform: npm
environments: [production]
deployment_strategy:
  order: sequential
  gate: manual
  on_gate_failure: stop
  rollback_on_failure: false
regions: []
services:
  - slug: mdd-npm
    image: ~
    port: ~
    health_check: npm view @thedecipherist/mdd version
    regions: {}
status: active
last_synced: 2026-05-20
mdd_version: 13
tags: [release, npm, publish, version-bump, main, global-install, mdd-update]
known_issues: []
---

# MDD npm Release

## Overview

Publishes a new version of `@thedecipherist/mdd` to npm, commits the version bump to `main`, pushes to GitHub, and updates the global install on this machine. All steps run on `main` directly - this is the one workflow that does not use a feature branch.

## Services & Ports

| Service | Registry | Health check |
|---------|----------|-------------|
| @thedecipherist/mdd | registry.npmjs.org | `npm view @thedecipherist/mdd version` |

## Environment Targets

Production only. npm public registry. No staging step.

## Webhooks & Triggers

Manual - invoked via `/mdd runop release`. No webhooks.

## Credentials & API Keys

| Credential | Env var | Where stored |
|-----------|---------|-------------|
| npm auth token | ~/.npmrc (set by `npm login`) | Local machine |
| GitHub SSH key | ~/.ssh/id_ed25519_decipherist | Local machine |

No values here - credentials must already be configured before running.

## MCP Servers

(none)

## Deployment Procedure

Step 1 (Confirm on main, clean tree):
  Action:  `git checkout main && git pull origin main && git status --porcelain`
  Verify:  Output of `git status --porcelain` must be empty. If dirty, stop and resolve uncommitted changes first.

Step 2 (Confirm bump type):
  Action:  Ask user: "Bump type? patch / minor / major" - then edit `package.json` version field accordingly.
           Current version reference: `node -p "require('./package.json').version"`
           Patch = increment last digit (1.8.4 → 1.8.5)
           Minor = increment middle digit, reset patch (1.8.4 → 1.9.0)
           Major = increment first digit, reset rest (1.8.4 → 2.0.0)
  Verify:  `node -p "require('./package.json').version"` returns the new version string.

Step 3 (Commit version bump on main):
  Action:  `git add package.json && git commit -m "chore: bump version to <NEW_VERSION>"`
  Verify:  `git log --oneline -1` shows the version bump commit on main (not a session or feature branch).
           `git branch --show-current` must return `main`.

Step 4 (Push main to GitHub):
  Action:  `git push origin main`
  Verify:  Push exits 0. `git log --oneline origin/main -1` matches local HEAD.

Step 5 (Publish to npm):
  Action:  `npm publish --access public`
           (prepublishOnly hook runs `pnpm build` automatically)
  Verify:  Command output ends with `+ @thedecipherist/mdd@<NEW_VERSION>`.
           `npm view @thedecipherist/mdd version` returns the new version (allow up to 30s for registry propagation).

Step 6 (Update global install):
  Action:  `npm install -g @thedecipherist/mdd`
  Verify:  `mdd --version` or `npm list -g @thedecipherist/mdd` shows the new version.

Step 7 (Sync command files):
  Action:  `mdd update`
  Verify:  Output lists all command files as installed/updated with no errors.

## Rollback Plan

If npm publish succeeded but something is wrong with the release:

1. Unpublish within 72 hours (npm policy):
   `npm unpublish @thedecipherist/mdd@<NEW_VERSION>`
2. Revert the version bump commit:
   `git revert HEAD --no-edit && git push origin main`
3. Reinstall the previous version globally:
   `npm install -g @thedecipherist/mdd@<PREV_VERSION> && mdd update`

If publish failed (build error, auth error):
- Fix the issue on a feature branch, merge to main, then re-run `/mdd runop release`.
- Do not re-run publish with the same version number - bump patch first.
