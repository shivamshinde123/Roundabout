import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureWorkspace } from './workspace';
import type { HumanActor } from './policy';

/** The signed-in user's id, or null. Validates the session JWT. */
export const currentUserId = cache(async (): Promise<string | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
});

/**
 * Gate for every owner page and server action (D-12: proxy.ts is not an auth gate).
 * Redirects to sign-in when signed out; otherwise returns the owner's actor.
 */
export const requireOwner = cache(async (): Promise<HumanActor> => {
  const userId = await currentUserId();
  if (!userId) redirect('/sign-in');
  return ensureWorkspace(userId);
});

/** Only allow same-site relative redirects (prevents open redirects via ?next=). */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : fallback;
}
