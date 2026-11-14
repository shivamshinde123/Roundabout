import Link from 'next/link';
import { requireOwner } from '@/server/auth';
import { listProjects } from '@/server/projects';
import { inboxCounts } from '@/server/inbox';
import { Button } from '@/components/ui/button';
import { signOut } from './settings/actions';
import { SidebarNav } from './sidebar-nav';
import { NewProjectButton } from './projects/new-project';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const owner = await requireOwner();
  const [projects, counts] = await Promise.all([listProjects(owner), inboxCounts(owner)]);
  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only rounded bg-background px-3 py-2 focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:ring-2">
        Skip to content
      </a>
      <aside className="flex w-60 shrink-0 flex-col gap-2 border-r bg-muted/30 p-4">
        <Link href="/" className="mb-2 text-lg font-semibold tracking-tight">Roundabout</Link>
        <NewProjectButton />
        <SidebarNav projects={projects.map((p) => ({ id: p.id, name: p.name, needsInput: counts[p.id] ?? 0 }))} />
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">Sign out</Button>
        </form>
      </aside>
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-6 focus:outline-none">{children}</main>
    </div>
  );
}
