// Copy-paste setup for each client (api-specification.md "Client setup", D-26). Verify end to end per client (§3).
export const CLIENT_LABELS = { claude_code: 'Claude Code', codex: 'Codex', other: 'Other agent' } as const;
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

export function setupSteps(client: AgentClient, url: string, token: string): SetupStep[] {
  if (client === 'claude_code') {
    return [
      {
        title: 'Add Roundabout to Claude Code: run this in a terminal',
        // --scope user: available from every folder, not just the one the command ran in (Claude Code's default).
        blocks: [{ code: `claude mcp add --scope user --transport http roundabout ${url} --header "Authorization: Bearer ${token}"` }],
      },
      { title: 'Check the connection', blocks: [{ code: 'claude mcp get roundabout' }], note: 'It should say ✓ Connected.' },
      firstContact('Claude Code'),
    ];
  }
  if (client === 'codex') {
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
  }
  return [
    {
      title: "Add an MCP server in your agent's settings",
      blocks: [
        { label: 'Server URL (Streamable HTTP)', code: url },
        { label: 'Request header', code: `Authorization: Bearer ${token}` },
      ],
    },
    firstContact('the agent'),
  ];
}
