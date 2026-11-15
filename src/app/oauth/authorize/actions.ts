'use server';

import { redirect } from 'next/navigation';
import { requireOwner } from '@/server/auth';
import { toErrorBody } from '@/server/errors';
import { approveAuthorization, errorRedirect, loadAuthorizeRequest, type AuthorizeRequest } from '@/server/oauth';
import type { FormState } from '@/components/action-form';

function requestFrom(form: FormData): AuthorizeRequest {
  const s = (k: string) => String(form.get(k) ?? '');
  return {
    clientId: s('client_id'), redirectUri: s('redirect_uri'), codeChallenge: s('code_challenge'),
    codeChallengeMethod: s('code_challenge_method'), responseType: s('response_type'), state: form.get('state') ? s('state') : null,
  };
}

/** Owner approved: create the connection and send the code back to the connector. */
export async function approveAction(_: FormState, form: FormData): Promise<FormState> {
  let target = '';
  try {
    target = await approveAuthorization(await requireOwner(), requestFrom(form), {
      name: String(form.get('name') ?? ''),
      client: String(form.get('client') ?? ''),
      projectIds: form.getAll('projectIds').map(String),
    });
  } catch (e) {
    return { error: toErrorBody(e).message };
  }
  redirect(target);
}

/** Owner declined: tell the connector with access_denied (RFC 6749 §4.1.2.1). */
export async function denyAction(_: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const req = requestFrom(form);
  const loaded = await loadAuthorizeRequest(req);
  if (loaded.fatal !== undefined) return { error: loaded.fatal };
  redirect(errorRedirect(req.redirectUri, 'access_denied', req.state));
}
