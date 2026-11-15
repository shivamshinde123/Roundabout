import { describe, expect, it } from 'vitest';
import { AGENT_CLIENTS } from '@/server/db/schema';
import { CLIENT_LABELS, setupSteps, type AgentClient } from '@/lib/agent-setup';

const URL = 'https://x.test/api/mcp';
const codes = (client: AgentClient) => setupSteps(client, URL, 'rbt_t').flatMap((s) => s.blocks.map((b) => b.code));

describe('setupSteps (D-26, D-34)', () => {
  it('has a label and a guide for every client the database accepts', () => {
    expect(Object.keys(CLIENT_LABELS).sort()).toEqual([...AGENT_CLIENTS].sort());
    for (const client of AGENT_CLIENTS) {
      const steps = setupSteps(client, URL, 'rbt_t');
      expect(steps.at(-1)!.title).toContain('whoami');
      // Every guide carries the endpoint and the token somewhere the user can copy.
      const all = steps.flatMap((s) => s.blocks.map((b) => b.code)).join('\n');
      if (client !== 'codex') expect(all).toContain('rbt_t');
      expect(all).toContain(URL);
    }
  });

  it('removes any old Claude Code entry, registers it for every folder, then checks it', () => {
    expect(codes('claude_code')).toEqual([
      'claude mcp remove roundabout -s user',
      'claude mcp add --scope user --transport http roundabout https://x.test/api/mcp --header "Authorization: Bearer rbt_t"',
      'claude mcp get roundabout',
    ]);
  });

  it('gives Codex a one-line add plus Windows and Unix token steps', () => {
    const c = codes('codex');
    expect(c[0]).toBe('codex mcp add roundabout --url https://x.test/api/mcp --bearer-token-env-var ROUNDABOUT_TOKEN');
    expect(c).toContain('setx ROUNDABOUT_TOKEN "rbt_t"');
  });

  it('uses each client’s documented config shape', () => {
    const parsed = (client: AgentClient) => JSON.parse(codes(client).find((c) => c.trim().startsWith('{'))!);
    expect(parsed('cursor').mcpServers.roundabout).toEqual({ url: URL, headers: { Authorization: 'Bearer rbt_t' } });
    expect(parsed('windsurf').mcpServers.roundabout).toEqual({ serverUrl: URL, headers: { Authorization: 'Bearer rbt_t' } });
    expect(parsed('copilot').mcpServers.roundabout).toMatchObject({ type: 'http', url: URL });
    expect(parsed('cline').mcpServers.roundabout).toMatchObject({ type: 'streamableHttp', url: URL });
    expect(parsed('zed').context_servers.roundabout).toEqual({ url: URL, headers: { Authorization: 'Bearer rbt_t' } });
    expect(parsed('warp').roundabout).toEqual({ url: URL, headers: { Authorization: 'Bearer rbt_t' } });
    expect(parsed('jetbrains').mcpServers.roundabout).toMatchObject({
      command: 'npx', args: ['-y', 'mcp-remote', URL, '--header', 'Authorization:${ROUNDABOUT_AUTH}'], env: { ROUNDABOUT_AUTH: 'Bearer rbt_t' },
    });
    expect(codes('gemini_cli')[0]).toBe('gemini mcp add -s user --transport http --header "Authorization: Bearer rbt_t" roundabout https://x.test/api/mcp');
    expect(codes('opencode')[0]).toBe("opencode mcp add roundabout --global --url https://x.test/api/mcp --header 'Authorization=Bearer rbt_t'");
  });
});
