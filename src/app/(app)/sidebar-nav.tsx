'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function SidebarNav({ projects }: { projects: { id: string; name: string }[] }) {
  const path = usePathname();
  const item = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn('truncate rounded px-2 py-1.5 hover:bg-muted', active && 'bg-muted font-medium')}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 text-sm">
      <p className="px-2 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Projects</p>
      {projects.length === 0 && <p className="px-2 text-muted-foreground">No projects yet</p>}
      {projects.map((p) => item(`/projects/${p.id}`, p.name, path.startsWith(`/projects/${p.id}`)))}
      <div className="mt-4 border-t pt-2">{item('/settings', 'Settings', path === '/settings')}</div>
    </nav>
  );
}
