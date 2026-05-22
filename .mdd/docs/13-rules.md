---
id: 13-rules
title: Stack Rule Files - Additive Audit and Build Checks by Technology
edition: MDD
depends_on: [01-mdd, 03-audit, 02-build]
relates: [08-security-rules]
source_files:
  - commands/mdd-rules-typescript.md
  - commands/mdd-rules-express.md
  - commands/mdd-rules-jwt.md
  - commands/mdd-rules-prisma.md
  - commands/mdd-rules-mcp.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-21
status: complete
phase: all
mdd_version: 11
tags: [rules, stack-rules, typescript, express, jwt, prisma, mcp, audit-criteria, build-checklist, additive-loading]
path: Commands/Rules
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 13 - Stack Rule Files - Additive Audit and Build Checks by Technology

## Purpose

STACK RULE FILES extend the core audit criteria and build checklists for specific
technologies. Each file is loaded when the project's `$MDD_STACK` includes the
corresponding technology name. Rules are additive - they layer on top of core MDD
rules without replacing them. Five files ship with the package:
`mdd-rules-typescript.md`, `mdd-rules-express.md`, `mdd-rules-jwt.md`,
`mdd-rules-prisma.md`, and `mdd-rules-mcp.md`.

## Architecture

Each file contains two sections:

```
### Audit Criteria     — extra P2/P3 findings Claude must look for during /mdd audit
### Build Checklist    — extra Phase 6 checks Claude must apply during /mdd <feature>
```

The router (`mdd.md` Step 0c) sets `$MDD_STACK` from `settings.json` and detected
packages. Audit mode (`mdd-audit.md`) and build mode (`mdd-build.md`) load any
`mdd-rules-{entry}.md` file that matches a `$MDD_STACK` entry before starting their
main phases.

## Rule Files

### mdd-rules-typescript.md

Loaded when `stack.language` includes `typescript`.

**Audit criteria:**

| ID | Severity | Pattern |
|----|----------|---------|
| Switch exhaustiveness | P2 | Switch on string-union/enum with no `default:`, or `default:` returning a value instead of `throw new Error(`unhandled: ${x satisfies never}`)` |
| Type assertion safety | P2 | `as T` on result of `jwt.verify`, `JSON.parse`, or schema output without runtime field narrowing |
| Env startup validation | P2 | `process.env.SECRET \|\| ''` or similar falsy fallback instead of throwing at startup |
| Pattern coverage | P3 | When finding type X is found in a file, all other instances of that pattern in the same file must also be flagged |

**Build checklist (Phase 6):**
- Add startup env validation block before route registration when `required_env` is non-empty
- Every switch on string-union/enum must have `default: throw new Error(\`unhandled: ${x satisfies never}\`)`
- Scan dependency source files for shared infrastructure before duplicating utilities

### mdd-rules-express.md

Loaded when `stack.frameworks` includes `express`.

**Audit criteria:**

| ID | Severity | Pattern |
|----|----------|---------|
| Error handler 5xx leakage | P2 | Error handler forwards raw `Error.message` to client for status >= 500 |
| Open redirect | P2 | `res.redirect()` with user-supplied path from `req.query/body/params` without allowlist |
| Prototype pollution | P2 | `req.query` or `req.body` merged via spread or `Object.assign` without sanitisation |
| Middleware order | P2 | Auth/authz middleware registered after the route handlers it protects |

**Build checklist (Phase 6):**
- Error handler must differentiate 4xx vs 5xx; never expose `err.message` for 5xx
- Any redirect using request data must validate against an explicit allowlist
- Register global middleware before route handlers

### mdd-rules-jwt.md

Loaded when `stack.auth` includes `jwt`.

**Audit criteria:**

| ID | Severity | Pattern |
|----|----------|---------|
| decode() instead of verify() | P2 | `jwt.decode()` used to process incoming token (skips signature check entirely) |
| Unsafe type assertion after verify() | P2 | `jwt.verify()` result cast with `as JwtPayload` without runtime field narrowing |
| Empty-string secret fallback | P2 | JWT secret passed as `process.env.JWT_SECRET \|\| ''` |
| Missing token expiry check | P3 | Token payload used without checking `exp` when library does not enforce it automatically |

**Build checklist (Phase 6):**
- Always `jwt.verify()`, never `jwt.decode()` for authentication
- Runtime-narrow all required payload fields after verify() before use
- Add JWT secrets to `required_env` in the feature doc

### mdd-rules-prisma.md

Loaded when `stack.orm` includes `prisma`.

**Audit criteria:**

| ID | Severity | Pattern |
|----|----------|---------|
| Raw query without parameterisation | P2 | `$queryRaw` or `$executeRaw` with string interpolation instead of tagged templates/`Prisma.sql` |
| Missing transaction for multi-step writes | P2 | Multiple create/update/delete calls in a handler that must be atomic, without `$transaction()` |
| PrismaClient instantiated per request | P3 | `new PrismaClient()` inside request handler or multiple files instead of a single shared instance |
| Unhandled PrismaClientKnownRequestError | P3 | Prisma calls without catching `PrismaClientKnownRequestError` |

**Build checklist (Phase 6):**
- Create `src/lib/prisma.ts` with single shared `PrismaClient` instance; import everywhere
- Multi-table write handlers must use `prisma.$transaction()`
- Wrap Prisma calls in try/catch and handle `PrismaClientKnownRequestError`

### mdd-rules-mcp.md

Loaded when `stack.frameworks` includes `mcp`.

**Audit criteria:**

| ID | Severity | Pattern |
|----|----------|---------|
| Missing input validation | P2 | MCP tool handler does not call `validateMcpInput` (or project-equivalent) as its first statement |
| No malformed input test | P3 | MCP tool handler has no test asserting it rejects malformed or missing input |

**Build checklist (Phase 6):**
- `validateMcpInput` must be the first call in every new tool handler
- Add a rejection test for every new MCP tool (malformed input returns structured error, not unhandled throw)

## Business Rules

- Rule files are loaded additively - they add criteria, they do not replace core MDD rules
- A `$MDD_STACK` entry must match the filename suffix exactly: `typescript`, `express`, `jwt`, `prisma`, `mcp`
- Rules do not fire if the corresponding stack entry is not in `$MDD_STACK`
- The P3 pattern-coverage rule in typescript applies globally: finding one instance of a pattern
  requires scanning the entire file for all other instances before closing the finding

## Data Flow

Reads: `commands/mdd-rules-{entry}.md` (loaded by audit and build modes when stack matches).
Writes: nothing directly - rules affect the behavior of audit and build phases.

## Dependencies

Loaded by `01-mdd` (Step 0c sets `$MDD_STACK`), consumed by `03-audit` and `02-build`.

## Security

Not applicable - files are static rule definitions read by the workflow engine.

## Known Issues

- The `mcp` rule file uses " - " (space-hyphen-space) as a separator in heading IDs
  (`P2 - Missing Input Validation`) while all other rule files use " - " consistently.
  This is cosmetic but breaks the consistent naming pattern if headings are ever parsed
  programmatically.
- No version marker or frontmatter in any rule file. If a rule is updated, there is no
  mechanism to detect that an installed copy is stale compared to the package version.
- The TypeScript P3 pattern-coverage rule applies "per file" but "per file" is not defined:
  it is unclear whether this means the source file being audited or all files in the project.

## Bugs

(none yet - populated by /mdd bug when issues are reported)
