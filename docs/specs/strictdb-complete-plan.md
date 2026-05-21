# StrictDB — Complete Unified Plan

## Context

StrictDB is a new npm package that lets developers talk the exact same "read/write language" to any database — MongoDB, PostgreSQL, MySQL, MSSQL, SQLite, or Elasticsearch. Instead of learning different APIs for each database, developers use one MongoDB-style object filter syntax everywhere, and StrictDB translates it to the native query language under the hood.

StrictDB is also the first database driver built AI-first — with guardrails, self-correcting errors, schema discovery, dry-run validation, and an MCP server that lets AI agents talk to any database without writing driver-specific code.

We're building on two production-tested wrappers:
- `src/core/db/mongo.ts` — MongoDB wrapper (aggregation-only reads, bulkWrite writes, NoSQL sanitization)
- `src/core/db/sql.ts` — SQL wrapper (auto-driver detection, parameterized queries, 4 SQL backends)

Additionally, StrictDB includes an Elasticsearch adapter that translates the same MongoDB-style filters into Elasticsearch's Query DSL, leveraging ES's native bulk API and JSON document model.

---

## Architecture Principles — Modularity

StrictDB is designed so every feature is a standalone module with a single responsibility. This is a hard rule, not a suggestion.

### Rules

1. **One file, one job.** `guardrails.ts` does guardrails. `sanitize.ts` does sanitization. `receipts.ts` does receipts. No file does two things.

2. **Adapters are independent.** Fix the Elasticsearch sanitizer without touching MongoDB. Add a new adapter (Redis, DynamoDB, CouchDB) without changing the core. Each adapter implements the same `DatabaseAdapter` interface and nothing else.

3. **Features are opt-in layers.** Guardrails, schema validation, logging, sanitization — each wraps the adapter pipeline independently. Disable one, the others keep working. Add a new layer without modifying existing layers.

4. **The pipeline flows in one direction:**
   ```
   Developer/AI call → StrictDB.ts (router)
     → sanitize.ts (clean input)
     → guardrails.ts (block dangerous ops)
     → validate.ts (schema check if enabled)
     → adapter (mongo/sql/elastic)
     → receipts.ts (wrap result)
     → logger.ts (emit event)
     → return to caller
   ```
   Each step receives data, does its job, passes it forward. No step reaches back into a previous step.

5. **Types are shared, logic is not.** `types.ts` is the only file every other file imports. No circular dependencies. No file imports from an adapter. The adapters import from core types and their own driver — nothing else.

6. **Tests mirror modules.** Every `src/foo.ts` has a `tests/foo.test.ts`. No shared test state. Each test file runs independently.

### Why This Matters

- **For AI agents:** Claude Code can modify `sanitize.ts` without understanding `reconnect.ts`. Smaller context = better code.
- **For contributors:** Someone can add a Redis adapter without reading the MongoDB code.
- **For debugging:** A bug in Elasticsearch receipts is in `elastic-adapter.ts` or `receipts.ts`. Nowhere else.
- **For extending:** New feature = new file + wire it into the pipeline in `strictdb.ts`. No refactoring.

---

## Project Structure

```
strictdb/
├── AI.md                           # Token-optimized AI reference (ships in package)
├── CLAUDE.md                       # Claude Code enforcement rules (ships in package)
├── src/
│   ├── index.ts                    # Public API entry point (re-exports everything)
│   ├── strictdb.ts                 # Main StrictDB class — the unified interface
│   ├── types.ts                    # All shared types and interfaces
│   ├── filter-translator.ts        # MongoDB-style filter → SQL WHERE / ES Query DSL translator
│   ├── schema.ts                   # Optional Zod schema integration + SQL DDL + ES mapping generation
│   ├── events.ts                   # Event system — normalized errors, status, reconnects
│   ├── reconnect.ts                # Auto-reconnect logic for all backends
│   ├── errors.ts                   # StrictDBError hierarchy — self-correcting error messages
│   ├── guardrails.ts               # Dangerous operation protection (empty filters, unbounded queries)
│   ├── receipts.ts                 # Structured operation receipts on every write
│   ├── describe.ts                 # Schema discovery / introspection (db.describe)
│   ├── validate.ts                 # Pre-execution dry run validation (db.validate)
│   ├── explain.ts                  # Query explanation — shows native query (db.explain)
│   ├── batch.ts                    # Automatic operation batching (db.batch)
│   ├── sanitize.ts                 # Input sanitization — backend-specific (NoSQL, SQL, ES)
│   ├── logger.ts                   # Structured operation logging with audit trail
│   ├── adapters/
│   │   ├── adapter.ts              # Abstract adapter interface
│   │   ├── mongo-adapter.ts        # MongoDB adapter (wraps core/db/mongo.ts)
│   │   ├── sql-adapter.ts          # SQL adapter (wraps core/db/sql.ts)
│   │   └── elastic-adapter.ts      # Elasticsearch adapter (@elastic/elasticsearch)
│   └── core/
│       └── db/
│           ├── mongo.ts            # Existing MongoDB wrapper (already copied)
│           └── sql.ts              # Existing SQL wrapper (already copied)
├── rules/
│   └── rulecatch.json              # RuleCatch rule definitions for StrictDB enforcement
├── hooks/
│   └── pre-commit.sh               # Git hook — blocks direct driver imports
├── mcp/
│   ├── server.ts                   # MCP server entry point
│   ├── tools.ts                    # MCP tool definitions with Zod-generated schemas
│   └── package.json                # Separate package: strictdb-mcp
├── tests/
│   ├── filter-translator.test.ts   # Filter translation unit tests (SQL + ES)
│   ├── schema.test.ts              # Schema validation + DDL + ES mapping tests
│   ├── events.test.ts              # Event system tests
│   ├── reconnect.test.ts           # Reconnect logic tests
│   ├── errors.test.ts              # Error normalization + self-correction tests
│   ├── guardrails.test.ts          # Dangerous operation protection tests
│   ├── sanitize.test.ts            # Input sanitization tests (all backends)
│   ├── receipts.test.ts            # Operation receipt tests
│   ├── describe.test.ts            # Schema discovery tests
│   ├── validate.test.ts            # Dry run validation tests
│   ├── explain.test.ts             # Query explanation tests
│   ├── batch.test.ts               # Batch operation tests
│   ├── elastic-adapter.test.ts     # Elasticsearch adapter integration tests
│   ├── mongo-adapter.test.ts       # MongoDB adapter integration tests
│   ├── sql-adapter.test.ts         # SQL adapter integration tests
│   ├── mcp.test.ts                 # MCP server tool tests
│   └── strictdb.test.ts            # End-to-end unified API tests
├── package.json
├── tsconfig.json
├── .gitignore
├── .env
└── .env.example
```

---

## Core Types — `src/types.ts`

