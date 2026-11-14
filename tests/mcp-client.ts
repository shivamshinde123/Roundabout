// JSON-RPC helpers that drive the real /api/mcp route handler in tests.
import { POST } from '@/app/api/mcp/route';

let rpcId = 0;
export async function rpc(token: string | null, method: string, params: Record<string, unknown> = {}) {
  const res = await POST(
    new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
    }),
  );
  return { status: res.status, body: await res.json() };
}

/** Call a tool; returns its JSON payload and whether it errored. */
export async function call(token: string, name: string, args: Record<string, unknown> = {}) {
  const { body } = await rpc(token, 'tools/call', { name, arguments: args });
  if (body.error) throw new Error(`rpc error: ${JSON.stringify(body.error)}`);
  return { isError: Boolean(body.result.isError), data: JSON.parse(body.result.content[0].text) };
}

