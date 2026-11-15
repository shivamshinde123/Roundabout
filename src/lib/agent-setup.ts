// Copy-paste setup for each client (api-specification.md "Client setup", D-26, D-34).
// Every format below comes from the client's own docs, checked 2026-11-15; see Docs/client-compatibility.md.
export const CLIENT_LABELS = {
  claude_code: 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  gemini_cli: 'Gemini CLI',
  copilot: 'GitHub Copilot',
  cline: 'Cline',
  opencode: 'OpenCode',
  zed: 'Zed',
  warp: 'Warp',
  jetbrains: 'JetBrains AI',
  other: 'Other agent',
} as const;
export type AgentClient = keyof typeof CLIENT_LABELS;

export function mcpUrl(siteUrl: string) {
  return `${siteUrl.replace(/\/$/, '')}/api/mcp`;
}

export type SetupStep = { title: string; blocks: { label?: string; code: string }[]; note?: string };

const firstContact = (client: string): SetupStep => ({
  title: `Open ${client} and ask it to call Roundabout's whoami tool`,
  blocks: [],
  note: 'This agent shows as Active on its page after its first successful request.',
});

const json = (value: unknown) => JSON.stringify(value, null, 2);
const MERGE = 'If the file already has other servers, add just the "roundabout" entry next to them.';
const PERSONAL = 'This is your personal config, so the token stays on your machine. Never commit it to a repository.';

