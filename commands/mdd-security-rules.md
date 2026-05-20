## SECURITY RULES MODE — `/mdd security-rules`

Triggered when arguments start with `security-rules`. Also triggered automatically by AUDIT MODE when `$MDD_SECURITY_SCAN` is `true` (set via `securityScan: true` in `.mdd/settings.json`).

This mode scans the project's declared stack for known vulnerabilities using free, locally-available tools, then compares each finding against existing MDD stack rule files. Any vulnerability pattern not already covered by an existing rule becomes a new rule, appended to the relevant `mdd-rules-{stack}.md` file. The goal is to keep rule files current without manual maintenance.

**No API keys or paid accounts required.** All scanners used are free-tier or open tools.

**This mode only generates audit rules.** It does not patch dependencies, modify source code, or install anything.

---

### Phase SS0 — Read Current Rules

```bash
[ "$MDD_PHASE_LOGGING" = "false" ] || bash ~/.claude/hooks/mdd-log-phase.sh "mdd-security-rules" "Phase SS0" start "$MDD_STACK"
```

Load all existing MDD stack rule files so the gap analysis in Phase SS2 has something to compare against.

**Step 1 — Locate rule files:**

For each entry in `$MDD_STACK`, check whether `$MDD_DIR/mdd-rules-{entry}.md` exists. Build two lists:

- `$RULE_FILES_FOUND` — entries that have a rule file
- `$RULE_FILES_MISSING` — entries with no rule file yet (a new file will be created in Phase SS3 if needed)

**Step 2 — Extract existing rule descriptions:**

For each file in `$RULE_FILES_FOUND`, read every bullet line that matches the MDD rule format:
```
- [P{N}] {description}
```

Extract the description text from each rule into a comparison set. Also extract any `Reference: CVE-XXXX-XXXXX` tokens present — these are the dedup keys used in Phase SS2.

Store the full set in memory as `$EXISTING_RULES` — a list of objects:
```
{
  stack_entry: "express",
  priority: "P2",
  description: "...",
  cve_refs: ["CVE-2024-12345"]   // empty array if no Reference tag
}
```

If no rule files exist at all, `$EXISTING_RULES` is empty and every finding in Phase SS1 will be treated as a gap.

```bash
[ "$MDD_PHASE_LOGGING" = "false" ] || bash ~/.claude/hooks/mdd-log-phase.sh "mdd-security-rules" "Phase SS0" end "$MDD_STACK"
```

---

### Phase SS1 — Scan

```bash
[ "$MDD_PHASE_LOGGING" = "false" ] || bash ~/.claude/hooks/mdd-log-phase.sh "mdd-security-rules" "Phase SS1" start "$MDD_STACK"
```

Run vulnerability scanners against the project. Scanners are tried in priority order. Each failure is a one-line warning — never a halt.

**Scanner priority order:**

1. `npm audit` — Node/JS projects. Available if `package.json` or `package-lock.json` exists in the project root.
2. `osv-scanner` — multi-language (Node, Go, Python, PHP, Ruby). Available if installed (`which osv-scanner`).
3. `snyk` — multi-language, free CLI tier. Available if installed (`which snyk`).

**Running each scanner:**

For `npm audit`:
```bash
npm audit --json 2>/dev/null
```
Parse the JSON output. For each finding extract: `name` (package), `severity`, `via[].title` or `via[].url` for the vulnerability description, `via[].cve` or the advisory ID as the CVE ref, and the `fixAvailable` field.

For `osv-scanner`:
```bash
osv-scanner --format json . 2>/dev/null
```
Parse the JSON output. For each result entry extract: `packages[].package.name`, `packages[].package.ecosystem`, `vulnerabilities[].id` (the CVE or OSV ID), `vulnerabilities[].summary`, `vulnerabilities[].database_specific.severity`.

For `snyk`:
```bash
snyk test --json 2>/dev/null
```
Parse the JSON output. For each vulnerability in `vulnerabilities[]` extract: `packageName`, `severity`, `title`, `identifiers.CVE[0]` as the CVE ref, and `description`.

**Failure handling for each scanner:**

