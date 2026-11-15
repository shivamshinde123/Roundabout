import { OAuthError, registerClient } from '@/server/oauth';
import { jsonResponse, oauthErrorResponse, preflight } from '@/server/oauth-http';

// RFC 7591 dynamic client registration: hosted connectors register themselves before the owner signs in.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => { throw new OAuthError('invalid_client_metadata', 'Send a JSON body.'); });
    return jsonResponse(await registerClient(body), 201);
  } catch (e) {
    return oauthErrorResponse(e);
  }
}
export const OPTIONS = preflight;
