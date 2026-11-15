import 'server-only';
import { OAuthError } from './oauth';

// Metadata, registration and token endpoints are called by connector backends and sometimes by browser-based
// MCP tools; none of them use cookies, so permissive CORS is safe here (D-35).
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version',
};

export const preflight = () => new Response(null, { status: 204, headers: CORS });

export function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { ...CORS, 'Cache-Control': 'no-store' } });
}

export function oauthErrorResponse(e: unknown) {
  if (e instanceof OAuthError) return jsonResponse({ error: e.error, error_description: e.description }, e.status);
  console.error('[oauth]', e instanceof Error ? e.message : e);
  return jsonResponse({ error: 'server_error', error_description: 'Something went wrong. Please retry.' }, 500);
}
