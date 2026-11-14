import Link from 'next/link';
import { requireOwner } from '@/server/auth';
import { listProjects } from '@/server/projects';
import { Button } from '@/components/ui/button';
import { signOut } from './settings/actions';
import { SidebarNav } from './sidebar-nav';
import { NewProjectButton } from './projects/new-project';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const owner = await requireOwner();
  const projects = await listProjects(owner);
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col gap-2 border-r bg-muted/30 p-4">
        <Link href="/" className="mb-2 text-lg font-semibold tracking-tight">Roundabout</Link>
        <NewProjectButton />
        <SidebarNav projects={projects} />
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">Sign out</Button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
