import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db/client';
import { AGENT_CLIENTS, actors, agentConnections, agentProjectGrants, oauthClients, oauthCodes, projects } from './db/schema';
import { AppError } from './errors';
import { appendEvent } from './events';
import { newToken } from './agents';
import { assertOwner, type Actor } from './policy';

/**
 * OAuth 2.1 for hosted MCP connectors (D-35): RFC 7591 registration, authorization code + PKCE (S256),
 * RFC 8414 / RFC 9728 metadata. The access token is an ordinary agent token for the connection the owner
 * approved, so Disconnect, Delete and per-project grants work exactly as for pasted tokens.
 */

const sha256 = (s: string) => createHash('sha256').update(s).digest();
const CODE_TTL_MS = 10 * 60 * 1000;

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export function protectedResourceMetadata() {
  const site = siteUrl();
  return {
    resource: `${site}/api/mcp`,
    authorization_servers: [site],
    bearer_methods_supported: ['header'],
    resource_name: 'Roundabout',
  };
}

export function authorizationServerMetadata() {
  const site = siteUrl();
  return {
    issuer: site,
    authorization_endpoint: `${site}/oauth/authorize`,
    token_endpoint: `${site}/oauth/token`,
    registration_endpoint: `${site}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    scopes_supported: ['mcp'],
  };
}

/** OAuth-style error: `error` is an RFC 6749 code, `status` the HTTP status to send. */
export class OAuthError extends Error {
  constructor(readonly error: string, readonly description: string, readonly status = 400) {
    super(description);
  }
}

// ── Registration (RFC 7591) ───────────────────────────────────────────────────

// Redirect targets must be https, or http on a loopback host (native and local tools).
const redirectUri = z.string().url().refine((u) => {
  const url = new URL(u);
  return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
}, 'Redirect URIs must use https (or http on localhost).');

const registrationInput = z.object({
  redirect_uris: z.array(redirectUri).min(1).max(10),
  client_name: z.string().trim().min(1).max(100).optional(),
  token_endpoint_auth_method: z.enum(['none', 'client_secret_post', 'client_secret_basic']).optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

export async function registerClient(body: unknown) {
  const parsed = registrationInput.safeParse(body);
  if (!parsed.success) throw new OAuthError('invalid_client_metadata', parsed.error.issues[0].message);
  const input = parsed.data;
  if (input.grant_types && !input.grant_types.includes('authorization_code')) {
    throw new OAuthError('invalid_client_metadata', 'Only the authorization_code grant is supported.');
  }
  // RFC 7591 defaults to client_secret_basic when the method is omitted.
  const method = input.token_endpoint_auth_method ?? 'client_secret_basic';
  const clientId = `rbc_${randomBytes(16).toString('base64url')}`;
  const secret = method === 'none' ? null : `rbs_${randomBytes(32).toString('base64url')}`;
  const clientName = input.client_name ?? new URL(input.redirect_uris[0]).hostname;
  await db.insert(oauthClients).values({
    clientId, clientSecretHash: secret ? sha256(secret) : null, tokenEndpointAuthMethod: method,
    clientName, redirectUris: input.redirect_uris,
  });
  return {
    client_id: clientId,
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: clientName,
    redirect_uris: input.redirect_uris,
    token_endpoint_auth_method: method,
    grant_types: ['authorization_code'],
    response_types: ['code'],
  };
}

// ── Authorization request ─────────────────────────────────────────────────────

export type AuthorizeRequest = {
  clientId: string; redirectUri: string; codeChallenge: string; codeChallengeMethod: string;
  responseType: string; state: string | null;
};

/** Which Roundabout client type an OAuth app most likely is, from its name and callback host. */
export function guessClient(clientName: string, redirectUri: string): (typeof AGENT_CLIENTS)[number] {
  const host = (() => { try { return new URL(redirectUri).hostname; } catch { return ''; } })();
  const text = `${clientName} ${host}`.toLowerCase();
  if (text.includes('duet')) return 'claude_duet';
  if (host.endsWith('claude.ai') || host.endsWith('anthropic.com') || text.includes('claude')) return 'claude_ai';
  if (text.includes('dots')) return 'dots';
  if (host.endsWith('chatgpt.com') || host.endsWith('openai.com') || text.includes('chatgpt')) return 'chatgpt';
  if (text.includes('grok bot')) return 'grok_bot';
  if (host.endsWith('grok.com') || host.endsWith('x.ai') || text.includes('grok')) return 'grok';
  if (host.endsWith('google.com') || text.includes('gemini')) return 'gemini_app';
  if (text.includes('muse')) return 'muse';
  return 'other';
}

/**
 * Validate an authorization request. Problems with the client or redirect URI are shown on the page (never
 * redirected, so a bad link can't bounce the owner somewhere else); others go back to the client as errors.
 */
type LoadedRequest =
  | { fatal: string; client?: undefined; redirectError?: undefined }
  | { fatal?: undefined; client: typeof oauthClients.$inferSelect; redirectError?: string };

export async function loadAuthorizeRequest(req: AuthorizeRequest): Promise<LoadedRequest> {
  const [client] = await db.select().from(oauthClients).where(eq(oauthClients.clientId, req.clientId));
  if (!client) return { fatal: 'This app is not registered with Roundabout. Remove the connector and add it again.' };
  if (!client.redirectUris.includes(req.redirectUri)) return { fatal: 'The redirect address does not match this app’s registration.' };
  if (req.responseType !== 'code') return { client, redirectError: 'unsupported_response_type' };
  if (!req.codeChallenge || req.codeChallengeMethod !== 'S256') return { client, redirectError: 'invalid_request' };
  return { client };
}

export function errorRedirect(redirectUri: string, error: string, state: string | null) {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  if (state) url.searchParams.set('state', state);
  return url.toString();
}

const consentInput = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(80),
  client: z.enum(AGENT_CLIENTS),
  projectIds: z.array(z.string().uuid()).max(200),
});

/**
 * The owner approved the request: create (or reuse) this app's agent connection with the chosen access,
 * and return the redirect carrying a single-use code.
 */
export async function approveAuthorization(actor: Actor, req: AuthorizeRequest, input: unknown): Promise<string> {
  assertOwner(actor);
  const loaded = await loadAuthorizeRequest(req);
  if (loaded.fatal !== undefined) throw new AppError('VALIDATION', loaded.fatal);
  if (loaded.redirectError) return errorRedirect(req.redirectUri, loaded.redirectError, req.state);
  const parsed = consentInput.safeParse(input);
  if (!parsed.success) throw new AppError('VALIDATION', parsed.error.issues[0].message);
  const { name, client, projectIds } = parsed.data;
  const code = randomBytes(32).toString('base64url');

  await db.transaction(async (tx) => {
    const owned = projectIds.length
      ? await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.workspaceId, actor.workspaceId), inArray(projects.id, projectIds)))
      : [];
    if (owned.length !== new Set(projectIds).size) throw new AppError('VALIDATION', 'Choose projects from your workspace.');

    // Re-authorizing the same registered app (e.g. a reconnect) reuses its connection instead of piling up new ones.
    // Hosted apps register a new OAuth client on every reconnect, so match by registration or by client type (D-37).
    const [existing] = await tx.select().from(agentConnections).where(and(
      eq(agentConnections.workspaceId, actor.workspaceId), ne(agentConnections.status, 'revoked'), isNull(agentConnections.deletedAt),
      client === 'other' ? eq(agentConnections.oauthClientId, loaded.client.id)
        : or(eq(agentConnections.oauthClientId, loaded.client.id), eq(agentConnections.client, client)),
    ));
    let agentId: string;
    if (existing) {
      agentId = existing.id;
      await tx.update(agentConnections).set({ name, client, oauthClientId: loaded.client.id }).where(eq(agentConnections.id, agentId));
      await tx.delete(agentProjectGrants).where(eq(agentProjectGrants.agentConnectionId, agentId));
    } else {
      const [agent] = await tx.insert(agentConnections).values({
        workspaceId: actor.workspaceId, name, client, status: 'setup', oauthClientId: loaded.client.id,
      }).returning();
      agentId = agent.id;
      await tx.insert(actors).values({ workspaceId: actor.workspaceId, kind: 'agent', agentConnectionId: agentId });
      await appendEvent(tx, actor, 'agent.connected', {}, { agentId, name, client, projectIds, via: 'oauth' });
    }
    if (projectIds.length) {
      await tx.insert(agentProjectGrants).values([...new Set(projectIds)].map((projectId) => ({ agentConnectionId: agentId, projectId })));
    }
    await tx.insert(oauthCodes).values({
      codeHash: sha256(code), oauthClientId: loaded.client.id, agentConnectionId: agentId,
      redirectUri: req.redirectUri, codeChallenge: req.codeChallenge, expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });
  }).catch((e) => {
    const pg = (e as { cause?: { code?: string } }).cause?.code;
    if (pg === '23505') throw new AppError('VALIDATION', 'An agent with this name already exists. Choose another name.');
    throw e;
  });

  const url = new URL(req.redirectUri);
  url.searchParams.set('code', code);
  if (req.state) url.searchParams.set('state', req.state);
  return url.toString();
}

// ── Token endpoint ────────────────────────────────────────────────────────────

function verifySecret(stored: Buffer | null, presented: string | undefined) {
  if (!stored || !presented) return false;
  const given = sha256(presented);
  return given.length === stored.length && timingSafeEqual(given, stored);
}

/** RFC 6749 §4.1.3 with PKCE (RFC 7636): one code, one token, then the code is spent. */
export async function exchangeCode(params: Record<string, string | undefined>, basicAuth: { id: string; secret: string } | null) {
  if (params.grant_type !== 'authorization_code') throw new OAuthError('unsupported_grant_type', 'Only authorization_code is supported.');
  const clientId = basicAuth?.id ?? params.client_id;
  if (!clientId || !params.code || !params.redirect_uri || !params.code_verifier) {
    throw new OAuthError('invalid_request', 'client_id, code, redirect_uri and code_verifier are required.');
  }
  const [client] = await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId));
  if (!client) throw new OAuthError('invalid_client', 'Unknown client.', 401);
  if (client.tokenEndpointAuthMethod !== 'none' && !verifySecret(client.clientSecretHash, basicAuth?.secret ?? params.client_secret)) {
    throw new OAuthError('invalid_client', 'Client authentication failed.', 401);
  }

  const { token, hash, prefix } = newToken();
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(oauthCodes).where(eq(oauthCodes.codeHash, sha256(params.code!))).for('update');
    if (!row || row.oauthClientId !== client.id || row.usedAt || row.expiresAt < new Date() || row.redirectUri !== params.redirect_uri) {
      throw new OAuthError('invalid_grant', 'The authorization code is invalid, expired or already used.');
    }
    const challenge = createHash('sha256').update(params.code_verifier!).digest('base64url');
    if (challenge !== row.codeChallenge) throw new OAuthError('invalid_grant', 'PKCE verification failed.');
    await tx.update(oauthCodes).set({ usedAt: sql`now()` }).where(eq(oauthCodes.codeHash, row.codeHash));
    const [agent] = await tx.select().from(agentConnections).where(eq(agentConnections.id, row.agentConnectionId));
    if (!agent || agent.status === 'revoked' || agent.deletedAt) throw new OAuthError('invalid_grant', 'This connection was disconnected.');
    // The new token replaces the previous one, so a reconnect retires the old token.
    await tx.update(agentConnections).set({ tokenHash: hash, tokenPrefix: prefix, lastError: null }).where(eq(agentConnections.id, agent.id));
  });
  return { access_token: token, token_type: 'Bearer', scope: 'mcp' };
}

