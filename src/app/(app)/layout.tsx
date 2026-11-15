import Link from 'next/link';
import { LogOut, Orbit } from 'lucide-react';
import { requireOwner } from '@/server/auth';
import { listProjects } from '@/server/projects';
import { inboxCounts } from '@/server/inbox';
import { Button } from '@/components/ui/button';
import { signOut } from './settings/actions';
import { SidebarNav } from './sidebar-nav';
import { NewProjectButton } from './projects/new-project';

/** Linear-style shell (D-31): the sidebar sits on the darkest plane; content lives in an inset, bordered panel. */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const owner = await requireOwner();
  const [projects, counts] = await Promise.all([listProjects(owner), inboxCounts(owner)]);
  return (
    <div className="flex min-h-screen bg-background">
      <a href="#main" className="sr-only rounded bg-background px-3 py-2 focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:ring-2">
        Skip to content
      </a>
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-3 px-3 py-4">
        <div className="flex items-center justify-between px-2">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary">
              <Orbit aria-hidden className="size-4 text-white" />
            </span>
            Roundabout
          </Link>
        </div>
        <NewProjectButton variant="outline" />
        <SidebarNav projects={projects.map((p) => ({ id: p.id, name: p.name, needsInput: counts[p.id] ?? 0 }))} />
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
            <LogOut aria-hidden /> Sign out
          </Button>
        </form>
      </aside>
      <main
        id="main"
        tabIndex={-1}
        className="my-2 mr-2 min-w-0 flex-1 rounded-xl border bg-panel p-6 focus:outline-none"
      >
        {children}
      </main>
    </div>
  );
}
