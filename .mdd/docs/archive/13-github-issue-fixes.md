---
id: 13-github-issue-fixes
title: Workflow Gap Fixes - Audit Criteria, Build Phase, and MCP Rules
edition: Both
depends_on: [09-mdd-bug-mode, 11-mdd-settings, 12-mdd-security-rules]
source_files:
  - commands/mdd-audit.md
  - commands/mdd-build.md
  - commands/mdd-rules-mcp.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-20
status: complete
phase: all
mdd_version: 13
tags: [audit, build, criteria, mcp, security-read-sites, satisfies-contracts, workflow-gaps, github-issues]
path: Tooling/Workflow
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 13 - Workflow Gap Fixes - Audit Criteria, Build Phase, and MCP Rules

## Purpose

Addresses five workflow gaps surfaced by real-project audits and filed as GitHub issues #3 and #5. Each gap is a pattern the MDD workflow failed to catch, now codified as either a new rule, a stricter criterion, or a new frontmatter field.

## Architecture

Five targeted changes across three files:

```
commands/mdd-audit.md
  - P1 criteria: extend security reimplementation rule to object-literal wrappers
  - Phase A1: satisfies_contracts multi-file coverage (every file, not just one entry)
  - Phase A1: security_read_sites cross-check (new field)

commands/mdd-build.md
  - Phase 1: shared-utilities extraction prompt when depends_on is non-empty

commands/mdd-rules-mcp.md  (new file)
  - validateMcpInput enforcement for every MCP tool handler
```

All changes are additive. No existing behaviour is removed or replaced.

## Data Model

New optional frontmatter field added to the feature doc template in `mdd-build.md` Phase 3:

```yaml
security_read_sites:
  - src/commands/render.ts:106
  - src/commands/parse.ts:22
```

Purpose: enumerates every file:line in the feature that reads user-supplied file paths. Phase A1 cross-checks each listed site against confirmed `checkFilePath` (or equivalent path-confinement) calls. If a site is listed but has no guard, it becomes a P1 finding.

When not present: Phase A1 skips the cross-check silently. Existing feature docs without the field are not retroactively flagged.

## Business Rules

**P1 rule extension (object-literal wrappers):**
1. The existing P1 rule checks named functions matching `isConfined`, `isSafe`, `isAllowed`, `isBlocked`. The extension adds: also flag any object-literal property or anonymous helper that performs path resolution and containment (`resolve` + `relative` + `startsWith('..')`) without delegating to the canonical security module.

**satisfies_contracts multi-file coverage:**
2. When checking a `satisfies_contracts` entry, verify EVERY file in `source_files` that performs the contracted operation has the guard call - not just one file per entry. A single guarded file does not satisfy a contract that covers the whole feature.
3. If any file performs the contracted operation unguarded, it is a P2 finding (upgraded to P1 if the contract is a security contract).

**security_read_sites cross-check:**
4. If `security_read_sites` is present and non-empty, Phase A1 reads each listed file:line and confirms the immediately surrounding code calls the canonical path-confinement function.
5. A listed site with no confinement call = P1 finding.
6. Sites not in the list are not checked by this mechanism (per-file agents handle general read-site discovery).

**Shared-utilities extraction (Phase 1):**
7. If `depends_on` is non-empty, Phase 1 agent B already scans existing feature docs. After the agent returns, if any dependency has source files that overlap in domain with the new feature - check whether shared infrastructure (error types, DB clients, utility functions) exists that the new feature would duplicate.
8. If overlap is detected, surface it to the user during Phase 1 questions: "Feature X already has [type/client]. Extract to shared module before implementing?"
9. This is a prompt to the user, not a hard gate. The user decides whether to extract.

**MCP tool rules (mdd-rules-mcp.md):**
10. Every MCP tool handler must call `validateMcpInput` as its first statement.
11. At build time: before writing tool logic, confirm `validateMcpInput` is imported and called first. Use the canonical reference tool as the template.
12. At audit time: any MCP tool handler missing a `validateMcpInput` call at the top = P2 finding.
13. Any MCP tool missing a test that asserts it rejects malformed input = P3 finding.

## API Endpoints

n/a - tooling feature

## Data Flow

Tooling only. No runtime data flow.

## Dependencies

- `09-mdd-bug-mode` - bug mode audit uses mdd-audit.md; the satisfies_contracts and P1 changes apply to bug-mode audits too
- `11-mdd-settings` - mdd-rules-mcp.md is a new rule file; install.ts picks it up automatically via the existing glob; 11's source_files list needs mdd-rules-mcp.md added
- `12-mdd-security-rules` - security_read_sites entries are candidate targets for the security scan's gap analysis in future runs

## Security

The P1 extension and security_read_sites field both tighten security coverage. No new attack surface introduced.

## Known Issues

## Bugs

(none yet)
