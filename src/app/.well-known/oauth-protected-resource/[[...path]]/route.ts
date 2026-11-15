import { protectedResourceMetadata } from '@/server/oauth';
import { jsonResponse, preflight } from '@/server/oauth-http';

// RFC 9728, served at the root and at the path-suffixed form (/.well-known/oauth-protected-resource/api/mcp).
export const GET = () => jsonResponse(protectedResourceMetadata());
export const OPTIONS = preflight;
