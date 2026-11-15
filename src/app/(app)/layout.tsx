import Link from 'next/link';
import { Suspense } from 'react';
import { Tour } from '@/components/tour';
import { LogOut, Orbit } from 'lucide-react';
import { requireOwner } from '@/server/auth';
import { listProjects } from '@/server/projects';
import { inboxCounts } from '@/server/inbox';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { signOut } from './settings/actions';
import { SidebarNav } from './sidebar-nav';
import { NewProjectButton } from './projects/new-project';

/** Linear-style shell (D-31): the sidebar sits on the darkest plane; content lives in an inset, bordered panel. */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const owner = await requireOwner();
  const supabase = await createSupabaseServerClient();
  const [projects, counts, { data: claims }] = await Promise.all([listProjects(owner), inboxCounts(owner), supabase.auth.getClaims()]);
  const email = (claims?.claims.email as string | undefined) ?? '';
  const meta = (claims?.claims.user_metadata ?? {}) as { display_name?: string; tour_done?: boolean };
  const name = meta.display_name || email.split('@')[0];
  return (
    <div className="flex min-h-screen bg-background">
      <a href="#main" className="sr-only rounded bg-background px-3 py-2 focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:ring-2">
        Skip to content
      </a>
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-3 px-3 py-4">
        <div className="flex items-center justify-between px-2">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white">
            <span className="flex size-6 items-center justify-center rounded-md bg-[#2a2a2f] ring-1 ring-white/10">
              <Orbit aria-hidden className="size-4 text-white" />
            </span>
            Roundabout
          </Link>
        </div>
        <div data-tour="new-project" className="grid"><NewProjectButton variant="outline" /></div>
        <SidebarNav projects={projects.map((p) => ({ id: p.id, name: p.name, needsInput: counts[p.id] ?? 0 }))} />
        <div data-tour="account" className="flex items-center gap-2 rounded-lg border bg-panel p-2 transition-colors hover:border-[#3a3a40]">
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
            {name.charAt(0).toUpperCase()}
          </span>
          <Link href="/settings" title="Account and workspace settings" className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-medium text-foreground">{name}</span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="icon-sm" aria-label="Sign out" title="Sign out">
              <LogOut aria-hidden />
            </Button>
          </form>
        </div>
      </aside>
      <main
        id="main"
        tabIndex={-1}
        className="my-2 mr-2 min-w-0 flex-1 rounded-xl border bg-panel p-6 focus:outline-none"
      >
        {children}
      </main>
      {/* First-login tour; replay with ?tour=1 from the Guide (D-37). */}
      <Suspense fallback={null}><Tour firstRun={!meta.tour_done} /></Suspense>
    </div>
  );
}
