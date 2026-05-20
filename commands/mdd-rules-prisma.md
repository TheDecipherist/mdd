## MDD Rules — Prisma

Rules loaded when `stack.orm` includes `prisma`. Applied additively to audit criteria and build checklists.

### Audit Criteria

#### P2 — Raw Query Without Parameterisation
- `prisma.$queryRaw` or `prisma.$executeRaw` used with string interpolation (`` `SELECT ... WHERE id = ${userId}` ``) instead of tagged template literals or `Prisma.sql` — P2. Raw string interpolation bypasses Prisma's parameterisation and is vulnerable to SQL injection.

#### P2 — Missing Transaction for Multi-Step Writes
- Multiple `prisma.model.create/update/delete` calls in a single handler without wrapping in `prisma.$transaction()` — P2 when the operations must be atomic (e.g. deducting balance and creating a record).

#### P3 — PrismaClient Instantiated Per Request
- `new PrismaClient()` called inside a request handler or per-import in multiple files — P3. A single shared client instance should be created once (e.g. `src/lib/prisma.ts`) and imported everywhere. Multiple instances exhaust the connection pool.

#### P3 — Unhandled PrismaClientKnownRequestError
- Prisma operations in request handlers without catching `PrismaClientKnownRequestError` — P3. Uncaught Prisma errors surface as 500s with internal schema details in the default Express error handler.

### Build Checklist (Phase 6)

- **Single shared client:** Create `src/lib/prisma.ts` exporting one `PrismaClient` instance. Import it everywhere — never instantiate in handlers.
- **Transactions for atomic operations:** Any handler that writes to multiple tables must use `prisma.$transaction()`.
- **Catch Prisma errors:** Wrap Prisma calls in try/catch and handle `PrismaClientKnownRequestError` with appropriate HTTP responses.
