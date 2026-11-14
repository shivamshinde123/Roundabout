'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function ProjectTabs({ projectId, boards }: { projectId: string; boards: { id: string; name: string }[] }) {
  const path = usePathname();
  const tabs = [{ href: `/projects/${projectId}`, label: 'Overview' }, ...boards.map((b) => ({ href: `/projects/${projectId}/boards/${b.id}`, label: b.name }))];
  return (
    <nav aria-label="Project views" className="flex flex-wrap gap-1 text-sm">
      {tabs.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={cn('rounded px-3 py-1.5 hover:bg-muted', active && 'bg-muted font-medium')}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
