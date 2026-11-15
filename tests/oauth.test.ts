import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { agentConnections, oauthClients } from '@/server/db/schema';
import { createProject } from '@/server/projects';
import {
  approveAuthorization, authorizationServerMetadata, exchangeCode, guessClient, loadAuthorizeRequest,
  protectedResourceMetadata, registerClient, type AuthorizeRequest,
} from '@/server/oauth';
import { POST as tokenRoute } from '@/app/oauth/token/route';
import { POST as registerRoute } from '@/app/oauth/register/route';
import { rpc, call } from './mcp-client';
import { seedOwner } from './helpers';

const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const pkce = () => {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
};
const request = (clientId: string, challenge: string, extra: Partial<AuthorizeRequest> = {}): AuthorizeRequest => ({
  clientId, redirectUri: REDIRECT, codeChallenge: challenge, codeChallengeMethod: 'S256', responseType: 'code', state: 'st8', ...extra,
});
const codeFrom = (url: string) => new URL(url).searchParams.get('code')!;
const errorOf = (p: Promise<unknown>) => p.then(() => 'OK', (e) => e.error ?? e.code);

async function connected(extra: { tokenEndpointAuthMethod?: 'none' | 'client_secret_post' } = {}) {
  const owner = await seedOwner();
  const { project } = await createProject(owner, { name: 'Site' });
  const client = await registerClient({
    client_name: 'Claude', redirect_uris: [REDIRECT], token_endpoint_auth_method: extra.tokenEndpointAuthMethod ?? 'none',
  });
  const { verifier, challenge } = pkce();
  const redirect = await approveAuthorization(owner, request(client.client_id, challenge), {
    name: 'Claude', client: 'claude_ai', projectIds: [project.id],
  });
  return { owner, project, client, verifier, challenge, redirect };
}

