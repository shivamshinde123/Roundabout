# Client compatibility

`Roundabout.md` §9 asks each client entry to distinguish a **tested direct integration**, a **limited fallback**, and a client **still awaiting verification**. The setup steps shown on Connect agent come from `src/lib/agent-setup.ts`, and `tests/agent-setup.test.ts` checks that each client produces its documented config shape.

Every client connects to `<site>/api/mcp` (Streamable HTTP) with `Authorization: Bearer rbt_…` (D-5). Tokens go in the user's **personal** config, never in a project file.

## Group A: desktop and CLI tools (D-34)

| Client | How it connects | Status | Evidence |
|---|---|---|---|
| Claude Code | `claude mcp add --scope user --transport http … --header` | **Tested, live** | Production: `claude mcp get` ✓ Connected; real tool calls on the board (2026-11-15) |
| Codex | `codex mcp add --url … --bearer-token-env-var ROUNDABOUT_TOKEN` | **Tested, live** | Production: real tool calls, handoff and result (2026-11-15) |
| Gemini CLI | `gemini mcp add -s user --transport http --header …` | **Connection tested** | Local: the guide's exact command, then `gemini mcp list` → "✓ roundabout … Connected" (2026-11-15). A tool call through Gemini is still to be run. |
| Cursor | `~/.cursor/mcp.json` → `mcpServers.roundabout = { url, headers }` | Awaiting verification | Cursor docs, and the owner's existing `mcp.json` uses the same `url` + `headers` shape. The literal token is used because `${env:…}` in headers has a reported Cursor bug. |
| GitHub Copilot (VS Code) | `~/.copilot/mcp-config.json` → `mcpServers.roundabout = { type: "http", url, headers, tools: ["*"] }` | Awaiting verification | VS Code MCP configuration reference (the portable Copilot file; the editor-managed `mcp.json` is deprecated in Feb 2027) |
| Windsurf | Cascade → MCPs → View raw config → `mcpServers.roundabout = { serverUrl, headers }` | Awaiting verification | Windsurf guides. Its docs now redirect to Devin (Cognition) and the file path differs by version, so the guide opens the file from Windsurf's UI. |
| Cline | MCP Servers → Configure → `mcpServers.roundabout = { type: "streamableHttp", url, headers }` | Awaiting verification | docs.cline.bot. Without `type`, Cline falls back to legacy SSE. |
| OpenCode | `opencode mcp add roundabout --global --url … --header 'Authorization=Bearer …'` | Awaiting verification | opencode.ai docs (config `mcp.servers.<name>` with `type: "remote"`) |
| Zed | `settings.json` → `context_servers.roundabout = { url, headers }` | Awaiting verification | zed.dev docs. A header skips Zed's OAuth prompt. |
| Warp | Settings → Agents → MCP servers → + Add → URL server JSON `{ roundabout: { url, headers } }` | Awaiting verification | docs.warp.dev |
| JetBrains AI Assistant | **Limited fallback:** stdio bridge `npx -y mcp-remote <url> --header Authorization:${ROUNDABOUT_AUTH}` with the token in `env` | Awaiting verification | JetBrains documents only a bare `url` for remote servers, with no headers. The bridge follows mcp-remote's README. It needs Node 18+. Local bridge testing was not run (downloading and executing the package was not approved in the session). |
| Other agent | URL + `Authorization` header | Generic | Any MCP client that supports Streamable HTTP with custom headers |

**To verify a client:** connect it with the Connect agent guide, ask it to call `whoami`, and check that the agent shows **Active**. Then update its row here with the date.

## Group B: hosted chat apps (needs OAuth, not started)

Claude (claude.ai connectors), ChatGPT (connectors), Gemini and Grok connect to remote MCP servers through **OAuth**, not a pasted header. Roundabout needs an OAuth 2.1 authorization server for `/api/mcp` first (D-5 deferred this).

## Group C: to identify

Grok Bot, Muse, dots, Instinct and Claude Duet need research before planning. `Roundabout.md` links Crosswalk's Instinct notes.
