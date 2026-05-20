## MDD Rules — TypeScript

Rules loaded when `stack.language` includes `typescript`. Applied additively to audit criteria and build checklists.

### Audit Criteria

#### P2 — Switch Exhaustiveness
- Switch statement on a string-union type or operation enum has no `default:` case — P2.
- Switch `default:` returns any value (`''`, `undefined`, a node, etc.) instead of throwing with `satisfies never` — P2. Correct pattern: `default: throw new Error(\`unhandled: \${x satisfies never}\`)`.

#### P2 — Type Assertion Safety
- Type assertion (`as T`) used on the result of an external decode operation (`jwt.verify`, `JSON.parse`, schema validation output) without runtime narrowing on required fields — P2. Required fields must be checked with `typeof field === 'string'` (or equivalent) before use.

#### P2 — Environment Startup Validation
- Required environment variable accessed with an empty-string or falsy fallback (e.g. `process.env.SECRET || ''`) instead of throwing at startup when absent — P2. A server that boots silently with a missing secret is a latent vulnerability.

#### P3 — Pattern Coverage in File
- When a finding of type X is found in a file, grep the entire file for all other instances of the same pattern before marking the finding complete. A single finding does not imply the rest of the file is clean — P3 if additional instances are present and unflagged.

### Build Checklist (Phase 6)

- **Env validation block:** If `required_env` is non-empty in the feature doc, add a startup validation block to the server entry point before any route registration:
  ```typescript
  const REQUIRED_ENV = ['SECRET_KEY', 'DB_URL'];
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
  }
  ```
- **Switch exhaustiveness:** Every switch on a string-union or enum type must have a `default: throw new Error(\`unhandled: \${x satisfies never}\`)` branch.
- **Shared utilities:** If `depends_on` is non-empty, scan the dependency's source files for shared infrastructure (error types, DB clients, utility functions). If the new feature would duplicate them, extract to a shared module before implementing.
