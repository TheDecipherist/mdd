## MDD Rules — Express

Rules loaded when `stack.frameworks` includes `express`. Applied additively to audit criteria and build checklists.

### Audit Criteria

#### P2 — Error Handler 5xx Leakage
- Express (or equivalent HTTP framework) error handler forwards raw `Error.message` to the client without differentiating expected errors (4xx) from unexpected errors (5xx). For responses with status >= 500, always return a generic message (`'Internal server error'`) — never the raw exception message. Exposing Prisma connection errors, stack traces, or internal paths to clients is a P2 finding.

#### P2 — Open Redirect
- `res.redirect()` called with a user-supplied path (from `req.query`, `req.body`, `req.params`) without allowlist validation. Any redirect target that an attacker can control is a P2 finding.

#### P2 — Prototype Pollution via Body/Query Merge
- `req.query` or `req.body` merged into a plain object using spread, `Object.assign`, or similar without sanitisation. Use `structuredClone()` or a safe merge utility. Reference: CVE-2024-29041 class.

#### P2 — Middleware Order
- Authentication or authorisation middleware registered after route handlers it is meant to protect — P2. Middleware order in Express is execution order; a route registered before `app.use(authMiddleware)` is unprotected.

### Build Checklist (Phase 6)

- **Error handler shape:** Error handler must differentiate 4xx vs 5xx. Never forward `err.message` for status >= 500.
- **Redirect validation:** Any `res.redirect()` that uses request-supplied data must validate against an explicit allowlist before redirecting.
- **Middleware order:** Register global middleware (auth, rate limiting, body parsing) before route handlers, not after.
