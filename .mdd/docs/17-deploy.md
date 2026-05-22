---
id: 17-deploy
title: Deploy - Docs Site Docker Image and npm Release Runbook
edition: MDD
depends_on: [01-mdd, 15-mdd-documentation]
relates: [14-npm-cli, 05-ops]
source_files:
  - Dockerfile
  - .mdd/ops/release.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [deploy, docker, nginx, npm-publish, release, dokploy, docs-site, version-bump, rollback]
path: Operations/Deploy
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 17 - Deploy - Docs Site Docker Image and npm Release Runbook

## Purpose

MDD has two deployment artifacts: the `@thedecipherist/mdd` npm package and the
mddai.dev docs site. The npm release is the primary artifact - it ships the command
files to users. The docs site is secondary - it serves the mddai.dev landing page and
user guide as a Docker/Nginx container deployed via Dokploy. Both are handled by the
release runbook at `.mdd/ops/release.md`, invoked via `/mdd runop release`.

## Architecture

```
Dockerfile              nginx:alpine serving docs/ on port 80
.mdd/ops/release.md     8-step sequential release runbook
```

### Dockerfile

Minimal two-step image:

```dockerfile
FROM nginx:alpine
COPY docs/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

The entire docs site is static files copied into the Nginx default HTML directory.
No build step, no environment variables, no secrets.

### Release Runbook (ops/release.md)

Eight sequential steps with a manual gate between each:

| Step | Action | Verification |
|------|--------|-------------|
| 0 | Confirm docs are current (README.md, docs/index.html, docs/user-guide.html) | User confirms or skips for non-user-facing changes |
| 1 | Checkout main, pull, verify clean tree | `git status --porcelain` empty |
| 2 | Bump version in `package.json` via bash sed | `node -p "require('./package.json').version"` returns new version |
| 3 | Commit version bump on main | `git log --oneline -1` shows bump on main |
| 4 | Push main to GitHub | Push exits 0 |
| 5 | Deploy docs site if `docs/` changed (build, test locally, push Docker, trigger Dokploy) | `curl -sf http://localhost:8080` passes before push |
| 6 | Publish to npm (`npm publish --access public`) | `npm view @thedecipherist/mdd version` returns new version |
| 7 | Update global install (`npm install -g @thedecipherist/mdd`) | `mdd --version` shows new version |
| 8 | Sync command files (`mdd update`) | All files listed as installed/updated |

Step 2 uses `bash sed` instead of the `Edit` tool because the branch guard hook
blocks `Edit` on main. The runbook documents this explicitly:
```bash
CURRENT=$(node -p "require('./package.json').version")
sed -i "s/\"version\": \"$CURRENT\"/\"version\": \"<NEW_VERSION>\"/" package.json
```

### Docker Pre-Push Test (Step 5)

Before pushing the docs image:
1. `docker build -t $DOCKER_HUB_IMAGE .`
2. `docker run -d -p 8080:80 --name mdd-test $DOCKER_HUB_IMAGE`
3. `sleep 5`
4. `curl -sf http://localhost:8080 > /dev/null`
5. `docker stop mdd-test && docker rm mdd-test`
6. `docker push $DOCKER_HUB_IMAGE`
7. `curl -X POST $DOKPLOY_WEBHOOK_URL`

If the curl test fails, the runbook stops. The docs site deploy and npm publish are
independent - a docs site failure does not block the npm publish.

### Rollback

If npm publish succeeded but the release is broken:
1. Unpublish within 72 hours: `npm unpublish @thedecipherist/mdd@<VERSION>`
2. Revert version bump: `git revert HEAD --no-edit && git push origin main`
3. Reinstall previous version: `npm install -g @thedecipherist/mdd@<PREV_VERSION> && mdd update`

If docs site deploy failed: fix the container issue and re-run Step 5 manually.

## Business Rules

- The release runbook is always invoked via `/mdd runop release` - never run steps ad-hoc
  (risk of committing version bump on the wrong branch)
- All 8 steps run on `main` directly - this is the one workflow that does not use a
  feature branch. This requires special handling for the branch guard hook (use sed)
- Step 0 is mandatory: docs must be confirmed current before proceeding, unless the
  change has no user-facing behavior changes
- The Docker test (`curl -sf http://localhost:8080`) must pass before pushing the image
- npm publish and docs site deploy are decoupled - either can be skipped or re-run
  independently if one fails
- The `prepublishOnly` script in `package.json` runs `pnpm build` automatically before
  `npm publish`

## Data Flow

Reads: `docs/` (Docker build), `package.json` (version), `DOCKER_HUB_IMAGE` env var,
`DOKPLOY_WEBHOOK_URL` env var.
Writes: Docker Hub image, npm registry entry, GitHub main branch (version bump commit).

## Dependencies

Requires `15-mdd-documentation` to be current before Step 0 can pass. Uses `14-npm-cli`
(`install.ts`) as the artifact being published.

## Security

- `DOCKER_HUB_IMAGE` and `DOKPLOY_WEBHOOK_URL` are loaded from `.env` at deploy time.
  Neither is committed to git.
- npm auth token is stored in `~/.npmrc` (set by `npm login`) - not in the repo.
- GitHub SSH key is at `~/.ssh/id_ed25519_decipherist` - not in the repo.
- The Dokploy webhook URL is sensitive (anyone who knows it can trigger a deploy).
  It lives in `.env` only.

## Known Issues

- Step 2's sed command hardcodes the current version string in the substitution pattern.
  If `package.json` formatting changes (e.g. spaces around the colon), the sed pattern
  will silently fail to match, leaving the version unchanged.
- Step 5 conditionally runs only if `docs/` changed in the last commit. If docs were
  updated in an earlier commit on the same branch but not the immediately preceding
  commit, the check `git diff HEAD~1 --name-only | grep "^docs/"` will report no
  changes and skip the docs deploy.
- There is no automated verification that Step 0's "docs confirmed" gate was answered
  honestly. A user who says "no user-facing changes" but made mode changes will silently
  ship stale docs.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