```typescript
import type { z } from 'zod';

// ─── Filter Operators (MongoDB-style, universal) ─────────────────────────

export type FilterValue<T> = T | FilterOperators<T>;

export interface FilterOperators<T> {
  $eq?: T;
  $ne?: T;
  $gt?: T;
  $gte?: T;
  $lt?: T;
  $lte?: T;
  $in?: T[];
  $nin?: T[];
  $exists?: boolean;
  $regex?: string | RegExp;
  $options?: string;
  $not?: FilterOperators<T>;
  $size?: number;
}

export interface LogicalFilter<T> {
  $and?: StrictFilter<T>[];
  $or?: StrictFilter<T>[];
  $nor?: StrictFilter<T>[];
}

export type StrictFilter<T> = {
  [K in keyof T]?: FilterValue<T[K]>;
} & LogicalFilter<T>;

// ─── Update Operators ────────────────────────────────────────────────────

export interface UpdateOperators<T> {
  $set?: Partial<T>;
  $inc?: { [K in keyof T]?: number };
  $unset?: { [K in keyof T]?: true };
  $push?: { [K in keyof T]?: T[K] extends Array<infer U> ? U : never };
  $pull?: { [K in keyof T]?: T[K] extends Array<infer U> ? U | StrictFilter<U> : never };
}

// ─── Sort, Projection, Pagination ────────────────────────────────────────

export type SortDirection = 1 | -1 | 'asc' | 'desc';
export type SortSpec<T> = { [K in keyof T]?: SortDirection };
export type Projection<T> = { [K in keyof T]?: 1 | 0 };

export interface QueryOptions<T> {
  sort?: SortSpec<T>;
  limit?: number;
  skip?: number;
  projection?: Projection<T>;
}

// ─── Lookup (Joins) ─────────────────────────────────────────────────────

export interface LookupOptions<T> {
  match: StrictFilter<T>;
  lookup: {
    from: string;
    localField: string;
    foreignField: string;
    as: string;
  };
  unwind?: string;
  sort?: SortSpec<T>;
  limit?: number;
}

// ─── Index Definition ────────────────────────────────────────────────────

export interface IndexDefinition {
  collection: string;
  fields: Record<string, 1 | -1>;
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
}

// ─── Operation Receipt ───────────────────────────────────────────────────

export interface OperationReceipt {
  operation: 'insertOne' | 'insertMany' | 'updateOne' | 'updateMany' | 'deleteOne' | 'deleteMany' | 'batch';
  collection: string;
  success: boolean;
  matchedCount: number;
  modifiedCount: number;
  insertedCount: number;
  deletedCount: number;
  duration: number;              // ms
  backend: 'mongo' | 'sql' | 'elastic';
}

// ─── Validation Result ───────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    expected: string;
    received: string;
  }>;
}

// ─── Collection Description ──────────────────────────────────────────────

export interface CollectionDescription {
  name: string;
  backend: 'mongo' | 'sql' | 'elastic';
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    enum?: string[];
  }>;
  indexes: IndexDefinition[];
  documentCount: number;
  exampleFilter: Record<string, unknown>;
}

// ─── Connection Config ───────────────────────────────────────────────────

export type PoolPreset = 'high' | 'standard' | 'low';

export interface ReconnectConfig {
  enabled?: boolean;              // default: true
  maxAttempts?: number;           // default: 10
  initialDelayMs?: number;        // default: 1000
  maxDelayMs?: number;            // default: 30000
  backoffMultiplier?: number;     // default: 2
}

export interface StrictDBConfig {
  uri: string;
  pool?: PoolPreset;
  dbName?: string;
  label?: string;
  schema?: boolean;               // enable Zod validation (default: false)
  sanitize?: boolean;             // input sanitization (default: true)
  reconnect?: ReconnectConfig | boolean;
  slowQueryMs?: number;           // emit slow-query events above threshold (default: 1000)
  guardrails?: boolean;           // dangerous operation protection (default: true)
  logging?: boolean | 'verbose';  // structured operation logging (default: true)
  elastic?: {
    apiKey?: string;
    caFingerprint?: string;
    sniffOnStart?: boolean;
  };
}

// ─── Schema Types ────────────────────────────────────────────────────────

export interface CollectionSchema<T> {
  name: string;
  schema: z.ZodType<T>;
  indexes?: IndexDefinition[];
}

// ─── Event Types ─────────────────────────────────────────────────────────

export interface StrictDBEvents {
  connected: { backend: string; dbName: string; label: string };
  disconnected: { backend: string; reason: string; timestamp: Date };
  reconnecting: { backend: string; attempt: number; maxAttempts: number; delayMs: number };
  reconnected: { backend: string; attempt: number; downtimeMs: number };
  error: StrictDBError;
  operation: { collection: string; operation: string; durationMs: number; receipt: OperationReceipt };
  'slow-query': { collection: string; operation: string; durationMs: number; threshold: number };
  'pool-status': { active: number; idle: number; waiting: number; max: number };
  'guardrail-blocked': { collection: string; operation: string; reason: string };
  shutdown: { exitCode: number };
}

// ─── Connection Status ───────────────────────────────────────────────────

export interface ConnectionStatus {
  state: 'connected' | 'disconnected' | 'reconnecting' | 'closed';
  backend: 'mongo' | 'sql' | 'elastic';
  driver: 'mongodb' | 'pg' | 'mysql2' | 'mssql' | 'sqlite' | 'elasticsearch';
  uri: string;                    // redacted (password hidden)
  dbName: string;
  uptimeMs: number;
  pool: { active: number; idle: number; waiting: number; max: number };
  reconnect: { enabled: boolean; attempts: number; lastDisconnect?: Date };
}
```

---

## Unified Public API — `src/strictdb.ts`

```typescript
class StrictDB extends EventEmitter {
  // ─── Initialize ────────────────────────────────────────────────────────
  static async create(config: StrictDBConfig): Promise<StrictDB>;

  // ─── Read Operations ───────────────────────────────────────────────────
  // MongoDB: aggregation pipeline under the hood
  // SQL: parameterized SELECT with translated WHERE
  // ES: search with translated Query DSL
  async queryOne<T>(collection: string, filter: StrictFilter<T>, options?: QueryOptions<T>): Promise<T | null>;
  async queryMany<T>(collection: string, filter: StrictFilter<T>, options?: QueryOptions<T>): Promise<T[]>;
  async queryWithLookup<T>(collection: string, options: LookupOptions<T>): Promise<T | null>;
  async count<T>(collection: string, filter?: StrictFilter<T>): Promise<number>;

  // ─── Write Operations ──────────────────────────────────────────────────
  // All writes return OperationReceipt — never void
  // MongoDB: bulkWrite under the hood
  // SQL: parameterized INSERT/UPDATE/DELETE
  // ES: bulk API / updateByQuery / deleteByQuery
  async insertOne<T>(collection: string, doc: T): Promise<OperationReceipt>;
  async insertMany<T>(collection: string, docs: T[]): Promise<OperationReceipt>;
  async updateOne<T>(collection: string, filter: StrictFilter<T>, update: UpdateOperators<T>, upsert?: boolean): Promise<OperationReceipt>;
  async updateMany<T>(collection: string, filter: StrictFilter<T>, update: UpdateOperators<T>): Promise<OperationReceipt>;
  async deleteOne<T>(collection: string, filter: StrictFilter<T>): Promise<OperationReceipt>;
  async deleteMany<T>(collection: string, filter: StrictFilter<T>): Promise<OperationReceipt>;

  // ─── Batch Operations ──────────────────────────────────────────────────
  // Queue multiple operations, execute optimally
  // MongoDB: single bulkWrite call
  // SQL: single transaction with batched statements
  // ES: single bulk API call
  async batch(operations: BatchOperation[]): Promise<OperationReceipt>;

  // ─── Transactions ──────────────────────────────────────────────────────
  async withTransaction<T>(fn: (db: StrictDB) => Promise<T>): Promise<T>;

  // ─── Schema & Indexes ──────────────────────────────────────────────────
  registerCollection<T>(definition: CollectionSchema<T>): void;
  registerIndex(definition: IndexDefinition): void;
  async ensureCollections(options?: { dryRun?: boolean }): Promise<void>;
  async ensureIndexes(options?: { dryRun?: boolean }): Promise<void>;

  // ─── AI-First: Discovery & Validation ──────────────────────────────────
  // AI calls these before writing queries — no hallucinating, no guessing
  async describe(collection: string): Promise<CollectionDescription>;
  async validate(collection: string, operation: object): Promise<ValidationResult>;
  async explain(collection: string, operation: object): Promise<{ native: string | object; backend: string }>;

  // ─── Status & Health ───────────────────────────────────────────────────
  status(): ConnectionStatus;

  // ─── Events (typed) ────────────────────────────────────────────────────
  on<E extends keyof StrictDBEvents>(event: E, listener: (payload: StrictDBEvents[E]) => void): this;
  emit<E extends keyof StrictDBEvents>(event: E, payload: StrictDBEvents[E]): boolean;

  // ─── Lifecycle ─────────────────────────────────────────────────────────
  async close(): Promise<void>;
  async gracefulShutdown(exitCode?: number): Promise<void>;

  // ─── Escape hatch ──────────────────────────────────────────────────────
  raw(): unknown;
}
```

