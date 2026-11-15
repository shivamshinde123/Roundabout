'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureWorkspace } from '@/server/workspace';
import type { FormState } from '@/components/action-form';

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const email = z.email('Enter a valid email address.');
const password = z.string().min(8, 'Use at least 8 characters.').max(72, 'Use at most 72 characters.');

function fail(error: z.ZodError | string): FormState {
  return { error: typeof error === 'string' ? error : error.issues[0].message };
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ email, password: z.string().min(1, 'Enter your password.') }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return fail(error.code === 'email_not_confirmed'
      ? 'Confirm your email first — check your inbox for the link.'
      : 'Email or password is incorrect.');
  }
  await ensureWorkspace(data.user.id);
  redirect('/');
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ email, password }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${site()}/auth/callback` },
  });
  if (error) return fail(error.message);
  if (data.session) {
    await ensureWorkspace(data.user!.id);
    redirect('/');
  }
  return { ok: 'Check your inbox for a link to confirm your email.' };
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ email }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error);

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${site()}/auth/callback?next=/reset-password`,
  });
  // Same answer whether or not the account exists, so the form can't be used to discover accounts.
  return { ok: 'If that email has an account, a reset link is on its way.' };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ password }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === 'same_password') return fail('Choose a password different from your current one.');
    if (error.code === 'weak_password') return fail('That password is too weak. Try a longer one.');
    return fail('Your reset link has expired. Request a new one.');
  }
  redirect('/');
}
