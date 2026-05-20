## MDD Rules — JWT

Rules loaded when `stack.auth` includes `jwt`. Applied additively to audit criteria and build checklists.

### Audit Criteria

#### P2 — decode() Instead of verify()
- `jwt.decode()` used instead of `jwt.verify()` to process an incoming token — P2. `decode()` skips signature verification entirely. Any token, including a forged one, will appear valid. Always use `jwt.verify()` with the secret/public key.

#### P2 — Unsafe Type Assertion After verify()
- `jwt.verify()` result cast with a type assertion (`as JwtPayload`) without runtime narrowing on required fields — P2. `verify()` returns `string | JwtPayload`; casting directly sets fields to `undefined as string` when the payload shape doesn't match. Required fields (`sub`, `email`, `id`, etc.) must be checked with `typeof field === 'string'` before use.

#### P2 — Empty-String Secret Fallback
- JWT signing or verification called with an empty-string fallback for the secret (e.g. `process.env.JWT_SECRET || ''`) — P2. A server that signs tokens with `''` is equivalent to having no secret. Secret must be validated at startup.

#### P3 — Missing Token Expiry Check
- Token payload used without checking `exp` field when the library does not enforce it automatically — P3. Always pass `{ ignoreExpiration: false }` explicitly or verify the library's default behaviour.

### Build Checklist (Phase 6)

- **Always use verify(), never decode():** `jwt.decode()` is for inspecting token structure only — never for authentication.
- **Runtime narrowing after verify():** After `jwt.verify()`, check that all required payload fields exist and are the expected type before using them.
- **Secret at startup:** Add JWT secret(s) to `required_env` in the feature doc and add a startup validation block.
