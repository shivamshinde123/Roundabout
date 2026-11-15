'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/server/auth';
import { formAction } from '@/server/actions';
import { toErrorBody } from '@/server/errors';
import { createAgentConnection, deleteAgent, revokeAgent, rotateAgentToken, updateAgentGrants } from '@/server/agents';
import { CLIENT_LABELS, OAUTH_CLIENTS, mcpUrl, type AgentClient } from '@/lib/agent-setup';
import type { FormState } from '@/components/action-form';

export type TokenState = { error?: string; token?: string; client?: AgentClient; url?: string; agentId?: string; oauth?: boolean } | undefined;
const url = () => mcpUrl(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000');

export async function createAgentAction(_: TokenState, form: FormData): Promise<TokenState> {
  try {
    const client = String(form.get('client') ?? '') as AgentClient;
    // Hosted apps sign in with OAuth: the connection is created when you approve it on the consent screen (D-35).
    if (OAUTH_CLIENTS.has(client)) return { client, url: url(), oauth: true };
    const { agent, token } = await createAgentConnection(await requireOwner(), {
      name: String(form.get('name') ?? '').trim() || CLIENT_LABELS[client] || '',
      client,
      projectIds: form.getAll('projectIds').map(String),
    });
    revalidatePath('/', 'layout');
    return { token, client, url: url(), agentId: agent.id };
  } catch (e) {
    return { error: toErrorBody(e).message };
  }
}

export async function rotateTokenAction(_: TokenState, form: FormData): Promise<TokenState> {
  try {
    const agentId = String(form.get('agentId'));
    const { token } = await rotateAgentToken(await requireOwner(), { agentId });
    revalidatePath(`/agents/${agentId}`);
    return { token, client: String(form.get('client')) as AgentClient, url: url(), agentId };
  } catch (e) {
    return { error: toErrorBody(e).message };
  }
}

export async function updateGrantsAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    const agentId = String(form.get('agentId'));
    const { added, removed } = await updateAgentGrants(await requireOwner(), { agentId, projectIds: form.getAll('projectIds').map(String) });
    revalidatePath('/', 'layout');
    return { ok: added.length || removed.length ? 'Access updated. It applies to the agent’s next request.' : 'No changes.' };
  });
}

export async function revokeAgentAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    await revokeAgent(await requireOwner(), { agentId: String(form.get('agentId')) });
    revalidatePath('/', 'layout');
    return { ok: 'Disconnected.' };
  });
}

export async function deleteAgentAction(_: FormState, form: FormData): Promise<FormState> {
  let done = false;
  const state = await formAction(async () => {
    await deleteAgent(await requireOwner(), { agentId: String(form.get('agentId')) });
    done = true;
  });
  if (done) {
    revalidatePath('/', 'layout');
    redirect('/agents');
  }
  return state;
}
