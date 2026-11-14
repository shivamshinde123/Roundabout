import { describe, expect, it } from 'vitest';
import { setupSnippets } from '@/lib/agent-setup';

describe('setupSnippets', () => {
  const url = 'https://x.test/api/mcp';
  it('registers Claude Code for every folder', () => {
    expect(setupSnippets('claude_code', url, 'rbt_t')[0].code).toContain('claude mcp add --scope user --transport http roundabout https://x.test/api/mcp');
  });
  it('gives Codex a one-line add plus Windows and Unix token steps', () => {
    const codes = setupSnippets('codex', url, 'rbt_t').map((s) => s.code);
    expect(codes[0]).toBe('codex mcp add roundabout --url https://x.test/api/mcp --bearer-token-env-var ROUNDABOUT_TOKEN');
    expect(codes.some((c) => c.startsWith('setx ROUNDABOUT_TOKEN "rbt_t"'))).toBe(true);
    expect(codes.some((c) => c.includes("export ROUNDABOUT_TOKEN=rbt_t"))).toBe(true);
  });
});