---

## AI.md — Context Window Reference

Ships inside npm package. Token-efficient, compressed reference optimized for AI context windows. Not documentation for humans — a compact spec the AI reads once and knows everything.

Contains:
- Every method signature with parameter types
- Every filter operator with one-line example
- Every update operator with one-line example
- Every error code with fix instruction
- Every event name with payload type
- Banned patterns (what NOT to do)
- Quick reference for common operations

Auto-generated from TypeScript types on every release to ensure it always matches the actual API.

---

## CLAUDE.md — AI Enforcement Hook

Ships inside npm package. When Claude Code (or any AI) loads a project with StrictDB installed, it reads this file and enforces these rules:

```markdown
# Database Rules — MANDATORY

All database operations MUST use StrictDB.
Never import or use database drivers directly.

## Banned imports:
- mongodb, mongoose
- pg, knex, sequelize, prisma, drizzle
- mysql2, mssql
- @elastic/elasticsearch

## Required:
import { StrictDB } from 'strictdb'

## Before writing any query:
Call db.describe('collectionName') to discover the schema.

## Before executing any write:
Call db.validate('collectionName', operation) to verify.

## Reference:
See node_modules/strictdb/AI.md for complete API.
```

---

## Error System — `src/errors.ts`

All database errors are caught, normalized into `StrictDBError` instances, and include **self-correcting fix instructions** so AI agents can recover without human intervention.

### Error Hierarchy

```typescript
class StrictDBError extends Error {
  code: StrictErrorCode;
  backend: 'mongo' | 'sql' | 'elastic';
  originalError: unknown;          // raw driver error (for debugging)
  collection?: string;
  operation?: string;
  retryable: boolean;
  timestamp: Date;
  fix: string;                     // AI-readable fix instruction
}
```

### Self-Correcting Error Messages

Every error includes a `fix` field with the exact corrective action. The `message` field combines what went wrong with how to fix it:

| Scenario | Message |
|---|---|
| AI uses native MongoDB syntax | `Unknown operator "$match" on queryMany. Use filter syntax: db.queryMany('users', { status: 'active' }). $match is a MongoDB aggregation concept — StrictDB handles this internally.` |
| AI uses .find() pattern | `Method "find" does not exist on StrictDB. Use db.queryMany(collection, filter) or db.queryOne(collection, filter).` |
| Wrong type in filter | `Filter field "age" expects number, received string "25". Use: { age: 25 } (without quotes).` |
| Enum violation | `Field "role" must be one of: admin, user, moderator. Received: "superadmin".` |
| Empty filter on delete | `deleteMany requires a non-empty filter. To delete all: db.deleteMany('users', { _id: { $exists: true } }, { confirm: 'DELETE_ALL' })` |
| Unknown collection | `Collection "usres" not found. Did you mean "users"? Registered collections: users, orders, products.` |

### Error Code Mapping (All Backends → Unified)

| Native Error | StrictDB Code | Retryable |
|---|---|---|
| MongoDB E11000 | `DUPLICATE_KEY` | No |
| PG 23505 (unique_violation) | `DUPLICATE_KEY` | No |
| MySQL ER_DUP_ENTRY | `DUPLICATE_KEY` | No |
| ES 409 (version conflict) | `DUPLICATE_KEY` | No |
| MongoDB topology closed | `CONNECTION_LOST` | Yes |
| PG ECONNREFUSED | `CONNECTION_FAILED` | Yes |
| ES ConnectionError | `CONNECTION_FAILED` | Yes |
| PG 57014 (query_canceled) | `TIMEOUT` | Yes |
| ES TimeoutError | `TIMEOUT` | Yes |
| MongoDB EAUTH | `AUTHENTICATION_FAILED` | No |
| ES 401/403 | `AUTHENTICATION_FAILED` | No |
| Any pool timeout | `POOL_EXHAUSTED` | Yes |
| Zod validation failure | `VALIDATION_ERROR` | No |
| ES 404 (index not found) | `COLLECTION_NOT_FOUND` | No |
| Guardrail blocked | `GUARDRAIL_BLOCKED` | No |

---

## Guardrails — `src/guardrails.ts`

Dangerous operation protection enabled by default (`guardrails: true` in config). Prevents AI agents (and humans) from accidentally destructive operations.

### Blocked Operations

| Operation | Why Blocked | Safe Alternative |
|---|---|---|
| `deleteMany({})` | Empty filter deletes all documents | `db.deleteMany('col', { _id: { $exists: true } }, { confirm: 'DELETE_ALL' })` |
| `updateMany({})` | Empty filter modifies all documents | `db.updateMany('col', { _id: { $exists: true } }, update, { confirm: 'UPDATE_ALL' })` |
| `queryMany` without `limit` | Unbounded result set — could return millions of rows | Always include `{ limit: N }` in options |
| `deleteOne({})` | Empty filter deletes arbitrary document | Must specify a filter |

### Behavior
- Blocked operations throw `StrictDBError` with code `GUARDRAIL_BLOCKED`
- Error message includes the safe alternative with exact syntax
- Emit `guardrail-blocked` event for monitoring
- Override with explicit `{ confirm: 'DELETE_ALL' }` or `{ confirm: 'UPDATE_ALL' }` option
- Can be disabled globally with `guardrails: false` in config (not recommended)

---

## Input Sanitization — `src/sanitize.ts`

Automatic input sanitization on every operation, backend-specific. The developer writes a filter and StrictDB cleans it before it reaches the database. Enabled by default (`sanitize: true` in config).

### MongoDB Sanitization (EXISTING — production-tested, ships as-is from `core/db/mongo.ts`)

