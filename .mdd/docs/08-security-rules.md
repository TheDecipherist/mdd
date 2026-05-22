---
id: 08-security-rules
title: Security Rules Mode - Vulnerability-Driven Audit Rule Generator
edition: MDD
depends_on: [01-mdd, 13-rules]
relates: [00-frontmatter-spec, 03-audit, 11-manage]
source_files:
  - commands/mdd-security-rules.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [security, vulnerability, scan, cve, npm-audit, osv, snyk, rule-generation, stack-aware]
path: Commands/Security
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 08 - Security Rules Mode - Vulnerability-Driven Audit Rule Generator

## Purpose

SECURITY RULES MODE scans the project for known vulnerabilities using standard security tools
and generates new MDD audit rules from any gaps not already covered. It does not patch code or
install packages - it produces audit rules that AUDIT MODE will check against. Triggered by
`/mdd security-rules` or automatically by AUDIT MODE when `securityScan: true` in settings.

## Architecture

Four phases:

```
SS0  Read Current Rules  — load all existing mdd-rules-*.md files; build comparison set
SS1  Scan               — run npm audit, osv-scanner, snyk (in priority order); parse JSON
SS2  Gap Analysis       — for each finding: CVE dedup, then semantic coverage check
SS3  Rule Generation    — write new rules to mdd-rules-<stack>.md; create files if needed
SS4  Report             — write security-scan-<date>.md summary
```

### SS0 - Read Current Rules

For each entry in `$MDD_STACK`, checks if `$MDD_DIR/mdd-rules-{entry}.md` exists. Extracts
all existing rules as `[P{N}] {description}` lines plus any `Reference: CVE-*` annotations.
Builds `$EXISTING_RULES` as the deduplication baseline.

### SS1 - Scan

Runs scanners in priority order (stops at first applicable set):
1. `npm audit --json` — for projects with `package.json` + `package-lock.json`
2. `osv-scanner --format json .` — if installed
3. `snyk test --json` — if installed

If a scanner fails: one-line warning, continues. If no scanners apply to the stack: warns and
skips to SS4 with zero findings. Deduplicates across scanners by CVE ID, preferring richer
descriptions.

### SS2 - Gap Analysis

Two-step check per finding:
1. **CVE dedup:** exact match against existing rules' `Reference: {cve_id}`. If found, already
   covered - skip.
2. **Semantic coverage:** check if any existing rule addresses the same vulnerability class
   (not the same CVE). Prototype pollution and path traversal from different packages are the
   same class.

Gaps are mapped to the most relevant `$MDD_STACK` entry (falls back to ecosystem name).

### SS3 - Rule Generation

Rule format:
```
- [P{N}] {attack_vector_description} - {what to check for}. Reference: {CVE_ID}.
```

Severity mapping: critical/high → P2, medium → P3, low → P4. P1 is never auto-generated -
it is reserved for hardcoded security invariants that require human review.

Rules describe vulnerability classes, not specific package versions. Good: "Unvalidated redirect
destination allows open redirect - check redirect targets are validated against an allowlist."
Bad: "express 4.x open redirect via res.location() - upgrade to 4.19.2."

Rules are appended under `## Security (auto-generated)` in `mdd-rules-{stack-entry}.md`.
Creates the file with a minimal header if it does not yet exist.

### SS4 - Report

Writes `.mdd/audits/security-scan-<YYYY-MM-DD>.md` with: scanner status and finding counts,
results summary (findings reviewed, already covered, new gaps, new rules generated), full text
of each generated rule.

When invoked as a sub-task of AUDIT MODE (`$MDD_SECURITY_SCAN = true`), suppresses user-facing
output and only writes the report file.

## Business Rules

- P1 rules are never auto-generated
- Rules target vulnerability classes, not specific package versions
- CVE dedup runs before semantic coverage check (prevents both duplicate and near-duplicate rules)
- Scanner failures are non-fatal; audit continues with remaining scanners
- `$MDD_STACK` must be set by `mdd.md` Step 0c before this mode runs
- `$MDD_SECURITY_SCAN` implicit contract: AUDIT MODE must set this variable before calling SS
  phases, but this dependency is not documented in `integration-context.md` or the settings doc

## Data Flow

Reads: `$MDD_DIR/mdd-rules-*.md` (SS0); `package.json`, scanner output (SS1).
Writes: appends to or creates `mdd-rules-{stack}.md` files (SS3); creates
`.mdd/audits/security-scan-<date>.md` (SS4).

## Dependencies

Requires `01-mdd` (settings bootstrap sets `$MDD_STACK`). Extends `13-rules` by adding new
rule entries to stack-specific rule files.

## Security

This mode runs external security scanners on the local project. Scanner binaries (npm, osv-scanner,
snyk) must already be installed; this mode does not install them. Generated rules contain only
CVE references and pattern descriptions - no credentials or secrets.

## Known Issues

- `$MDD_STACK` is used throughout but never defined within this file. It is an implicit
  dependency on the caller's execution context (set by `mdd.md` Step 0c).
- `$MDD_SECURITY_SCAN` implicit contract with AUDIT MODE is not documented in
  `integration-context.md`.
- CVSS critical severity is mapped to P2 (same as high), potentially under-weighting critical
  vulnerabilities.
- Phase log calls use `[ "$MDD_PHASE_LOGGING" = "false" ] || bash ...` guard form, which is
  inconsistent with all other command files that use bare `bash ...` calls.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
