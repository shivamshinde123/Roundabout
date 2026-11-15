'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireOwner } from '@/server/auth';
import { formAction } from '@/server/actions';
import { AppError } from '@/server/errors';
import { deleteAccount, updateWorkspace } from '@/server/workspace';
import { displayNameInput, parse, passwordChangeInput } from '@/lib/schemas';
import type { FormState } from '@/components/action-form';

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}

/** Display name lives in the Supabase user's metadata; it shows in the sidebar account chip. */
export async function updateDisplayNameAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    await requireOwner();
    const { displayName } = parse(displayNameInput, { displayName: String(form.get('displayName') ?? '') });
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ data: { display_name: displayName || null } });
    if (error) throw new AppError('INTERNAL', 'Could not save your name. Try again.');
    // The sidebar reads the name from the session token, so mint a fresh one now.
    await supabase.auth.refreshSession();
    revalidatePath('/', 'layout');
    return { ok: 'Name saved.' };
  });
}

/** Re-checks the current password before changing it, so an unattended session can't lock you out. */
export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    await requireOwner();
    const { currentPassword, newPassword } = parse(passwordChangeInput, Object.fromEntries(form));
    if (currentPassword === newPassword) throw new AppError('VALIDATION', 'Choose a password different from your current one.');
    const supabase = await createSupabaseServerClient();
    const { data: claims } = await supabase.auth.getClaims();
    const email = claims?.claims.email as string | undefined;
    const check = email ? await supabase.auth.signInWithPassword({ email, password: currentPassword }) : null;
    if (!check || check.error) throw new AppError('VALIDATION', 'Your current password is incorrect.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error?.code === 'weak_password') throw new AppError('VALIDATION', 'That password is too weak. Try a longer one.');
    if (error) throw new AppError('INTERNAL', 'Could not change your password. Try again.');
    return { ok: 'Password changed.' };
  });
}

/** Supabase emails a confirmation link to both addresses; the change applies once confirmed. */
export async function changeEmailAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    await requireOwner();
    const email = z.email('Enter a valid email address.').safeParse(String(form.get('email') ?? '').trim());
    if (!email.success) throw new AppError('VALIDATION', 'Enter a valid email address.');
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser(
      { email: email.data },
      { emailRedirectTo: `${site()}/auth/callback?next=/settings` },
    );
    if (error?.code === 'email_exists') throw new AppError('VALIDATION', 'That email already has an account.');
    if (error) throw new AppError('INTERNAL', 'Could not start the email change. Try again.');
    return { ok: 'Check both inboxes: confirm the change from your current and your new address.' };
  });
}

export async function updateWorkspaceAction(_: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    await updateWorkspace(await requireOwner(), {
      name: String(form.get('name') ?? ''),
      defaultRequireReview: form.get('defaultRequireReview') === 'on',
    });
    revalidatePath('/', 'layout');
    return { ok: 'Workspace saved.' };
  });
}

export async function deleteAccountAction(_: FormState, form: FormData): Promise<FormState> {
  let done = false;
  const state = await formAction(async () => {
    if (String(form.get('confirm') ?? '').trim() !== 'DELETE') throw new AppError('VALIDATION', 'Type DELETE to confirm.');
    const owner = await requireOwner();
    await deleteAccount(owner);
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    done = true;
  });
  if (done) redirect('/sign-in?notice=' + encodeURIComponent('Your account and workspace were deleted.'));
  return state;
}

/** Remembers on the account (not the browser) that the tour was seen, so it shows once per person (D-37). */
export async function finishTourAction() {
  await requireOwner();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if ((data?.claims.user_metadata as { tour_done?: boolean } | undefined)?.tour_done) return;
  await supabase.auth.updateUser({ data: { tour_done: true } });
  await supabase.auth.refreshSession();
}
