## MDD Rules - MCP Tools

Rules loaded when `stack.frameworks` includes `mcp`. Applied additively to audit criteria and build checklists.

### Audit Criteria

#### P2 - Missing Input Validation
- MCP tool handler does not call the project's canonical input validation function as its first statement before any tool logic executes - P2. Unvalidated MCP input is an untrusted external boundary. To identify the canonical function: check the feature doc's `integration_contracts` for the required function name, or search the codebase for existing tool handlers and use the same validation call they use. Common names: `validateMcpInput`, `parseMcpArgs`, `checkToolInput`.

#### P3 - No Malformed Input Test
- MCP tool handler has no test asserting it rejects malformed or missing input - P3. The test must verify the handler returns an error (not throws unhandled) when required fields are absent or the wrong type.

### Build Checklist (Phase 6)

- **validateMcpInput first:** Before writing any tool logic, confirm `validateMcpInput` is imported and called as the first statement in every new tool handler. Use the existing canonical reference tool in the codebase as the template.
- **Rejection test:** For every new MCP tool, add a test that passes malformed input and asserts the handler returns a structured error response rather than throwing.
