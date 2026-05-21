# Projects Built with MDD

Every project I've shipped since March 2026 was built entirely with MDD - not "used MDD for some features," but **built start to finish using this exact workflow**. Here's how it works and what it's produced.

---

## Requirements

**MDD works exclusively with VS Code and Claude Code.** Always work in WSL mode when using MDD - this ensures consistent file paths and command execution across your development environment.

---

## Three Ways to Start with MDD

MDD is flexible. You don't have to start with a spec document. Here are the three valid ways to begin:

### Option 1: Import a spec document (my preferred method)

Write a complete markdown spec in Claude Desktop over several hours, refining until you're happy with it. Then import it with `/mdd import-spec ./MDs/spec-name.md`. MDD generates initiatives, waves, and feature docs automatically.

**Why I prefer this:** I can sit on my phone or desktop and keep adjusting the spec until I'm completely happy with the design before writing any code. The spec becomes an artifact of all that thinking.

### Option 2: Start fresh in VS Code with MDD

Open a new project folder in VS Code (WSL mode) and either:
- Run `/mdd plan-initiative YOUR SYSTEM DESCRIPTION OR PATH TO DOCUMENT` to plan a multi-feature system with waves
- Run `/mdd new-feature-name DESCRIPTION OR PATH TO DOCUMENT` to build one feature at a time

**Be as precise as possible.** Whether you're planning an initiative or describing a single feature, the more detail you provide, the better MDD can structure and build it. You can either type your description directly in the command or point to a document.

**Why this works:** You're building the structure as you go, with MDD guiding you through the decisions. Good for projects where you're figuring out the design as you build.

### Option 3: Add MDD to an existing codebase

Run `/mdd reverse-engineer` in an existing project (VS Code, WSL mode). MDD reads your codebase and generates feature docs from the actual code. Your project becomes an MDD project, and you continue using MDD normally from that point forward.

**Why this works:** You don't have to rewrite everything to start using MDD. It meets you where you are.

---

## Define Your Stack and Constraints Up Front

**It's not just about what your application does - it's about how you want it built.**

MDD will follow whatever architectural decisions and constraints you define. If you don't specify these up front, you'll get whatever Claude defaults to, and that might not match how you actually want to work.

**You have two options:**

### Option 1: Bootstrap with the Starter Kit (recommended for new projects)

