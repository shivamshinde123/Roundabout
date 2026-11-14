// Copy-paste setup for each client (api-specification.md "Client setup"). Verify end to end per client (§3).
export const CLIENT_LABELS = { claude_code: 'Claude Code', codex: 'Codex', other: 'Other agent' } as const;
export type AgentClient = keyof typeof CLIENT_LABELS;

export function mcpUrl(siteUrl: string) {
  return `${siteUrl.replace(/\/$/, '')}/api/mcp`;
}

export function setupSnippets(client: AgentClient, url: string, token: string): { label: string; code: string }[] {
  if (client === 'claude_code') {
    return [
      // --scope user: available from every folder, not just the one the command ran in (Claude Code's default).
      { label: 'Run in a terminal (any OS)', code: `claude mcp add --scope user --transport http roundabout ${url} --header "Authorization: Bearer ${token}"` },
      { label: 'Check it — should say ✓ Connected', code: 'claude mcp get roundabout' },
    ];
  }
  if (client === 'codex') {
    return [
      { label: 'Run in a terminal (any OS)', code: `codex mcp add roundabout --url ${url} --bearer-token-env-var ROUNDABOUT_TOKEN` },
      { label: 'Save the token — Windows PowerShell, then open a new terminal', code: `setx ROUNDABOUT_TOKEN "${token}"` },
      { label: 'Save the token — macOS / Linux (zsh; use ~/.bashrc for bash), then open a new terminal', code: `echo 'export ROUNDABOUT_TOKEN=${token}' >> ~/.zshrc` },
    ];
  }
  return [
    { label: 'MCP server URL (Streamable HTTP)', code: url },
    { label: 'Request header', code: `Authorization: Bearer ${token}` },
  ];
}
