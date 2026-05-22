---
id: 12-mdd-security-rules
title: MDD Security Rules - Vulnerability-Driven Rule Generator
edition: Both
depends_on: [11-mdd-settings]
source_files:
  - commands/mdd-security-rules.md
  - commands/mdd-audit.md
  - commands/mdd.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-20
status: complete
phase: all
mdd_version: 11
tags: [security, vulnerability, rules, auto-generate, snyk, npm-audit, osv, stack-scan, rule-generation]
path: Tooling/Security
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 12 - MDD Security Rules - Vulnerability-Driven Rule Generator

## Purpose

Scans the project's declared stack for known vulnerabilities using free tools (npm audit, OSV Scanner, Snyk CLI) and translates any unaddressed findings into new MDD audit rules. If a vulnerability pattern is not already covered by a rule in the relevant `mdd-rules-{stack}.md` file, a new rule is generated and appended. This keeps rule files current without manual maintenance.

## Architecture

```
Trigger: /mdd audit (when securityScan: true in settings.json)
         OR on demand: /mdd security-rules

Phase SS0 - Read current rules
  └─ load all mdd-rules-{stack}.md files for the declared stack
  └─ extract existing rule descriptions into a comparison set

Phase SS1 - Scan
  └─ for each stack entry:
       └─ run available scanner(s): npm audit / OSV Scanner / Snyk CLI
       └─ collect findings: CVE ID, package, severity, description, attack vector

Phase SS2 - Gap analysis
  └─ for each finding:
       └─ compare attack vector / vulnerability class against existing rules
       └─ if a rule already covers this pattern: skip
       └─ if not covered: mark as rule-gap

Phase SS3 - Rule generation
  └─ for each rule-gap:
       └─ derive a language-agnostic audit rule from the vulnerability class
       └─ format as MDD rule (P1/P2/P3 based on CVE severity)
       └─ append to mdd-rules-{stack}.md

Phase SS4 - Report
  └─ write scan summary: findings checked, gaps found, rules added
  └─ present to user
```

Rule generation is done by Claude, not by a template. The goal is a rule that catches the vulnerability *class*, not just the specific CVE - so future audits catch similar patterns even before they appear in vulnerability databases.

## Data Model

**Scanner inputs** (read from project root):
- `package.json` / `package-lock.json` - Node/JS dependency trees
- `go.sum` / `go.mod` - Go modules
- `pyproject.toml` / `requirements.txt` - Python packages
- `composer.lock` - PHP packages

**Rule gap record** (in-memory during scan):
```
{
  cve: "CVE-2024-XXXXX",
  scanner: "npm-audit",
  package: "express",
  severity: "high",
  attack_vector: "prototype pollution via req.query",
  covered_by_rule: false,
  generated_rule: "..."
}
```

**Generated rule format** (appended to `mdd-rules-{stack}.md`):
```markdown
- [P2] {attack_vector_description} - check for {pattern}. Reference: {CVE_ID}.
```

**Scan summary** (written to `.mdd/audits/security-scan-{date}.md`):
```
Sources checked: npm audit, OSV
Findings reviewed: N
Already covered: N
Gaps found: N
New rules generated: N
  - mdd-rules-express.md: +2 rules
  - mdd-rules-jwt.md: +1 rule
```

## Business Rules

**Scanner selection:**
1. Scanners are tried in order of availability: `npm audit` (built-in for Node) -> `osv-scanner` (free CLI, multi-language) -> `snyk` (free CLI tier, if installed)
2. At least one scanner must succeed for the scan to produce results; if none are available for the declared stack, warn and skip - never halt
3. No API keys required - only free-tier / open tools

**Rule generation:**
4. Before generating a rule, check all existing rules in the relevant `mdd-rules-{stack}.md` file for semantic overlap - do not add a rule that is already covered by different wording
5. Generated rules target the vulnerability *class* (e.g. "unvalidated redirect", "prototype pollution"), not the specific package version - rules should outlive the CVE that inspired them
6. Severity mapping: CVSS critical/high -> P2, medium -> P3, low -> P4. P1 is reserved for MDD's own hardcoded security invariants and is never auto-generated
7. Each generated rule includes the source CVE ID as a reference so it can be traced and reviewed

**Deduplication:**
8. Rules generated in this session are not re-generated on the next scan run - the CVE ID in the rule comment acts as a dedup key
9. If a user manually edits or removes a generated rule, the scanner will regenerate it on the next run (no persistent "dismissed" state)

**Scope:**
10. The scanner only generates *audit rules* - it does not modify project source code or install patches
11. Generated rules go into `mdd-rules-{stack}.md` files, not into the core `mdd-audit.md` criteria - they are stack-specific additions, not universal rules

**Failure handling:**
12. Any individual scanner failure (network timeout, tool not installed, parse error) skips that scanner with a one-line warning - the phase continues with whatever results are available
13. If zero findings are returned (clean bill of health), report that and exit cleanly - no rules generated

## Dependencies

- `11-mdd-settings` - `securityScan: true` gate in settings.json enables this feature; stack declaration tells the scanner which ecosystems to check

## Security

The scanner runs locally using CLI tools - no project source code or credentials are sent to external services beyond what those tools normally do (e.g. npm audit sends the dependency manifest to the npm registry). Users on air-gapped networks should set `securityScan: false`.

The generated rules are plain text appended to markdown files - no code execution, no external writes beyond the local `mdd-rules-*.md` files and `.mdd/audits/`.

## Known Issues

## Bugs

(none yet - populated by /mdd bug when issues are reported)
