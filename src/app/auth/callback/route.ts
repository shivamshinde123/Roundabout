import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureWorkspace } from '@/server/workspace';
import { safeNext } from '@/server/auth';

// Handles email confirmation, password recovery, Google sign-in and Google linking (PKCE code exchange).
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await ensureWorkspace(data.user.id);
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  const reason = url.searchParams.get('error_description') ?? 'That link is invalid or has expired.';
  const back = next === '/settings' ? '/settings' : '/sign-in';
  return NextResponse.redirect(new URL(`${back}?error=${encodeURIComponent(reason)}`, url.origin));
}
