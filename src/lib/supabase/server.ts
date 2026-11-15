import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Supabase is used for human auth only; app data goes through src/server/db.
// Create one client per request (required by @supabase/ssr).
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // proxy.ts refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}