The MongoDB wrapper already has a complete, battle-tested sanitizer that works WITH all native operators. This is the reference implementation that SQL and Elasticsearch sanitizers must match in quality.

**What it does:**
- **Whitelist of 35+ safe MongoDB operators** — comparison (`$eq`, `$gt`, `$gte`, `$lt`, `$lte`, `$ne`, `$in`, `$nin`), logical (`$and`, `$or`, `$nor`, `$not`), element (`$exists`, `$type`), array (`$all`, `$elemMatch`, `$size`), regex (`$regex`, `$options`), text search (`$text`, `$search`), geospatial (`$geoWithin`, `$near`, etc.), bitwise, and `$expr` — all pass through with their VALUES recursively sanitized
- **Strips dangerous operators** — `$where`, `$function`, `$accumulator` (arbitrary JS execution on server) are silently removed
- **Strips unknown `$` keys** — defense in depth; any `$` operator not in the whitelist is removed
- **Blocks path traversal** — keys containing `.` stripped (prevents `"field.nested"` injection)
- **Preserves trusted types** — `Date`, `RegExp`, `Buffer`, BSON types (`ObjectId`, etc.) pass through untouched
- **Recursive array/object sanitization** — deeply nested filters fully sanitized
- **Pipeline-aware** — `sanitizePipeline()` only sanitizes `$match` stages, leaving `$sort`, `$limit`, `$lookup` etc. as trusted application code
- **Trusted bypass** — `{ trusted: true }` option on `queryOne`/`queryMany`/`count` for server-constructed queries that use operators like `$gte` intentionally
- **Runtime toggle** — `configureSanitization(false)` or `DB_SANITIZE_INPUTS=false` for apps that sanitize at a higher layer (Zod/Joi)

**Key design principle:** The sanitizer distinguishes between user input (filters in `$match` — sanitized) and application logic (pipeline stages, update operators — trusted). This is why `insertOne`, `updateOne` etc. don't sanitize their `$set`/`$inc` values — those come from your code, not from users.

**StrictDB integration:** The mongo adapter wraps `core/db/mongo.ts` which already calls `sanitize()` and `sanitizePipeline()` internally. No additional sanitization layer needed for MongoDB — it's already built into every read and delete operation.

### SQL Sanitization (NEW — must be built to match MongoDB's quality)

The SQL wrapper uses parameterized queries (`$1`, `$2` placeholders), which prevents value injection. But parameterization alone has gaps that the filter translator must close:

- **Column/table name whitelist** — Column and table names can't be parameterized (`$1` only works for values). Every column name in a filter, sort, or projection is validated against the registered Zod schema or a runtime introspection cache from `information_schema`. Unknown column names throw `StrictDBError` with code `QUERY_ERROR` and a fix suggesting valid columns.
- **Sort field validation** — `ORDER BY` fields validated against schema. Prevents `ORDER BY (SELECT password FROM admin)` style injection through sort options.
- **LIKE pattern escaping** — If `$regex` translates to `LIKE` on MySQL/SQLite, user-supplied `%` and `_` wildcards are escaped unless explicitly allowed.
- **Identifier quoting** — All table and column names double-quoted (`"users"."email"`) to prevent reserved word collisions and injection via unquoted identifiers. (Already done in existing `sql.ts` — `buildWhere` quotes column names.)
- **JSON/JSONB payload sanitization** — Values destined for JSONB columns are parsed and re-serialized to strip any executable content. Prevents stored payloads that could be dangerous when parsed later.
- **String length limits** — Configurable max string length per field (from Zod `.max()`) enforced before hitting the database. Prevents oversized payloads.

**What the existing `sql.ts` already does right:**
- All queries parameterized — values never interpolated into SQL strings
- `buildWhere()` quotes all column names with double quotes
- Column names come from `Object.keys()` of application-provided objects, not user input
- Driver-specific placeholder adaptation (`$1` → `?` for SQLite, `$1` → `@p1` for MSSQL)

**What StrictDB adds on top:** The filter translator is the new attack surface — it converts MongoDB-style filters to SQL. The translator must validate that every field name in a `StrictFilter` exists in the registered schema before including it in a SQL query. This is the SQL equivalent of the MongoDB whitelist approach.

### Elasticsearch Sanitization (NEW — ES has unique injection vectors)

ES has injection vectors that neither MongoDB nor SQL sanitization covers:

- **Painless script parameter isolation** — Update operators (`$set`, `$inc`, `$unset`) translate to Painless scripts. All values MUST be passed via the `params` object, never interpolated into the script string. The script template is hardcoded; user input only flows through `params.fieldName`.
  ```
  // SAFE: value in params, never in script
  { script: { source: "ctx._source.name = params.name", params: { name: userInput } } }

  // NEVER: value in script string
  { script: { source: `ctx._source.name = '${userInput}'` } }
  ```
- **Field name validation** — Field names validated against registered Zod schema or index mapping from `GET /{index}/_mapping`. Prevents `_source`, `_id`, `_score` and other ES internal field manipulation.
- **Query string disabled by default** — `query_string` and `simple_query_string` queries allow Lucene syntax injection. StrictDB never generates these query types. All filters translate to structured `bool`/`term`/`range` queries only.
- **Script fields blocked** — `script_fields`, `stored_fields`, and runtime field definitions from user input are rejected.
- **Index name validation** — Collection names validated against a whitelist. Prevents cross-index access via `*` wildcards or comma-separated index patterns.
- **Regex complexity limits** — `$regex` patterns validated for catastrophic backtracking patterns (nested quantifiers, exponential groups) before translating to ES `regexp` queries.

### Sanitization Pipeline

```
User input arrives
  → Backend-specific sanitizer runs (mongo/sql/elastic)
  → Clean input passed to filter translator
  → Translated query uses only sanitized values
  → Adapter executes safe query
```

For MongoDB, sanitization is already inside `core/db/mongo.ts` — it runs automatically on every `queryOne`, `queryMany`, `queryWithLookup`, `count`, `deleteOne`, and `deleteMany` call. The StrictDB mongo adapter inherits this for free.

For SQL and Elasticsearch, the sanitization runs inside the filter translator before building the native query. The translator validates field names against the schema whitelist and parameterizes all values.

Sanitization runs BEFORE guardrails and validation. It's the first line of defense — it cleans the data, then guardrails check the operation shape, then validation checks the types.

### Configuration

```typescript
const db = await StrictDB.create({
  uri: '...',
  sanitize: true,              // default: true — enable sanitization
  // sanitize: false            // disable (NOT recommended — only for trusted internal services)
})

// Runtime toggle (mirrors existing MongoDB wrapper API)
db.configureSanitization(false);
```

---

## Operation Receipts — `src/receipts.ts`

Every write operation returns a structured `OperationReceipt`. Never void. Never driver-specific objects. AI gets unambiguous confirmation of what happened.

```typescript
const receipt = await db.insertOne('users', { email: 'tim@example.com', role: 'admin' });
// {
//   operation: 'insertOne',
//   collection: 'users',
//   success: true,
//   matchedCount: 0,
//   modifiedCount: 0,
//   insertedCount: 1,
//   deletedCount: 0,
//   duration: 12,
//   backend: 'mongo'
// }

const receipt = await db.updateMany('users', { role: 'user' }, { $set: { verified: true } });
// {
//   operation: 'updateMany',
//   collection: 'users',
//   success: true,
//   matchedCount: 847,
//   modifiedCount: 312,
//   insertedCount: 0,
//   deletedCount: 0,
//   duration: 89,
//   backend: 'sql'
// }
```

