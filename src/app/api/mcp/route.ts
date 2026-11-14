import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { authenticateAgent } from '@/server/agents';
import { AppError } from '@/server/errors';
import { buildMcpServer } from '@/server/mcp/tools';

// Stateless MCP over Streamable HTTP (D-12): every request authenticates on its own; no sessions in memory.
export async function POST(request: Request) {
  let actor;
  try {
    actor = await authenticateAgent(request.headers.get('authorization'));
  } catch (e) {
    const message = e instanceof AppError ? e.message : 'Unauthorized';
    return Response.json(
      { jsonrpc: '2.0', error: { code: -32001, message }, id: null },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' } },
    );
  }
  const server = buildMcpServer(actor);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}

const notAllowed = () =>
  Response.json(
    { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed: this server is stateless; use POST.' }, id: null },
    { status: 405, headers: { Allow: 'POST' } },
  );
export const GET = notAllowed;
export const DELETE = notAllowed;
