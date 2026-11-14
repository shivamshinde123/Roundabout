import Link from 'next/link';
import { requireOwner } from '@/server/auth';
import { Button } from '@/components/ui/button';
import { signOut } from './settings/actions';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  await requireOwner();
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col gap-1 border-r bg-muted/30 p-4">
        <Link href="/" className="mb-4 text-lg font-semibold tracking-tight">Roundabout</Link>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 text-sm">
          <Link className="rounded px-2 py-1.5 hover:bg-muted" href="/">Home</Link>
          <Link className="rounded px-2 py-1.5 hover:bg-muted" href="/settings">Settings</Link>
        </nav>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">Sign out</Button>
        </form>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
