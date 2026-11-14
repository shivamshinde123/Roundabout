import { describe, expect, it } from 'vitest';
import { setupSteps } from '@/lib/agent-setup';

const codes = (client: Parameters<typeof setupSteps>[0]) =>
  setupSteps(client, 'https://x.test/api/mcp', 'rbt_t').flatMap((s) => s.blocks.map((b) => b.code));

describe('setupSteps', () => {
  it('registers Claude Code for every folder, then checks it', () => {
    expect(codes('claude_code')).toEqual([
      'claude mcp add --scope user --transport http roundabout https://x.test/api/mcp --header "Authorization: Bearer rbt_t"',
      'claude mcp get roundabout',
    ]);
  });
  it('gives Codex a one-line add plus Windows and Unix token steps', () => {
    const c = codes('codex');
    expect(c[0]).toBe('codex mcp add roundabout --url https://x.test/api/mcp --bearer-token-env-var ROUNDABOUT_TOKEN');
    expect(c).toContain('setx ROUNDABOUT_TOKEN "rbt_t"');
    expect(c.some((x) => x.includes('export ROUNDABOUT_TOKEN=rbt_t'))).toBe(true);
  });
  it('ends every client with the whoami first-contact step', () => {
    for (const client of ['claude_code', 'codex', 'other'] as const) {
      expect(setupSteps(client, 'u', 't').at(-1)!.title).toContain('whoami');
    }
  });
});
