'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireOwner } from '@/server/auth';
import type { FormState } from '@/components/action-form';

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}

export async function linkGoogle(): Promise<FormState> {
  await requireOwner();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback?next=/settings` },
  });
  if (error || !data.url) return { error: 'Google linking is not available right now.' };
  redirect(data.url);
}