Receipts are consistent across all backends. The AI never has to interpret MongoDB's `ModifyResult` or pg's `rowCount` or Elasticsearch's `updated` field — it reads the same receipt every time.

---

## Schema Discovery — `src/describe.ts`

```typescript
const desc = await db.describe('users');
// {
//   name: 'users',
//   backend: 'mongo',
//   fields: [
//     { name: 'email', type: 'string', required: true },
//     { name: 'role', type: 'enum', required: true, enum: ['admin', 'user', 'mod'] },
//     { name: 'age', type: 'number', required: false },
//     { name: 'createdAt', type: 'date', required: true }
//   ],
//   indexes: [{ collection: 'users', fields: { email: 1 }, unique: true }],
//   documentCount: 12847,
//   exampleFilter: { role: 'admin', age: { $gte: 18 } }
// }
```

### Data Sources
- **With Zod schemas registered:** Returns exact schema definition — field names, types, enums, required/optional
- **Without Zod schemas:**
  - MongoDB: `$sample` + type detection across documents
  - SQL: `information_schema.columns` query
  - Elasticsearch: `GET /{index}/_mapping`

AI calls `describe` before writing any query. No hallucinating column names. No guessing field types. The `exampleFilter` gives the AI a working starting point.

---

## Dry Run Validation — `src/validate.ts`

```typescript
const result = await db.validate('users', {
  filter: { email: { $gt: 5 } },           // string field with numeric operator
  update: { $set: { role: 'superadmin' } }  // not in enum
});
// {
//   valid: false,
//   errors: [
//     { field: 'email', message: 'string field does not support $gt', expected: 'string operators ($eq, $ne, $in, $regex)', received: '$gt with number' },
//     { field: 'role', message: 'value not in enum', expected: 'admin | user | mod', received: 'superadmin' }
//   ]
// }
```

AI workflow: generate query → validate → fix errors → execute. Zero bad queries reach the database. Requires Zod schemas for full validation; without schemas, validates operator usage and basic type inference.

---

## Query Explanation — `src/explain.ts`

```typescript
const plan = await db.explain('users', {
  filter: { role: 'admin', age: { $gte: 18 } },
  sort: { createdAt: -1 },
  limit: 50
});

// MongoDB backend:
// {
//   backend: 'mongo',
//   native: [
//     { $match: { role: 'admin', age: { $gte: 18 } } },
//     { $sort: { createdAt: -1 } },
//     { $limit: 50 }
//   ]
// }

// SQL backend:
// {
//   backend: 'sql',
//   native: 'SELECT * FROM "users" WHERE "role" = $1 AND "age" >= $2 ORDER BY "createdAt" DESC LIMIT 50'
// }

// Elasticsearch backend:
// {
//   backend: 'elastic',
//   native: { bool: { must: [{ term: { role: 'admin' } }, { range: { age: { gte: 18 } } }] } }
// }
```

AI uses to verify intent matches execution. Developers use for debugging. Also a teaching tool — shows exactly what the abstraction is doing.

---

## Batch Operations — `src/batch.ts`

```typescript
const receipt = await db.batch([
  { operation: 'insertOne', collection: 'orders', doc: { ... } },
  { operation: 'insertOne', collection: 'orders', doc: { ... } },
  { operation: 'updateOne', collection: 'inventory', filter: { sku: 'A1' }, update: { $inc: { stock: -1 } } },
  { operation: 'deleteOne', collection: 'cart', filter: { userId: '123' } },
]);
```

AI generates 15 inserts + 3 updates + 2 deletes → StrictDB batches into minimum round trips:
- **MongoDB:** Single `bulkWrite` call
- **SQL:** Single transaction with batched statements
- **Elasticsearch:** Single `_bulk` API call

The AI doesn't optimize — StrictDB does it automatically.

---

## Event System — `src/events.ts`

StrictDB extends `EventEmitter` and emits normalized events for all lifecycle, operation, and error scenarios.

### Events

| Event | When | Payload |
|---|---|---|
| `connected` | Initial connection succeeds | `{ backend, dbName, label }` |
| `disconnected` | Connection lost | `{ backend, reason, timestamp }` |
| `reconnecting` | Reconnect attempt starts | `{ backend, attempt, maxAttempts, delayMs }` |
| `reconnected` | Reconnect succeeds | `{ backend, attempt, downtimeMs }` |
| `error` | Any normalized error | `StrictDBError` (includes fix instruction) |
| `operation` | Any operation completes | `{ collection, operation, durationMs, receipt }` |
| `slow-query` | Query exceeds threshold | `{ collection, operation, durationMs, threshold }` |
| `pool-status` | Pool health change | `{ active, idle, waiting, max }` |
| `guardrail-blocked` | Dangerous operation prevented | `{ collection, operation, reason }` |
| `shutdown` | Graceful shutdown initiated | `{ exitCode }` |

### Usage

```typescript
const db = await StrictDB.create({ uri: '...', slowQueryMs: 500 });

db.on('error', (err) => logger.error(err.code, err.message, err.fix));
db.on('reconnecting', (info) => console.warn(`Reconnect attempt ${info.attempt}/${info.maxAttempts}`));
db.on('slow-query', (info) => alerting.trigger('slow-db', info));
db.on('guardrail-blocked', (info) => console.warn(`Blocked: ${info.reason}`));
db.on('operation', (info) => auditLog.write(info));  // AI audit trail
```

### Structured Logging — `src/logger.ts`

Every operation emits a structured log entry via the `operation` event:
- Timestamp, operation type, collection, filter used, duration, receipt, backend
- When `logging: 'verbose'`: includes the translated native query
- Provides complete AI audit trail — exactly what the AI did, in what order, what happened
- Integration point for RuleCatch monitoring

---

## Auto-Reconnect — `src/reconnect.ts`

### Strategy

```typescript
interface ReconnectConfig {
  enabled: boolean;             // default: true
  maxAttempts: number;          // default: 10
  initialDelayMs: number;       // default: 1000 (1s)
  maxDelayMs: number;           // default: 30000 (30s)
  backoffMultiplier: number;    // default: 2
}
```

### Flow

1. Connection loss detected
2. Emit `disconnected` event
3. Reconnect loop with exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (capped)
4. Each attempt emits `reconnecting` event
5. On success: emit `reconnected`, resume operations
6. On max attempts exceeded: emit `error` with `CONNECTION_LOST`, stop trying

### Backend-Specific

- **MongoDB:** Monitor topology events (`serverHeartbeatFailed`), layer event notification on top of driver's internal reconnect
- **SQL:** Pool `error` event → create new pool → health check (`SELECT 1`) → swap reference → close old pool
- **Elasticsearch:** Built-in retry + sniffing for multi-node clusters, layer event emission on top

---

## Connection Status — `db.status()`