describe('OAuth for hosted connectors (D-35)', () => {
  it('publishes RFC 9728 and RFC 8414 metadata that point at each other', () => {
    const resource = protectedResourceMetadata();
    const server = authorizationServerMetadata();
    expect(resource.resource).toMatch(/\/api\/mcp$/);
    expect(resource.authorization_servers).toEqual([server.issuer]);
    expect(server).toMatchObject({ code_challenge_methods_supported: ['S256'], grant_types_supported: ['authorization_code'] });
    expect(server.registration_endpoint).toMatch(/\/oauth\/register$/);
  });

  it('the MCP 401 tells clients where the metadata lives', async () => {
    const res = await rpc(null, 'tools/list');
    expect(res.status).toBe(401);
  });

  it('registers clients: public ones get no secret, confidential ones do; insecure redirects are refused', async () => {
    const pub = await registerClient({ redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none', client_name: 'X' });
    expect(pub).not.toHaveProperty('client_secret');
    const conf = await registerClient({ redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'] });
    expect(conf).toMatchObject({ token_endpoint_auth_method: 'client_secret_basic' });
    expect(conf.client_secret).toMatch(/^rbs_/);
    expect(await errorOf(registerClient({ redirect_uris: ['http://evil.example/cb'] }))).toBe('invalid_client_metadata');
    expect(await errorOf(registerClient({ redirect_uris: ['http://localhost:7777/cb'] }))).toBe('OK');
    const res = await registerRoute(new Request('http://x/oauth/register', { method: 'POST', body: 'nope' }));
    expect(res.status).toBe(400);
    await db.delete(oauthClients).where(eq(oauthClients.clientId, pub.client_id));
  });

  it('runs the full flow: consent → code → token → a working agent limited to the chosen projects', async () => {
    const { client, verifier, redirect, project } = await connected();
    const url = new URL(redirect);
    expect(url.origin + url.pathname).toBe(REDIRECT);
    expect(url.searchParams.get('state')).toBe('st8');

    const res = await tokenRoute(new Request('http://x/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: codeFrom(redirect), redirect_uri: REDIRECT, code_verifier: verifier, client_id: client.client_id }),
    }));
    expect(res.status).toBe(200);
    const token = await res.json();
    expect(token).toMatchObject({ token_type: 'Bearer' });
    const who = await call(token.access_token, 'whoami', {});
    expect(who.data.agent).toMatchObject({ name: 'Claude' });
    expect(who.data.projects.map((p: { id: string }) => p.id)).toEqual([project.id]);
  });

  it('rejects a wrong PKCE verifier, a reused code and a mismatched redirect', async () => {
    const { client, verifier, redirect } = await connected();
    const base = { grant_type: 'authorization_code', client_id: client.client_id, code: codeFrom(redirect), redirect_uri: REDIRECT };
    expect(await errorOf(exchangeCode({ ...base, code_verifier: pkce().verifier }, null))).toBe('invalid_grant');
    expect(await errorOf(exchangeCode({ ...base, redirect_uri: 'https://claude.ai/other', code_verifier: verifier }, null))).toBe('invalid_grant');
    await exchangeCode({ ...base, code_verifier: verifier }, null);
    expect(await errorOf(exchangeCode({ ...base, code_verifier: verifier }, null))).toBe('invalid_grant');
  });

  it('confidential clients must present their secret (post or basic)', async () => {
    const owner = await seedOwner();
    const client = await registerClient({ client_name: 'ChatGPT', redirect_uris: [REDIRECT] });
    const { verifier, challenge } = pkce();
    const code = codeFrom(await approveAuthorization(owner, request(client.client_id, challenge), { name: 'ChatGPT', client: 'chatgpt', projectIds: [] }));
    const base = { grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier };
    expect(await errorOf(exchangeCode({ ...base, client_id: client.client_id, client_secret: 'rbs_wrong' }, null))).toBe('invalid_client');
    const ok = await exchangeCode(base, { id: client.client_id, secret: client.client_secret! });
    expect(ok.access_token).toMatch(/^rbt_/);
  });

  it('reconnecting the same app reuses its connection and retires the old token', async () => {
    const { owner, client, verifier, redirect } = await connected();
    const first = await exchangeCode({ grant_type: 'authorization_code', client_id: client.client_id, code: codeFrom(redirect), redirect_uri: REDIRECT, code_verifier: verifier }, null);
    const again = pkce();
    const redirect2 = await approveAuthorization(owner, request(client.client_id, again.challenge), { name: 'Claude', client: 'claude_ai', projectIds: [] });
    const second = await exchangeCode({ grant_type: 'authorization_code', client_id: client.client_id, code: codeFrom(redirect2), redirect_uri: REDIRECT, code_verifier: again.verifier }, null);
    expect((await rpc(first.access_token, 'tools/list')).status).toBe(401);
    expect((await call(second.access_token, 'whoami', {})).data.projects).toEqual([]);
    const rows = await db.select().from(agentConnections).where(eq(agentConnections.workspaceId, owner.workspaceId));
    expect(rows).toHaveLength(1);
  });

  it('never redirects for an unknown client or an unregistered redirect URI', async () => {
    const { client } = await connected();
    expect((await loadAuthorizeRequest(request('rbc_nope', 'x'))).fatal).toBeTruthy();
    expect((await loadAuthorizeRequest(request(client.client_id, 'x', { redirectUri: 'https://evil.example/cb' }))).fatal).toBeTruthy();
    expect((await loadAuthorizeRequest(request(client.client_id, 'x', { codeChallengeMethod: 'plain' }))).redirectError).toBe('invalid_request');
  });

  it('guesses the client type from the app name and callback host', () => {
    expect(guessClient('Claude', 'https://claude.ai/api/mcp/auth_callback')).toBe('claude_ai');
    expect(guessClient('ChatGPT', 'https://chatgpt.com/connector_platform_oauth_redirect')).toBe('chatgpt');
    expect(guessClient('Grok', 'https://grok.com/oauth/cb')).toBe('grok');
    expect(guessClient('Something', 'https://example.com/cb')).toBe('other');
  });
});
