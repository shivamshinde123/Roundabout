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

## Group B: hosted apps that connect through OAuth (D-35)

These apps add Roundabout as a **connector** with just the URL `<site>/api/mcp`. They discover Roundabout's OAuth server from the 401 response, register themselves (RFC 7591), and send you to Roundabout's consent screen. There you name the agent, confirm its client type and pick its projects. Connect agent shows their steps without minting a token.

| Client | Where you add it | Status | Evidence |
|---|---|---|---|
| Claude (claude.ai, desktop, mobile) | Settings → Connectors → Add custom connector | **OAuth flow tested** (simulated) | Local: register → browser consent → Allow → PKCE code exchange → `whoami` over MCP as agent "Claude", limited to the chosen project (2026-11-15). Not yet tried from claude.ai itself. Claude's callback is `https://claude.ai/api/mcp/auth_callback`. |
| Claude Duet | Uses your Claude connectors, so add Roundabout to Claude first | Awaiting verification | Duet "uses your existing Claude memory, skills, and connectors" (launch coverage, Oct 2026) |
| ChatGPT | Settings → Apps → Advanced → Developer mode → Create (OAuth) | Awaiting verification | Developer mode guides. Callback `https://chatgpt.com/connector_platform_oauth_redirect`. ChatGPT registers as a confidential client, which is supported (`client_secret_basic`/`post`). |
| ChatGPT dots | Uses ChatGPT's connectors and plugins | Awaiting verification | OpenAI dots launch coverage (DevDay, Sept 2026) |
| Grok | grok.com/connectors → New Connector → Custom | Awaiting verification | docs.x.ai. Needs a paid Grok plan. |
| Grok Bot | Same Grok connectors | Awaiting verification | Crosswalk notes, and a Sept 2026 forum report of a redirect-URI issue in Grok Bot's OAuth |
| Gemini | gemini.google.com → Settings → Connected Apps → Custom apps | Awaiting verification | Third-party guides. Availability varies by account and region, and Keep Activity must be on. |

## Group C: agents that use a pasted token

| Client | How it connects | Status | Evidence |
|---|---|---|---|
| Meta Muse | Ask Muse to add a custom connector; paste the token into its secure credential prompt | Awaiting verification | Vendor guides: Muse builds connectors from a description and keeps keys in a separate secure store |
| Instinct | Text it the URL and the `Authorization` header; it keeps the key itself | Awaiting verification | Crosswalk's Instinct notes: no settings screen, it "keeps a key of its own" |

## Logos (D-36)

Each client shows its real mark in a circle in its brand colour (`src/lib/client-logos.ts`): Simple Icons 16.37.0 (CC0) for Cursor, Windsurf, Gemini, GitHub Copilot, Cline, OpenCode, Zed, Warp and JetBrains; LobeHub icons 1.102.0 (MIT) for Claude, Claude Code, OpenAI (ChatGPT, dots), Codex, Grok and Meta AI (Muse). Instinct has no published mark, so it uses a chat-bubble symbol, and "Other agent" uses a bot symbol. The marks belong to their owners and are shown only to identify each integration.