If a scanner is not installed, outputs non-JSON, exits with a parse error, or times out after 30 seconds:
- Emit one line: `⚠ {scanner-name} skipped: {reason}`
- Continue with remaining scanners

If zero scanners are applicable to the declared stack (e.g., Go-only project with no `osv-scanner` installed), emit:
```
⚠ No scanners available for stack: {$MDD_STACK}
  Install osv-scanner (https://google.github.io/osv-scanner/) for multi-language support.
```
Then skip to Phase SS4 with zero findings.

**Aggregate all findings** from all successful scanners into `$SCAN_FINDINGS`:
```
{
  scanner: "npm-audit",
  package: "express",
  ecosystem: "npm",
  severity: "high",          // critical | high | medium | low
  cve_id: "CVE-2024-29041",
  title: "Open redirect in express",
  description: "...",
  attack_vector: "open redirect via unvalidated Location header"
}
```

Deduplicate by `cve_id` — if two scanners report the same CVE, keep one entry (prefer the one with the richer description).

```bash
[ "$MDD_PHASE_LOGGING" = "false" ] || bash ~/.claude/hooks/mdd-log-phase.sh "mdd-security-rules" "Phase SS1" end "$MDD_STACK"
```

---

### Phase SS2 — Gap Analysis

```bash
[ "$MDD_PHASE_LOGGING" = "false" ] || bash ~/.claude/hooks/mdd-log-phase.sh "mdd-security-rules" "Phase SS2" start "$MDD_STACK"
```

For each finding in `$SCAN_FINDINGS`, determine whether the vulnerability pattern is already covered by an existing rule.

**How the gap check works:**

This is a semantic comparison, not a string match. A finding is covered if an existing rule already addresses the same vulnerability *class* — even if the rule was written in different words or references a different CVE.

Apply the following two-step check in order:

**Step 1 — CVE dedup (exact match):**
If any rule in `$EXISTING_RULES` contains `Reference: {cve_id}` where `cve_id` matches the finding's CVE ID exactly — the finding is already covered. Skip it. This prevents regenerating rules that were added by a previous security scan.

**Step 2 — Semantic coverage check:**
Read the finding's `attack_vector` and `title`. Then ask: does any existing rule in `$EXISTING_RULES` address the same vulnerability class?

Examples of semantic coverage (do NOT regenerate):
- Finding: "prototype pollution via `req.query`" — covered by any rule mentioning prototype pollution on user-supplied input
- Finding: "ReDoS via malformed email input" — covered by any rule about regex denial-of-service or unbounded regex on user input
- Finding: "path traversal in static file serving" — covered by any rule requiring path confinement or jailRoot validation

Examples where a new rule IS needed (not semantically covered):
- Finding: "open redirect via unvalidated Location header" — NOT covered by a rule about SSRF (different class)
- Finding: "timing attack on HMAC comparison" — NOT covered by a generic input validation rule

If the finding passes both checks with no coverage match, it is a **gap** — add it to `$RULE_GAPS`.

**Classify each gap by stack entry:**

Map the gap's `package` or `ecosystem` back to the most relevant stack entry in `$MDD_STACK`. If no entry matches directly, use the ecosystem name as a fallback stack label (e.g., `npm`, `pypi`).

```bash
[ "$MDD_PHASE_LOGGING" = "false" ] || bash ~/.claude/hooks/mdd-log-phase.sh "mdd-security-rules" "Phase SS2" end "$MDD_STACK"
```

---

### Phase SS3 — Rule Generation

```bash
[ "$MDD_PHASE_LOGGING" = "false" ] || bash ~/.claude/hooks/mdd-log-phase.sh "mdd-security-rules" "Phase SS3" start "$MDD_STACK"
```

For each gap in `$RULE_GAPS`, generate a new MDD audit rule and append it to the relevant rule file.

**Severity mapping (CVSS → MDD priority):**

| CVSS severity | MDD priority |
|---|---|
| critical | P2 |
| high | P2 |
| medium | P3 |
| low | P4 |

P1 is reserved for MDD's own hardcoded security invariants and is **never auto-generated** by this mode.

