# [PROJECT NAME] — Specification

## What You Are Building

[Write 2-4 paragraphs describing what this project does at a high level. Answer these questions:
- What problem does it solve?
- Who is it for?
- What makes it different from existing solutions?
- What is the core value proposition?]

**Example:**
> SwarmK is a unified networking layer for Docker Swarm. It provides network policies, advanced load balancing, traffic observability, DNS control, encryption, rate limiting, bandwidth control, and a full web dashboard, all built on native Linux primitives (nftables, conntrack, tc, WireGuard) and the Docker API.

---

## Tech Stack

[Define your technical choices explicitly. MDD will enforce these throughout the build.]

**Language & Framework:**
- Primary language: [TypeScript, Python, Go, etc.]
- Framework: [React, Express, FastAPI, etc.]
- Runtime: [Node.js, Python 3.11+, etc.]

**Data Layer:**
- Database: [MongoDB, PostgreSQL, SQLite, etc.]
- ORM/Driver: [Native driver, Prisma, SQLAlchemy, etc.]
- Caching: [Redis, in-memory, none]

**Frontend (if applicable):**
- UI Framework: [React, Vue, Svelte, none]
- Build Tool: [Vite, Webpack, esbuild]
- Styling: [Tailwind CSS, CSS Modules, styled-components]
- State Management: [Zustand, Redux, Context API, none]
- UI Components: [shadcn/ui, Material UI, custom]

**Testing:**
- Testing Framework: [Jest, Vitest, pytest, etc.]
- Coverage Target: [80%, all code, critical paths only]
- Integration Tests: [Required, optional, none]

**Deployment:**
- Container: [Docker, none]
- Orchestration: [Docker Compose, Kubernetes, none]
- Configuration: [ENV vars, config files, both]

**Code Organization:**
- Max file length: [300 lines, 500 lines, no limit]
- File structure: [feature-based, layer-based, describe your preference]
- Shared utilities: [/lib, /utils, /shared]

**Error Handling:**
- Logging: [Structured logger, console, both]
- User-facing errors: [Always safe messages, detailed in dev mode]
- Error tracking: [Sentry, custom, none]

---

## Build Priorities

[Tell MDD what needs to be built first and why. MDD is smart at ordering, but explicit priorities make the build more predictable.]

**What needs to be built first:**
- [Example: "Authentication and database connection working before anything else because the entire application depends on it"]
- [Example: "API layer fully functional before building the frontend so endpoints can be tested independently"]

**Critical path features:**
- [Example: "User registration must be complete before we build the dashboard because users need accounts to access it"]
- [Example: "Data models need to be stable before building the API because changes cascade"]

**What you want to achieve early:**
- [Example: "Core business logic working end-to-end in the first wave"]
- [Example: "Basic CRUD operations for all entities before adding advanced features"]

---

## Project Structure

[Define your folder structure. This helps MDD understand where files should go.]

```
project-name/
├── package.json / pyproject.toml / go.mod
├── README.md
├── .env.example
├── src/
│   ├── index.ts / main.py / main.go         # Entry point
│   ├── [organize by feature or layer]
│   ├── utils/                                # Shared utilities
│   └── types/                                # Shared types (if TypeScript)
├── tests/
│   └── [mirror src/ structure]
├── docs/
│   └── [additional documentation]
└── [deployment files - Dockerfile, docker-compose.yml, etc.]
```

---

## Core Features

[List the main features your application needs. Break them into logical groups. Be specific about what each feature does.]

### Feature Group 1: [Name]

**[Feature Name]**
- What it does: [Clear description]
- User story: [As a USER, I want to DO THING so that OUTCOME]
- Dependencies: [What needs to exist before this can be built]
- Edge cases: [What unusual situations need handling]

**[Feature Name]**
- What it does:
- User story:
- Dependencies:
- Edge cases:

### Feature Group 2: [Name]

[Continue the pattern]

### Feature Group 3: [Name]

[Continue the pattern]

---

## Data Models

[Define your data structures. Be explicit about field types, relationships, indexes, and constraints.]

### [Model Name]

```typescript
// or Python/Go equivalent
interface ModelName {
  id: string;
  fieldName: string;
  anotherField: number;
  createdAt: Date;
  updatedAt: Date;
}
```

**Relationships:**
- [Describe how this model relates to others - one-to-many, many-to-many, etc.]

**Indexes:**
- [List which fields need indexes and why]

**Validation Rules:**
- [Required fields, formats, constraints]

**Business Rules:**
- [Any logic that governs this data - "email must be unique", "status can only transition from draft → published", etc.]

---

## API Endpoints (if applicable)

[Define your API surface. Be clear about inputs, outputs, auth requirements, and edge cases.]

### Authentication

**POST /api/auth/login**
- Input: `{ email, password }`
- Output: `{ token, user }`
- Auth: None (public)
- Validation: Email format, password minimum length
- Errors: Invalid credentials, account locked, etc.

### [Resource Name]

**GET /api/[resource]**
- Purpose: [What this endpoint does]
- Input: [Query params, body, headers]
- Output: [Response shape]
- Auth: [Required roles/permissions]
- Validation: [Input validation rules]
- Errors: [Possible error cases]

[Continue for all endpoints]

---

## User Interface (if applicable)

[Describe your UI structure, pages, and key interactions.]

### Pages

**[Page Name]** (`/path`)
- Purpose: [What this page does]
- Components: [List major components]
- Data: [What data it displays/edits]
- Actions: [What users can do here]
- Validation: [Form validation rules if applicable]

### Components

**[Component Name]**
- Purpose: [What this component does]
- Props: [What it accepts]
- State: [What it manages]
- Events: [What it emits]

