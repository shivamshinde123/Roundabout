import { authorizationServerMetadata } from '@/server/oauth';
import { jsonResponse, preflight } from '@/server/oauth-http';

// RFC 8414 authorization server metadata (D-35).
export const GET = () => jsonResponse(authorizationServerMetadata());
export const OPTIONS = preflight;