```typescript
const status = db.status();
// {
//   state: 'connected',
//   backend: 'mongo',
//   driver: 'mongodb',
//   uri: 'mongodb+srv://***:***@cluster.mongodb.net/mydb',
//   dbName: 'mydb',
//   uptimeMs: 3600000,
//   pool: { active: 3, idle: 7, waiting: 0, max: 10 },
//   reconnect: { enabled: true, attempts: 0, lastDisconnect: null }
// }
```

AI agents check this before starting batch operations. Reports unhealthy database to developer instead of failing through a chain of timeout errors.

---

## Strict Connection Pool Enforcement

### Pool Manager

```typescript
interface StrictPoolConfig {
  max: number;              // hard ceiling — never exceeded
  min: number;              // maintained idle connections
  acquireTimeoutMs: number; // max wait for a connection (default: 5000)
  idleTimeoutMs: number;    // reclaim idle connections after (default: 30000)
  healthCheckMs: number;    // periodic health check interval (default: 15000)
}
```

### What "Strict" Means

- **Hard max** — When all connections in use, new requests wait up to `acquireTimeoutMs`. Then throws `POOL_EXHAUSTED` instead of hanging forever
- **Min connections maintained** — Pool pre-warms on startup, replenishes if they drop
- **Health checks** — Periodic `SELECT 1` / `ping` validates connections. Dead connections evicted and replaced
- **No silent leaks** — Every acquired connection has a release timeout
- **No unbounded queues** — Waiting requests bounded and time out
- **Pool overflow impossible** — Requests wait or fail, never create extra connections
- **Leaked connections detected** — Forcefully reclaimed after configurable timeout

---

## Filter Translation — `src/filter-translator.ts`

Two output modes:
- `translateFilter(filter, 'sql')` → `{ clause: string, values: unknown[] }` (parameterized SQL)
- `translateFilter(filter, 'elastic')` → Elasticsearch Query DSL object

MongoDB adapter needs no translation — the filter syntax IS MongoDB's native syntax.

### SQL Translation

| MongoDB Filter | SQL Output | Params |
|---|---|---|
| `{age: 25}` | `"age" = $1` | `[25]` |
| `{age: {$gt: 18}}` | `"age" > $1` | `[18]` |
| `{age: {$gte: 18}}` | `"age" >= $1` | `[18]` |
| `{age: {$lt: 65}}` | `"age" < $1` | `[65]` |
| `{age: {$lte: 65}}` | `"age" <= $1` | `[65]` |
| `{age: {$ne: 0}}` | `"age" != $1` | `[0]` |
| `{role: {$in: ['a','b']}}` | `"role" IN ($1, $2)` | `['a','b']` |
| `{role: {$nin: ['a','b']}}` | `"role" NOT IN ($1, $2)` | `['a','b']` |
| `{email: {$exists: true}}` | `"email" IS NOT NULL` | `[]` |
| `{email: {$exists: false}}` | `"email" IS NULL` | `[]` |
| `{name: {$regex: '^Tim'}}` | `"name" ~ $1` (PG) / `REGEXP` (MySQL) | `['^Tim']` |
| `{$and: [f1, f2]}` | `(clause1) AND (clause2)` | merged |
| `{$or: [f1, f2]}` | `(clause1) OR (clause2)` | merged |
| `{$nor: [f1, f2]}` | `NOT ((clause1) OR (clause2))` | merged |
| `{age: {$not: {$gt: 18}}}` | `NOT ("age" > $1)` | `[18]` |

### Elasticsearch Translation

| StrictDB Filter | Elasticsearch Query DSL |
|---|---|
| `{field: value}` | `{ term: { field: value } }` |
| `{field: {$gt: 10}}` | `{ range: { field: { gt: 10 } } }` |
| `{field: {$gte: 10}}` | `{ range: { field: { gte: 10 } } }` |
| `{field: {$lt: 10}}` | `{ range: { field: { lt: 10 } } }` |
| `{field: {$lte: 10}}` | `{ range: { field: { lte: 10 } } }` |
| `{field: {$ne: value}}` | `{ bool: { must_not: { term: { field: value } } } }` |
| `{field: {$in: [a,b]}}` | `{ terms: { field: [a, b] } }` |
| `{field: {$nin: [a,b]}}` | `{ bool: { must_not: { terms: { field: [a, b] } } } }` |
| `{field: {$exists: true}}` | `{ exists: { field: 'field' } }` |
| `{field: {$exists: false}}` | `{ bool: { must_not: { exists: { field: 'field' } } } }` |
| `{field: {$regex: '^Tim'}}` | `{ regexp: { field: '^Tim' } }` |
| `{$and: [f1, f2]}` | `{ bool: { must: [q1, q2] } }` |
| `{$or: [f1, f2]}` | `{ bool: { should: [q1, q2], minimum_should_match: 1 } }` |
| `{$nor: [f1, f2]}` | `{ bool: { must_not: [q1, q2] } }` |

### Update Translation (SQL)

```
{$set: {name: 'Bob'}, $inc: {count: 1}} → SET "name" = $1, "count" = "count" + $2
{$unset: {temp: true}}                  → SET "temp" = NULL
```

### Update Translation (Elasticsearch → Painless Script)

```
$set: {name: 'Bob'}     → ctx._source.name = params.name
$inc: {count: 1}        → ctx._source.count += params.count
$unset: {temp: true}    → ctx._source.remove('temp')
```

---

## Adapter Pattern

### `src/adapters/mongo-adapter.ts`
- `StrictFilter` maps natively — no translation
- `UpdateOperators` maps natively — no translation
- `queryMany` → aggregation pipeline under the hood
- `insertMany` → bulkWrite under the hood
- Reconnect: monitor MongoDB topology events, emit StrictDB events
- Errors: catch native errors, wrap in `StrictDBError` with fix instruction

### `src/adapters/sql-adapter.ts`
- Uses `filter-translator.ts` for filter → SQL WHERE
- Uses `translateUpdate` for update operators → SQL SET
- `queryWithLookup` → SQL `LEFT JOIN`
- `ensureCollections` → `CREATE TABLE IF NOT EXISTS` from Zod schemas
- Reconnect: pool `error` → new pool → health check → swap
- Errors: map native error codes to `StrictErrorCode` with fix instruction

### `src/adapters/elastic-adapter.ts`
- Uses `filter-translator.ts` for filter → ES Query DSL
- `insertOne` → `client.index()`
- `insertMany` → `client.bulk()`
- `updateOne` → `client.updateByQuery()` with `max_docs: 1` + Painless script
- `updateMany` → `client.updateByQuery()` + Painless script
- `deleteOne` → `client.deleteByQuery()` with `max_docs: 1`
- `deleteMany` → `client.deleteByQuery()`
- `queryOne` → `client.search({ size: 1 })`
- `queryMany` → `client.search({ size, sort, from })`
- `count` → `client.count()`
- `queryWithLookup` → Two queries (no server-side joins in ES), emit warning
- `ensureCollections` → `client.indices.create()` with generated mappings from Zod
- Reconnect: built-in retry + sniffing, layer event emission
- Errors: map ES status codes to `StrictErrorCode` with fix instruction

---

## Zod Schema Integration — `src/schema.ts`

### SQL DDL Generation (Zod → CREATE TABLE)

