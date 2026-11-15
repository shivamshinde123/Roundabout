'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Bot, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectIcon } from '@/lib/visual';

export function SidebarNav({ projects }: { projects: { id: string; name: string; needsInput: number }[] }) {
  const path = usePathname();
  const item = (href: string, label: string, icon: ReactNode, active: boolean, alerts = 0) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {alerts > 0 && (
        <span className="rounded-full bg-destructive px-1.5 text-xs text-white" aria-label={`${alerts} need your input`}>{alerts}</span>
      )}
    </Link>
  );
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 text-sm">
      <p className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">Projects</p>
      {projects.length === 0 && <p className="px-2 text-muted-foreground">No projects yet</p>}
      {projects.map((p) =>
        item(
          p.needsInput ? `/projects/${p.id}/inbox` : `/projects/${p.id}`,
          p.name,
          <ProjectIcon id={p.id} />,
          path.startsWith(`/projects/${p.id}`),
          p.needsInput,
        ),
      )}
      <p className="mt-4 px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">Workspace</p>
      {item('/agents', 'Agents', <Bot aria-hidden className="size-4 shrink-0 text-[#26b5ce]" />, path.startsWith('/agents'))}
      {item('/settings', 'Settings', <Settings aria-hidden className="size-4 shrink-0 text-muted-foreground" />, path === '/settings')}
    </nav>
  );
}
