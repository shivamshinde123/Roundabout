import { exchangeCode } from '@/server/oauth';
import { oauthErrorResponse, preflight, jsonResponse } from '@/server/oauth-http';

/** client_secret_basic: "Authorization: Basic base64(id:secret)" with form-encoded parts (RFC 6749 §2.3.1). */
function basicAuth(header: string | null) {
  const m = header?.match(/^Basic\s+(.+)$/i);
  if (!m) return null;
  const [id, ...rest] = Buffer.from(m[1], 'base64').toString('utf8').split(':');
  return { id: decodeURIComponent(id), secret: decodeURIComponent(rest.join(':')) };
}

export async function POST(request: Request) {
  try {
    const type = request.headers.get('content-type') ?? '';
    const params: Record<string, string> = type.includes('application/json')
      ? await request.json()
      : Object.fromEntries(new URLSearchParams(await request.text()));
    return jsonResponse(await exchangeCode(params, basicAuth(request.headers.get('authorization'))));
  } catch (e) {
    return oauthErrorResponse(e);
  }
}
export const OPTIONS = preflight;