| Zod Type | PostgreSQL | MySQL | SQLite | MSSQL |
|---|---|---|---|---|
| `z.string()` | `TEXT` | `TEXT` | `TEXT` | `NVARCHAR(MAX)` |
| `z.string().max(255)` | `VARCHAR(255)` | `VARCHAR(255)` | `TEXT` | `NVARCHAR(255)` |
| `z.number().int()` | `INTEGER` | `INT` | `INTEGER` | `INT` |
| `z.number()` | `DOUBLE PRECISION` | `DOUBLE` | `REAL` | `FLOAT` |
| `z.boolean()` | `BOOLEAN` | `TINYINT(1)` | `INTEGER` | `BIT` |
| `z.date()` | `TIMESTAMPTZ` | `DATETIME` | `TEXT` | `DATETIME2` |
| `z.enum([...])` | `TEXT CHECK(...)` | `ENUM(...)` | `TEXT CHECK(...)` | `NVARCHAR CHECK(...)` |
| `z.array(...)` | `JSONB` | `JSON` | `TEXT` | `NVARCHAR(MAX)` |
| `z.object(...)` nested | `JSONB` | `JSON` | `TEXT` | `NVARCHAR(MAX)` |
| `.optional()` | `NULL` | `NULL` | `NULL` | `NULL` |
| required (default) | `NOT NULL` | `NOT NULL` | `NOT NULL` | `NOT NULL` |

### Elasticsearch Mapping Generation (Zod → ES Mappings)

| Zod Type | ES Mapping Type |
|---|---|
| `z.string()` | `text` + `keyword` sub-field |
| `z.string().max(255)` | `keyword` |
| `z.number().int()` | `integer` |
| `z.number()` | `double` |
| `z.boolean()` | `boolean` |
| `z.date()` | `date` |
| `z.enum([...])` | `keyword` |
| `z.array(...)` | nested / auto |
| `z.object(...)` nested | `object` with nested properties |

### Behavior by Backend

- **SQL:** `ensureCollections()` → `CREATE TABLE IF NOT EXISTS` + index creation
- **MongoDB:** `ensureCollections()` → create collections + `ensureIndexes()`
- **Elasticsearch:** `ensureCollections()` → create indices with generated mappings + settings
- **All backends:** Zod `.parse()` runs on every write when `schema: true`

---

## Connection Auto-Detection

```typescript
function detectBackend(uri: string): 'mongo' | 'sql' | 'elastic' {
  if (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) return 'mongo';
  if (uri.startsWith('postgresql://') || uri.startsWith('postgres://')) return 'sql';
  if (uri.startsWith('mysql://')) return 'sql';
  if (uri.startsWith('mssql://')) return 'sql';
  if (uri.startsWith('file:') || uri.startsWith('sqlite:')) return 'sql';
  if (uri.startsWith('http://') || uri.startsWith('https://')) return 'elastic';
  throw new StrictDBError({ code: 'CONNECTION_FAILED', message: `Unsupported URI scheme`, fix: 'Use mongodb://, postgresql://, mysql://, mssql://, sqlite:, or https:// for Elasticsearch' });
}
```

`StrictDB.create()` detects the backend from the URI. The developer never specifies which database.

---

## MCP Server — `strictdb-mcp`

Separate package. The primary interface for AI agents. AI doesn't write database code — it calls tools. StrictDB holds the connection, the AI holds nothing. Database-agnostic: the AI never knows what backend it's talking to.

### MCP Tools

| Tool | Maps To | Description |
|---|---|---|
| `strictdb_query_one` | `db.queryOne()` | Find single document by filter |
| `strictdb_query_many` | `db.queryMany()` | Find multiple documents by filter |
| `strictdb_count` | `db.count()` | Count documents matching filter |
| `strictdb_insert_one` | `db.insertOne()` | Insert single document |
| `strictdb_insert_many` | `db.insertMany()` | Insert multiple documents |
| `strictdb_update_one` | `db.updateOne()` | Update single document |
| `strictdb_update_many` | `db.updateMany()` | Update multiple documents |
| `strictdb_delete_one` | `db.deleteOne()` | Delete single document |
| `strictdb_delete_many` | `db.deleteMany()` | Delete multiple documents |
| `strictdb_batch` | `db.batch()` | Execute batched operations |
| `strictdb_describe` | `db.describe()` | Discover collection schema |
| `strictdb_validate` | `db.validate()` | Dry run validation |
| `strictdb_explain` | `db.explain()` | Show native query plan |
| `strictdb_status` | `db.status()` | Connection health check |

### Tool Schemas

Every tool includes Zod-generated input schemas with field descriptions, examples, and constraints. When an AI connects to the StrictDB MCP server, it gets self-documenting tools — no external documentation needed.

### Key Principle

MongoDB has its own MCP server. PostgreSQL has its own MCP server. They all speak their native language. StrictDB's MCP server speaks **StrictDB**. The AI learns one interface. The database behind it is a deployment decision, not a development decision. If the company migrates from MongoDB to PostgreSQL, every AI agent keeps working. The URI changes in one config file. Nothing else.

---

## RuleCatch Integration

### Rule Definition — `rules/rulecatch.json`

Ships as optional rule pack. RuleCatch monitors AI-generated code in real time and flags:

- Direct database driver imports (`mongodb`, `pg`, `mongoose`, `sequelize`, `prisma`, `drizzle`, `mysql2`, `mssql`, `@elastic/elasticsearch`)
- Raw SQL strings in code
- Native MongoDB driver patterns (`MongoClient`, `db.collection().find()`)
- Any ORM pattern (`mongoose.model()`, `prisma.client`)

**Closed loop:** CLAUDE.md tells the AI the rules → StrictDB enforces at runtime → RuleCatch verifies compliance in the code → structured logging creates the audit trail.

### Pre-Commit Hook — `hooks/pre-commit.sh`

- Scans staged files for banned direct driver imports
- Blocks commit with clear message pointing to StrictDB equivalent
- Optional install via `npx strictdb init-hooks`

---

## Developer Usage Example

```typescript
import { StrictDB } from 'strictdb';

// Works with MongoDB
const db = await StrictDB.create({ uri: 'mongodb+srv://...' });

// Works with PostgreSQL — EXACT same code
const db = await StrictDB.create({ uri: 'postgresql://...' });

// Works with Elasticsearch — EXACT same code
const db = await StrictDB.create({ uri: 'https://elastic:9200' });

// ─── AI discovers schema before writing queries ──────────────────────────
const schema = await db.describe('users');

// ─── Same queries on all backends ────────────────────────────────────────
const user = await db.queryOne('users', { email: 'tim@example.com' });

const admins = await db.queryMany('users', {
  role: 'admin',
  age: { $gte: 18 },
  status: { $in: ['active', 'pending'] }
}, { sort: { createdAt: -1 }, limit: 50 });

// ─── AI validates before executing ───────────────────────────────────────
const check = await db.validate('users', {
  filter: { role: 'superadmin' },
  update: { $set: { verified: true } }
});
// check.valid === false → field 'role' not in enum

// ─── Writes return receipts ──────────────────────────────────────────────
const receipt = await db.insertOne('users', { email: 'new@user.com', role: 'user' });
// receipt.success === true, receipt.insertedCount === 1

const receipt = await db.updateOne('users',
  { email: 'tim@example.com' },
  { $set: { role: 'admin' }, $inc: { loginCount: 1 } }
);

// ─── Batch operations auto-optimize ──────────────────────────────────────
const receipt = await db.batch([
  { operation: 'insertOne', collection: 'orders', doc: { ... } },
  { operation: 'updateOne', collection: 'inventory', filter: { sku: 'A1' }, update: { $inc: { stock: -1 } } },
]);

// ─── Guardrails protect against accidents ────────────────────────────────
await db.deleteMany('users', {});
// throws: StrictDBError: deleteMany requires a non-empty filter

// ─── See what's happening under the hood ─────────────────────────────────
const plan = await db.explain('users', { filter: { role: 'admin' }, limit: 50 });
```

