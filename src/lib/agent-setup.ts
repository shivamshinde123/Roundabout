// Copy-paste setup for each client (api-specification.md "Client setup"). Verify end to end per client (§3).
export const CLIENT_LABELS = { claude_code: 'Claude Code', codex: 'Codex', other: 'Other agent' } as const;
export type AgentClient = keyof typeof CLIENT_LABELS;

export function mcpUrl(siteUrl: string) {
  return `${siteUrl.replace(/\/$/, '')}/api/mcp`;
}

export function setupSnippets(client: AgentClient, url: string, token: string): { label: string; code: string }[] {
  if (client === 'claude_code') {
    return [{ label: 'Run in a terminal', code: `claude mcp add --transport http roundabout ${url} --header "Authorization: Bearer ${token}"` }];
  }
  if (client === 'codex') {
    return [
      { label: 'Add to ~/.codex/config.toml', code: `[mcp_servers.roundabout]\nurl = "${url}"\nbearer_token_env_var = "ROUNDABOUT_TOKEN"` },
      { label: 'Set in the shell that runs Codex', code: `export ROUNDABOUT_TOKEN=${token}` },
    ];
  }
  return [
    { label: 'MCP server URL (Streamable HTTP)', code: url },
    { label: 'Request header', code: `Authorization: Bearer ${token}` },
  ];
}