**Rule format:**

```markdown
- [P{N}] {attack_vector_description} - {what to check for}. Reference: {CVE_ID}.
```

**Writing a good generated rule:**

The rule must target the vulnerability *class*, not the specific package version or CVE instance. A good rule catches the pattern in new code and in dependency updates before they appear in future vulnerability databases.

Guidelines:
- Describe the attack vector in general terms (e.g., "unvalidated redirect destination", "prototype pollution via query parameters", "timing-unsafe string comparison for secrets")
- State what the audit should check for — a concrete, actionable thing to look at in code review
- Include the CVE ID as a `Reference:` tag so the dedup check in future scans can identify it
- Write the rule in the same imperative style as existing rules in the file

Good example:
```markdown
- [P2] Unvalidated redirect destination allows open redirect attacks - check that redirect targets are validated against an allowlist or are relative paths only. Reference: CVE-2024-29041.
```

Bad example (too CVE-specific, won't catch future variants):
```markdown
- [P2] express 4.x open redirect via res.location() - upgrade to 4.19.2. Reference: CVE-2024-29041.
```

**Appending to rule files:**

For each stack entry with new rules:
1. Check whether `$MDD_DIR/mdd-rules-{stack-entry}.md` exists.
   - If yes: append the new rules to the end of the file.
   - If no: create the file with a minimal header and the new rules:
     ```markdown
     # MDD Rules — {stack-entry}
     
     Stack-specific audit rules for {stack-entry}. Auto-generated from vulnerability scan results.
     
     ```
2. Append each new rule as a bullet line under a `## Security (auto-generated)` section header.
   - If that section already exists in the file: append to it.
   - If it does not exist yet: add it before appending rules.

Track how many rules were added per file for the Phase SS4 summary.

```bash
[ "$MDD_PHASE_LOGGING" = "false" ] || bash ~/.claude/hooks/mdd-log-phase.sh "mdd-security-rules" "Phase SS3" end "$MDD_STACK"
```

---

### Phase SS4 — Report

```bash
[ "$MDD_PHASE_LOGGING" = "false" ] || bash ~/.claude/hooks/mdd-log-phase.sh "mdd-security-rules" "Phase SS4" start "$MDD_STACK"
```

Write the scan summary to `.mdd/audits/security-scan-{YYYY-MM-DD}.md` (date from current date).

**Summary file format:**

```markdown
# Security Scan — {YYYY-MM-DD}

## Sources

| Scanner | Status | Findings |
|---------|--------|----------|
| npm audit | ok | {N} |
| osv-scanner | skipped: not installed | - |
| snyk | ok | {N} |

## Results

Findings reviewed:   {N}
Already covered:     {N}
New gaps found:      {N}
New rules generated: {N}

### Rules Added

- mdd-rules-{stack-entry}.md: +{N} rules
- mdd-rules-{stack-entry}.md: +{N} rules

### New Rules (full text)

{list each generated rule with its target file}
```

If zero findings were returned across all scanners (clean bill of health):

```markdown
# Security Scan — {YYYY-MM-DD}

All scanners returned zero findings. No new rules generated.

Scanners run: {list}
Stack checked: {$MDD_STACK}
```

**Present to the user:**

```
Security scan complete — {YYYY-MM-DD}

Scanners:    {list of scanners that ran} ({N} skipped)
Findings:    {N} total, {N} new gaps
Rules added: {N} ({list of files updated})

Full report: .mdd/audits/security-scan-{YYYY-MM-DD}.md
```

If running as a sub-task of AUDIT MODE (triggered via `$MDD_SECURITY_SCAN`), suppress the user-facing output above — just write the file and return. AUDIT MODE's own output will surface the result.

```bash
[ "$MDD_PHASE_LOGGING" = "false" ] || bash ~/.claude/hooks/mdd-log-phase.sh "mdd-security-rules" "Phase SS4" end "$MDD_STACK"
```

```bash
[ "$MDD_PHASE_LOGGING" = "false" ] || bash ~/.claude/hooks/mdd-log-phase.sh "mdd-security-rules" "-" "complete" "$MDD_STACK"
```