---

## Implementation Order

### Phase 1: Foundation
1. Initialize project — `package.json`, `tsconfig.json`, `.gitignore`, `.env`
2. `src/types.ts` — All shared types, interfaces, event map, receipts, descriptions
3. `src/errors.ts` — `StrictDBError` class + error code mapping + self-correcting fix messages
4. `src/filter-translator.ts` — Filter → SQL + Filter → ES Query DSL (CRITICAL PATH)

### Phase 2: Infrastructure
5. `src/events.ts` — Typed event emitter
6. `src/reconnect.ts` — Reconnect manager with exponential backoff
7. `src/sanitize.ts` — Input sanitization for all three backends (CRITICAL — first line of defense)
8. `src/guardrails.ts` — Dangerous operation protection
9. `src/receipts.ts` — Structured operation receipts
10. `src/logger.ts` — Structured operation logging

### Phase 3: Adapters
11. `src/adapters/adapter.ts` — Abstract adapter interface
12. `src/adapters/mongo-adapter.ts` — MongoDB adapter + reconnect + errors + receipts + sanitize
13. `src/adapters/sql-adapter.ts` — SQL adapter + filter translation + reconnect + errors + receipts + sanitize
14. `src/adapters/elastic-adapter.ts` — ES adapter + Query DSL + bulk + reconnect + errors + receipts + sanitize

### Phase 4: Schema & DDL
15. `src/schema.ts` — Zod registry + SQL DDL generation + ES mapping generation + validation hooks

### Phase 5: Unified API
16. `src/strictdb.ts` — Main class tying everything together
17. `src/index.ts` — Public entry point

### Phase 6: AI-First Features
18. `src/describe.ts` — Schema discovery / introspection
19. `src/validate.ts` — Pre-execution dry run validation
20. `src/explain.ts` — Query explanation (native query output)
21. `src/batch.ts` — Automatic operation batching
22. `AI.md` — Token-optimized AI context window reference
23. `CLAUDE.md` — Claude Code enforcement rules

### Phase 7: MCP Server
24. `mcp/server.ts` — MCP server entry point
25. `mcp/tools.ts` — MCP tool definitions with Zod-generated schemas
26. `mcp/package.json` — Separate package config

### Phase 8: RuleCatch Integration
27. `rules/rulecatch.json` — RuleCatch rule definitions
28. `hooks/pre-commit.sh` — Git hook for import enforcement

### Phase 9: Testing
29. Filter translator unit tests — SQL + ES Query DSL (critical path)
30. Error normalization + self-correction tests
31. Sanitization tests — injection attempts for all three backends (critical)
32. Guardrail tests
33. Receipt tests
34. Schema + DDL + ES mapping tests
35. Describe / validate / explain tests
36. SQLite integration tests (no server needed)
37. MongoDB integration tests
38. Elasticsearch integration tests
39. Swap tests — same test suite, all three backends, identical results
40. MCP server tool tests

---

## Verification Plan

1. `npm run build` — TypeScript compiles cleanly, zero `any` types
2. Filter translator tests — Every operator → correct parameterized SQL AND correct ES Query DSL
3. Error tests — Native errors from all three backends normalize to same `StrictDBError` with fix messages
4. Guardrail tests — Empty filters blocked, unbounded queries blocked, overrides work
5. Sanitization tests — NoSQL injection blocked (MongoDB), SQL injection via column names blocked (SQL), Painless script injection blocked (ES), prototype pollution blocked (all)
6. Receipt tests — Every write operation returns consistent `OperationReceipt`
6. Schema tests — Zod schemas generate correct SQL DDL + ES mappings
7. SQLite integration — Full CRUD cycle through StrictDB with in-memory SQLite
8. MongoDB integration — Same CRUD cycle against real MongoDB
9. Elasticsearch integration — Same CRUD cycle against real ES
10. Swap test — One test suite, three backends, identical results
11. Event tests — `connected`, `error`, `disconnected`, `guardrail-blocked` events fire correctly
12. MCP tests — Every MCP tool maps correctly to StrictDB methods
13. Describe tests — Schema discovery works with and without Zod schemas
14. Validate tests — Dry run catches type mismatches, enum violations, unknown fields
15. AI.md audit — Verify every public method is documented in AI.md

---

## Key Files

| File | Phase | Purpose |
|---|---|---|
| `package.json` | 1 | Project config, dependencies |
| `tsconfig.json` | 1 | TypeScript config |
| `.gitignore` | 1 | Standard ignores |
| `.env` / `.env.example` | 1 | Connection strings |
| `src/types.ts` | 1 | All shared types + events + receipts + descriptions |
| `src/errors.ts` | 1 | StrictDBError + error mapping + self-correcting fixes |
| `src/filter-translator.ts` | 1 | Filter → SQL + ES engine (CRITICAL) |
| `src/events.ts` | 2 | Typed event emitter |
| `src/reconnect.ts` | 2 | Auto-reconnect with backoff |
| `src/guardrails.ts` | 2 | Dangerous operation protection |
| `src/sanitize.ts` | 2 | Input sanitization — all backends (CRITICAL) |
| `src/receipts.ts` | 2 | Structured operation receipts |
| `src/logger.ts` | 2 | Structured operation logging |
| `src/adapters/adapter.ts` | 3 | Abstract adapter interface |
| `src/adapters/mongo-adapter.ts` | 3 | MongoDB adapter |
| `src/adapters/sql-adapter.ts` | 3 | SQL adapter |
| `src/adapters/elastic-adapter.ts` | 3 | Elasticsearch adapter |
| `src/schema.ts` | 4 | Zod integration + DDL + ES mappings |
| `src/strictdb.ts` | 5 | Main unified class |
| `src/index.ts` | 5 | Public entry point |
| `src/describe.ts` | 6 | Schema discovery / introspection |
| `src/validate.ts` | 6 | Pre-execution dry run validation |
| `src/explain.ts` | 6 | Query explanation |
| `src/batch.ts` | 6 | Automatic operation batching |
| `AI.md` | 6 | AI context window reference |
| `CLAUDE.md` | 6 | Claude Code enforcement rules |
| `mcp/server.ts` | 7 | MCP server entry point |
| `mcp/tools.ts` | 7 | MCP tool definitions |
| `mcp/package.json` | 7 | Separate package: strictdb-mcp |
| `rules/rulecatch.json` | 8 | RuleCatch rule definitions |
| `hooks/pre-commit.sh` | 8 | Git hook for import enforcement |
| `src/core/db/mongo.ts` | — | Existing MongoDB wrapper (keep as-is) |
| `src/core/db/sql.ts` | — | Existing SQL wrapper (keep as-is) |