---

## Security & Authentication

[Define how authentication and authorization work in your system.]

**Authentication Method:**
- [JWT, sessions, OAuth, API keys, etc.]
- [Where tokens are stored - httpOnly cookies, localStorage, etc.]
- [Token expiration and refresh strategy]

**Authorization Rules:**
- [Who can access what]
- [Role definitions if applicable]
- [Permission model]

**Security Constraints:**
- [Rate limiting requirements]
- [Input sanitization rules]
- [CORS policy]
- [Any other security requirements]

---

## External Integrations (if applicable)

[List any external services, APIs, or systems your application needs to integrate with.]

**[Service Name]**
- Purpose: [Why you're integrating with it]
- API: [REST, GraphQL, SDK, etc.]
- Authentication: [How you authenticate]
- Data Flow: [What data moves where]
- Error Handling: [What happens when it fails]
- Fallback: [Graceful degradation strategy]

---

## Configuration

[Define what configuration your application needs and where it comes from.]

**Environment Variables:**
```bash
# Database
DATABASE_URL=
DATABASE_POOL_MIN=
DATABASE_POOL_MAX=

# Auth
JWT_SECRET=
JWT_EXPIRATION=

# External Services
API_KEY_SERVICE_NAME=

# Application
PORT=
NODE_ENV=
LOG_LEVEL=
```

**Config File (if applicable):**
```json
{
  "feature_flags": {},
  "limits": {},
  "defaults": {}
}
```

---

## Testing Strategy

[Define what gets tested and how.]

**Unit Tests:**
- All business logic functions
- All data transformations
- All utility functions
- Target: [80% coverage, 100% coverage, etc.]

**Integration Tests:**
- All API endpoints
- Database operations
- External service integrations

**End-to-End Tests (if applicable):**
- Critical user flows
- [List the flows]

**Test Data:**
- [How test data is managed - fixtures, factories, seeded database]

---

## Deployment

[Define how the application gets deployed and what the production environment looks like.]

**Deployment Method:**
- [SwarmK, Docker Compose, Dokploy, Kubernetes, Platform-as-a-Service, etc.]

**Environment Requirements:**
- [Minimum server specs]
- [Database requirements]
- [Network requirements]

**Deployment Files:**
- [List the files - Dockerfile, docker-compose.yml, k8s manifests, etc.]

**Health Checks:**
- [What endpoint(s) indicate the app is healthy]

**Monitoring:**
- [What gets logged]
- [What metrics are tracked]
- [Alerting strategy if applicable]

---

## Edge Cases & Error Handling

[Document the unusual situations your application needs to handle correctly.]

**Network Failures:**
- [How the app behaves when external services are down]
- [Retry logic]
- [Fallback behavior]

**Data Issues:**
- [What happens with malformed input]
- [How conflicts are resolved]
- [Data validation failures]

**Concurrency:**
- [Race conditions to prevent]
- [Locking strategy if needed]
- [Idempotency requirements]

**Scale:**
- [What happens under high load]
- [Rate limiting]
- [Queue-based processing if needed]

---

## Success Criteria

[Define what "done" means for this project.]

**Functional Requirements:**
- [ ] All core features implemented and tested
- [ ] All API endpoints working and documented
- [ ] All user flows tested end-to-end
- [ ] Error handling working for all edge cases

**Non-Functional Requirements:**
- [ ] Tests passing with [X%] coverage
- [ ] Application starts successfully via [deployment method]
- [ ] All configuration documented
- [ ] README with setup instructions complete

**Quality Requirements:**
- [ ] No console errors in production mode
- [ ] No TODO comments in production code
- [ ] All TypeScript errors resolved (if using TypeScript)
- [ ] All linter warnings addressed

---

## Timeline Estimate (optional)

[If you have timeline expectations, note them here. MDD will structure waves to match.]

**Phase 1:** [Feature group] - [estimated time]
**Phase 2:** [Feature group] - [estimated time]
**Phase 3:** [Feature group] - [estimated time]

---

## Notes & Constraints

[Any additional context MDD should know.]

**Things to avoid:**
- [Patterns or approaches you don't want]
- [Known antipatterns for your stack]

**Performance requirements:**
- [Response time targets]
- [Throughput requirements]
- [Resource constraints]

**Compatibility:**
- [Browser support if web app]
- [OS support if desktop app]
- [API version requirements]

**Documentation:**
- [What needs to be documented as you build]
- [Code comments requirements]
- [API documentation format]

---

## Template Usage Instructions

**How to use this template:**

1. **Fill out every section** - The more complete your spec, the better MDD can structure your project
2. **Be specific** - "Users can log in" is vague. "Users authenticate via JWT stored in httpOnly cookies with 7-day expiration and refresh tokens" is actionable
3. **Document your decisions** - Don't just list features. Explain WHY certain choices were made
4. **Include edge cases** - The unusual situations are where bugs hide. Document them now
5. **Define dependencies** - Make it clear what needs to be built before what
6. **Keep it in sync** - As you refine your thinking, update the spec before importing into MDD

**When you're ready:**

1. Save this file as `[project-name]-spec.md` in a `.gitignore`d `MDs/` folder
2. Open VS Code in WSL mode in your project directory
3. Run: `/mdd import-spec ./MDs/[project-name]-spec.md`
4. MDD will analyze the spec and generate initiatives, waves, and feature docs
5. Start building with `/mdd [feature-doc-name]`

**Remember:** The spec is your source of truth ONLY at import time. After MDD generates feature docs, those become your source of truth. You work with feature docs from that point forward.