export function setupSteps(client: AgentClient, url: string, token: string): SetupStep[] {
  const bearer = `Bearer ${token}`;
  const headers = { Authorization: bearer };
  switch (client) {
    case 'claude_code':
      return [
        {
          // `claude mcp add` won't replace an existing entry, so a reconnect would silently keep the old token.
          title: 'Remove any older Roundabout entry: run this in a terminal',
          blocks: [{ code: 'claude mcp remove roundabout -s user' }],
          note: 'If it says no server was found, that’s fine. It just means this is your first setup.',
        },
        {
          title: 'Add Roundabout to Claude Code',
          // --scope user: available from every folder, not just the one the command ran in (Claude Code's default).
          blocks: [{ code: `claude mcp add --scope user --transport http roundabout ${url} --header "Authorization: ${bearer}"` }],
        },
        { title: 'Check the connection', blocks: [{ code: 'claude mcp get roundabout' }], note: 'It should say ✓ Connected.' },
        firstContact('Claude Code'),
      ];
    case 'codex':
      return [
        {
          title: 'Add Roundabout to Codex: run this in a terminal',
          blocks: [{ code: `codex mcp add roundabout --url ${url} --bearer-token-env-var ROUNDABOUT_TOKEN` }],
        },
        {
          title: 'Save your token where Codex can read it (use the line for your system)',
          blocks: [
            { label: 'Windows (PowerShell)', code: `setx ROUNDABOUT_TOKEN "${token}"` },
            { label: 'macOS / Linux (zsh; use ~/.bashrc for bash)', code: `echo 'export ROUNDABOUT_TOKEN=${token}' >> ~/.zshrc` },
          ],
          note: 'Then close the terminal and open a new one, so it picks up the token.',
        },
        firstContact('Codex'),
      ];
    case 'cursor':
      return [
        {
          title: 'Open your global Cursor MCP file',
          blocks: [
            { label: 'Windows', code: '%USERPROFILE%\\.cursor\\mcp.json' },
            { label: 'macOS / Linux', code: '~/.cursor/mcp.json' },
          ],
          note: 'Or in Cursor Settings → Tools & MCP (just “MCP” in older versions) → New MCP Server, which opens the same file.',
        },
        { title: 'Add Roundabout to it', blocks: [{ code: json({ mcpServers: { roundabout: { url, headers } } }) }], note: `${MERGE} ${PERSONAL}` },
        { title: 'Check the connection', blocks: [], note: 'In Cursor Settings → Tools & MCP, "roundabout" should show a green dot and its tools. Restart Cursor if it doesn’t appear.' },
        firstContact('Cursor'),
      ];
    case 'windsurf':
      return [
        {
          title: 'Open Windsurf’s MCP config',
          blocks: [],
          note: 'In the Cascade panel, click the MCPs icon → Manage MCPs → View raw config. Windsurf opens the right file for your version.',
        },
        { title: 'Add Roundabout to it', blocks: [{ code: json({ mcpServers: { roundabout: { serverUrl: url, headers } } }) }], note: `${MERGE} ${PERSONAL}` },
        { title: 'Refresh and check the connection', blocks: [], note: 'Click Refresh in Manage MCPs. "roundabout" should be enabled with its tools listed.' },
        firstContact('Windsurf'),
      ];
    case 'gemini_cli':
      return [
        {
          title: 'Add Roundabout to Gemini CLI: run this in a terminal',
          // -s user: every folder; Gemini's default scope is the current project only.
          blocks: [{ code: `gemini mcp add -s user --transport http --header "Authorization: ${bearer}" roundabout ${url}` }],
          note: 'If you added Roundabout before, run "gemini mcp remove -s user roundabout" first.',
        },
        { title: 'Check the connection', blocks: [{ code: 'gemini mcp list' }], note: 'It should show roundabout as Connected.' },
        firstContact('Gemini CLI'),
      ];
    case 'copilot':
      return [
        {
          title: 'Open (or create) your Copilot MCP file',
          blocks: [
            { label: 'Windows', code: '%USERPROFILE%\\.copilot\\mcp-config.json' },
            { label: 'macOS / Linux', code: '~/.copilot/mcp-config.json' },
          ],
          note: 'VS Code’s Copilot and the Copilot CLI both read this file.',
        },
        {
          title: 'Add Roundabout to it',
          blocks: [{ code: json({ mcpServers: { roundabout: { type: 'http', url, headers, tools: ['*'] } } }) }],
          note: `${MERGE} ${PERSONAL}`,
        },
        { title: 'Restart VS Code and check the connection', blocks: [], note: 'In Copilot Chat (Agent mode), open the tools picker: "roundabout" should be listed.' },
        firstContact('Copilot (Agent mode)'),
      ];
    case 'cline':
      return [
        { title: 'Open Cline’s MCP settings', blocks: [], note: 'In the Cline panel: MCP Servers icon → Configure → Configure MCP Servers.' },
        {
          title: 'Add Roundabout to it',
          // Without "type": "streamableHttp", Cline treats a URL as legacy SSE.
          blocks: [{ code: json({ mcpServers: { roundabout: { type: 'streamableHttp', url, headers, disabled: false, autoApprove: [] } } }) }],
          note: `${MERGE} ${PERSONAL}`,
        },
        { title: 'Check the connection', blocks: [], note: 'In MCP Servers → Installed, "roundabout" should show a green dot.' },
        firstContact('Cline'),
      ];
    case 'opencode':
      return [
        {
          title: 'Add Roundabout to OpenCode: run this in a terminal',
          blocks: [{ code: `opencode mcp add roundabout --global --url ${url} --header 'Authorization=${bearer}'` }],
          note: '--global makes it available in every project. Keep the single quotes around the header.',
        },
        { title: 'Check the connection', blocks: [{ code: 'opencode mcp list' }], note: 'roundabout should be listed as connected.' },
        firstContact('OpenCode'),
      ];
    case 'zed':
      return [
        { title: 'Open Zed’s settings file', blocks: [], note: 'Command palette → "zed: open settings file".' },
        { title: 'Add Roundabout under "context_servers"', blocks: [{ code: json({ context_servers: { roundabout: { url, headers } } }) }], note: `${MERGE} ${PERSONAL}` },
        { title: 'Check the connection', blocks: [], note: 'Agent panel → Settings: "roundabout" should show a green dot. With the header set, Zed skips its OAuth prompt.' },
        firstContact('Zed’s agent'),
      ];
    case 'warp':
      return [
        {
          title: 'Add an MCP server in Warp',
          blocks: [],
          note: 'Settings → Agents → MCP servers → + Add → "Streamable HTTP or SSE Server (URL)".',
        },
        { title: 'Paste this configuration', blocks: [{ code: json({ roundabout: { url, headers } }) }], note: PERSONAL },
        { title: 'Start it and check the connection', blocks: [], note: 'On the MCP servers page, "roundabout" should be running with its tools listed.' },
        firstContact('Warp’s agent'),
      ];
    case 'jetbrains':
      return [
        {
          title: 'Open AI Assistant’s MCP settings',
          blocks: [],
          note: 'Settings → Tools → AI Assistant → Model Context Protocol (MCP) → Add → As JSON.',
        },
        {
          title: 'Paste this configuration',
          // AI Assistant documents only a bare "url" for remote servers, with no headers. mcp-remote is a small local
          // bridge that forwards the bearer token; the header goes via env so the space in "Bearer …" survives on Windows.
          blocks: [{
            code: json({
              mcpServers: {
                roundabout: {
                  command: 'npx',
                  args: ['-y', 'mcp-remote', url, '--header', 'Authorization:${ROUNDABOUT_AUTH}'],
                  env: { ROUNDABOUT_AUTH: bearer },
                },
              },
            }),
          }],
          note: 'Needs Node.js 18 or newer. AI Assistant can’t send a token to a URL server directly, so the mcp-remote bridge forwards it.',
        },
        { title: 'Apply and check the connection', blocks: [], note: 'The MCP settings list should show "roundabout" as connected.' },
        firstContact('AI Assistant (Agent mode)'),
      ];
    case 'other':
      return [
        {
          title: "Add an MCP server in your agent's settings",
          blocks: [
            { label: 'Server URL (Streamable HTTP)', code: url },
            { label: 'Request header', code: `Authorization: ${bearer}` },
          ],
        },
        firstContact('the agent'),
      ];
  }
}