Use the [Claude Code Mastery Project Starter Kit](https://github.com/TheDecipherist/claude-code-mastery-project-starter-kit) to bootstrap your project. This gives you:
- Pre-configured TypeScript + Node.js setup
- Testing framework already wired
- Docker configuration ready
- Project structure and conventions established
- StrictDB and other tooling pre-integrated

The Starter Kit is already an MDD project, so you can start using MDD commands immediately. All the stack decisions are already made and documented.

### Option 2: Define your stack in the spec (or during planning)

If you're not using the Starter Kit, **you need to be explicit about your technical choices** in your spec document or when running `/mdd plan-initiative`. Include things like:

**Technical stack:**
- **Language and framework:** "TypeScript project using React with a Node.js backend"
- **Testing requirements:** "Write tests for all code" / "Minimum 80% coverage" / "Integration tests for all API endpoints"
- **Code organization:** "No file should exceed 300 lines" / "One component per file" / "Shared utilities in /lib"
- **Deployment:** "Create Docker containers for each service" / "Generate docker-compose.yml for local dev"
- **Database:** "Use MongoDB with native driver" / "PostgreSQL with migrations"
- **Error handling:** "All errors logged to structured logger" / "User-facing errors always return safe messages"

**Build priorities and dependencies:**
- **What needs to be built first:** "I need authentication and database connection working before anything else because the entire application depends on it"
- **Critical path features:** "User registration must be complete before we build the dashboard because users need accounts to access it"
- **What you want to achieve early:** "I want the API layer fully functional before building the frontend so I can test endpoints independently"

**MDD is smart at figuring out the correct starting order, but the more you can help it understand your priorities and dependencies, the better the end result.**

**The more specific you are about these constraints and goals, the more consistent your codebase will be.** MDD enforces what you define. If you don't define it, MDD can't enforce it.

**Getting your stack right from the start will make you way more successful down the line.** It's much harder to retrofit architectural decisions after you've already built 50 features than to specify them once at the beginning and have MDD enforce them throughout.

---

## Recommended Tools for New Users

If you're new to development or want to avoid common pitfalls, these companion tools integrate well with MDD and solve problems that trip up most projects:

### StrictDB - Database Layer
[View on npm →](https://www.npmjs.com/package/strictdb) • [GitHub →](https://github.com/TheDecipherist/strictdb)

**The problem:** Claude loves to create a new database connection in every single file that needs it. This is terrible for performance, connection pooling, and maintainability.

**The solution:** StrictDB provides a single shared database access layer that enforces best practices automatically. One connection pool, one configuration, one source of truth. It works across MongoDB, PostgreSQL, MySQL, SQLite, and Elasticsearch with the same API.

**Why it matters:** You don't have to figure out database best practices yourself. StrictDB handles connection management, query patterns, and error handling correctly from day one.

### ClassMCP - CSS Token Optimization
[View on npm →](https://www.npmjs.com/package/classmcp) • [GitHub →](https://github.com/TheDecipherist/classmcp)

**The problem:** Tailwind works great with AI natively, but it creates a lot of CSS classes which consumes significant tokens. In large projects, this adds up fast.

**The solution:** ClassMCP is an MCP server for AI-assisted CSS development that achieves ~77% token savings using semantic class patterns. It works with Tailwind, Bootstrap, UnoCSS, and Tachyons.

**Why it matters:** Your context window stays cleaner, Claude can see more of your project at once, and styling still works exactly how you'd expect.

### Classpresso - Build-Time CSS Consolidation  
[View on npm →](https://www.npmjs.com/package/classpresso) • [GitHub →](https://github.com/TheDecipherist/classpresso)

**The problem:** AI-generated code often creates redundant utility classes that slow down browser rendering.

**The solution:** Classpresso consolidates CSS classes at build time, eliminating redundancy. Results in 50% faster style recalculation and 42% faster First Paint.

**Why it matters:** Your AI-generated frontend becomes production-performant without manual optimization.

### Define Your Design System

Before you start building UI, **define your design system in your spec or planning docs:**
- Color palette (primary, secondary, accent, neutral colors)
- Typography scale (font families, sizes, weights)
- Spacing system (margins, padding, gaps)
- Component patterns (buttons, forms, cards, modals)

Claude will follow whatever design language you define. If you don't specify, you'll get inconsistent styling across features. Tailwind works great with AI, but pair it with ClassMCP to keep token usage manageable.

---

## Critical: This Is Not "One Prompt and Done"

**Regardless of which entry point you choose, MDD is not a magic "say what you want and it appears" tool.**

If you think you can get an amazing product by simply saying "Claude, build me MarkdownAI, it should be the best markdown app in the industry," you are not going to get far - whether you're using a spec document, planning interactively, or reverse-engineering existing code.

**The actual work is the same:**
- Define what the system does, how it works, what the constraints are, what the edge cases are
- Break it into features that can be built and tested independently
- Build each feature through MDD's 7-phase pipeline with mandatory gates
- Verify everything works in a real environment

**With a spec import:** You do most of this thinking up front in the spec document (4-10 hours), then MDD converts it to structure.

**With interactive planning (`/mdd plan-initiative` or `/mdd new-feature-name`):** You do this thinking as conversations with MDD while it builds the structure incrementally. Each feature description needs to be precise and complete.

**With reverse-engineering:** MDD extracts the structure from your code, but you still need to verify it's correct and fill in any gaps.

**All three paths require the same discipline:** clear thinking about what you're building, structured documentation, and proper testing. MDD doesn't replace that work - it helps you do it correctly and efficiently.

If you're not willing to think deeply about your system design, MDD is not the right tool for you. **But if you are willing to do that work, MDD will help you build in days what would normally take weeks or months.**

---

## My Workflow (Spec Import Method)

Since I prefer the spec import approach, here's exactly how I do it:

### 1. Brainstorm in Claude Desktop (Opus mode)

When I get an idea, I open Claude Desktop and brainstorm. I tell Claude to create a markdown spec document that we refine together as we explore the concept. This usually takes a couple of hours, sometimes up to 10 hours for complex systems. The goal is to be as precise as possible - define what the system does, how it works, what the constraints are, what the edge cases are.

**Output:** A complete spec document describing the entire system.

### 2. Import the spec into MDD (one-time conversion)

Once I'm happy with the spec and haven't missed anything major, I create a new project folder in `~/projects/PROJECT_NAME`. I put the spec in a `.gitignore`d `MDs/` folder (these are planning documents, not code). Then I open VS Code in WSL mode in that folder and run:

```bash
/mdd import-spec ./MDs/spec-name.md
```

MDD initializes its folder structure and asks a few questions. If the spec is large enough, MDD suggests breaking it into **Initiatives and Waves**. Initiatives are major feature groups. Waves are the build phases within each initiative.

**This is the last time you'll use the spec document.** From here forward, the feature docs MDD generates are your source of truth.

**Output:** Structured initiatives, waves, feature docs, and an execution plan.

### 3. Execute waves sequentially

MDD analyzes the spec and tells you which wave should run first. It structures the waves so they start at the right place, just like a developer would - foundation first, then features, then polish.

When you start a wave, MDD generates all the feature docs for that wave. Each feature doc describes one specific capability: what it does, how it works, what tests it needs, what dependencies it has.

At the end of each wave, MDD asks if you want to start the next wave. You run all waves until the entire initiative is documented.

**Output:** 20-80+ feature docs (depending on project size), organized by wave.

### 4. Build features one at a time

Once all feature docs exist, you build them one by one:

```bash
/mdd feature-doc-name
```

MDD asks a series of questions about the feature before building. Then it runs through its 7-phase pipeline:
1. Understand context
2. Map data flow  
3. Generate detailed documentation
4. Write test skeletons (Red Gate: tests must fail before implementation)
5. Plan implementation
6. Implement with iteration (Green Gate: tests must pass)
7. Verify in real environment (Integration Gate: must work in production)

You repeat this for every feature doc until the entire system is built.

**Output:** A fully working application, tested and verified, built exactly as the spec described.

---

## Why This Works

**The spec conversation is where the hard thinking happens.** You're not figuring out the design while writing code. You're getting the design right first, in natural language, in a conversation. Then MDD converts that conversation into structured documentation, and Claude Code implements from the docs.

**The feature docs are the source of truth.** Code drifts. Docs don't - because the code is regenerated from the docs. If something needs to change, you update the doc and regenerate. The manual is always correct.

**The gates enforce correctness.** You can't implement until tests exist and fail (Red Gate). You can't ship until tests pass (Green Gate). You can't close the feature until it works in a real environment (Integration Gate). No shortcuts, no "I'll test it later."

---

## The Projects

Here's everything I've built with this workflow since March 2026:

---

### MarkdownAI
**Live documents powered by directives** - markdown files that can query databases, call APIs, execute shell commands, render dynamically.

- **Spec conversation:** 4 hours (May 11, 2026)  
- **Build time:** 2 days (May 12-13, 2026)
- **Result:** 6 npm packages, 80 feature docs, 15,000 weekly downloads in first 48 hours

[View the original spec →](/specs/markdownai-spec-v1_0.md) • [View the repo →](https://github.com/TheDecipherist/markdownai) • [View .mdd/ folder →](https://github.com/TheDecipherist/markdownai/tree/main/.mdd)

---

### mdd-tui
**Terminal dashboard for MDD projects** - browse feature docs, audit reports, initiative progress without leaving the command line.

[View the repo →](https://github.com/TheDecipherist/mdd-tui) • [View .mdd/ folder →](https://github.com/TheDecipherist/mdd-tui/tree/main/.mdd)

---

### mdd-dashboard  
**Browser visual dashboard for MDD** - interactive D3 dependency graphs, live reload, git-aware filtering.

[View the repo →](https://github.com/TheDecipherist/mdd-dashboard) • [View .mdd/ folder →](https://github.com/TheDecipherist/mdd-dashboard/tree/main/.mdd)

---

### StrictDB
**Unified database driver** - MongoDB-style syntax across PostgreSQL, MySQL, MSSQL, SQLite, Elasticsearch. Single shared connection layer enforcing best practices.

- **Spec document:** 1,249 lines defining the complete architecture
- **Result:** One API, six databases, AI-first guardrails, self-correcting errors, schema discovery

[View the original spec →](/specs/strictdb-complete-plan.md) • [View the repo →](https://github.com/TheDecipherist/strictdb) • [View .mdd/ folder →](https://github.com/TheDecipherist/strictdb/tree/main/.mdd)

---

### DockerDoctor
**Docker container health monitoring and diagnostics** - automated health checks, log analysis, resource monitoring, and recovery suggestions.

[View the repo →](https://github.com/TheDecipherist/dockerdoctor) • [View .mdd/ folder →](https://github.com/TheDecipherist/dockerdoctor/tree/main/.mdd)

---

### Classpresso
**Build-time CSS class consolidation** - eliminates redundant utility classes. 50% faster style recalculation, 42% faster First Paint. Perfect for AI-generated code.

[View the repo →](https://github.com/TheDecipherist/classpresso) • [View .mdd/ folder →](https://github.com/TheDecipherist/classpresso/tree/main/.mdd)

---

### ClassMCP
**MCP server for AI-assisted CSS development** - 77% token savings using semantic patterns. Works with Tailwind, Bootstrap, UnoCSS, Tachyons.

[View the repo →](https://github.com/TheDecipherist/classmcp) • [View .mdd/ folder →](https://github.com/TheDecipherist/classmcp/tree/main/.mdd)

---

### TerseJSON
**Transparent JSON key compression library** - reduces memory usage and network bandwidth by 30-80% using lazy-loading proxies.

[View the repo →](https://github.com/TheDecipherist/tersejson) • [View .mdd/ folder →](https://github.com/TheDecipherist/tersejson/tree/main/.mdd)

---

### CompressMCP
**Lossless dictionary-based JSON key compression for MCP tool responses** - compresses tool call responses via pre/post hooks, reducing token usage without losing data.

[View the repo →](https://github.com/TheDecipherist/compressmcp) • [View .mdd/ folder →](https://github.com/TheDecipherist/compressmcp/tree/main/.mdd)

---

### PipeStage
**Type-safe pipeline composition for Node.js** - compose complex data transformation pipelines with built-in error handling, validation, and parallel execution support.

[View the repo →](https://github.com/TheDecipherist/pipestage) • [View .mdd/ folder →](https://github.com/TheDecipherist/pipestage/tree/main/.mdd)

---

### PeelX
**Recursive nested archive extraction CLI tool** - automatically extracts nested archives (zip in tar in gz) in one command. Python-based, distributed via PyPI and GitHub Releases.

[View the repo →](https://github.com/TheDecipherist/peelx) • [View .mdd/ folder →](https://github.com/TheDecipherist/peelx/tree/main/.mdd)

---

**Many more in the pipeline,** including MDDv2 - completely rebuilt on MarkdownAI, which in tests so far is running about 80% faster than the current MDD.

---

## One More Thing

Without MDD, Claude is good but never perfect - especially not on big projects. With MDD, it just works.
