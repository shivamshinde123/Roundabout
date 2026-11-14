'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function ProjectTabs({
  projectId, boards, needsInput,
}: { projectId: string; boards: { id: string; name: string }[]; needsInput: number }) {
  const path = usePathname();
  const base = `/projects/${projectId}`;
  const tabs = [
    { href: base, label: 'Overview' },
    { href: `${base}/inbox`, label: `Needs your input${needsInput ? ` (${needsInput})` : ''}`, alert: needsInput > 0 },
    ...boards.map((b) => ({ href: `${base}/boards/${b.id}`, label: b.name })),
    { href: `${base}/activity`, label: 'Activity' },
  ];
  return (
    <nav aria-label="Project views" className="flex flex-wrap gap-1 text-sm">
      {tabs.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={cn('rounded px-3 py-1.5 hover:bg-muted', active && 'bg-muted font-medium', 'alert' in t && t.alert && 'text-destructive')}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
