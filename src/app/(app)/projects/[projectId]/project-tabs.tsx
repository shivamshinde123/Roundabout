'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const tabClass = (active: boolean) => cn('rounded px-3 py-1.5 hover:bg-muted', active && 'bg-muted font-medium');

export function ProjectTabs({
  projectId, boards, needsInput,
}: { projectId: string; boards: { id: string; name: string }[]; needsInput: number }) {
  const path = usePathname();
  const base = `/projects/${projectId}`;
  const current = boards.find((b) => path === `${base}/boards/${b.id}`);
  const tab = (href: string, label: string, alert = false) => (
    <Link href={href} aria-current={path === href ? 'page' : undefined} className={cn(tabClass(path === href), alert && 'text-destructive')}>
      {label}
    </Link>
  );
  return (
    <nav aria-label="Project views" className="flex flex-wrap items-center gap-1 text-sm">
      {tab(base, 'Overview')}
      {tab(`${base}/inbox`, `Needs your input${needsInput ? ` (${needsInput})` : ''}`, needsInput > 0)}
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(tabClass(Boolean(current)), 'inline-flex items-center gap-1')}>
          {current ? `Board: ${current.name}` : `Boards (${boards.length})`}
          <ChevronDown aria-hidden className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48">
          <DropdownMenuLabel>Boards</DropdownMenuLabel>
          {boards.map((b) => (
            <DropdownMenuItem key={b.id} asChild>
              <Link
                href={`${base}/boards/${b.id}`}
                aria-current={current?.id === b.id ? 'page' : undefined}
                className={cn('justify-between gap-4', current?.id === b.id && 'font-medium')}
              >
                {b.name}
                {current?.id === b.id && <Check aria-hidden className="size-4" />}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {tab(`${base}/activity`, 'Activity')}
    </nav>
  );
}
