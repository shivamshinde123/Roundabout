'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Check, ChevronDown, Inbox, Kanban, LayoutGrid, type LucideIcon } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const tabClass = (active: boolean) => cn('rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground', active && 'bg-accent font-medium text-foreground');

export function ProjectTabs({
  projectId, boards, needsInput,
}: { projectId: string; boards: { id: string; name: string }[]; needsInput: number }) {
  const path = usePathname();
  const base = `/projects/${projectId}`;
  const current = boards.find((b) => path === `${base}/boards/${b.id}`);
  const tab = (href: string, label: string, Icon: LucideIcon, alert = false) => (
    <Link
      href={href}
      aria-current={path === href ? 'page' : undefined}
      className={cn(tabClass(path === href), 'inline-flex items-center gap-1.5', alert && 'text-destructive')}
    >
      <Icon aria-hidden className="size-3.5 opacity-80" />
      {label}
    </Link>
  );
  return (
    <nav aria-label="Project views" className="flex flex-wrap items-center gap-1 text-sm">
      {tab(base, 'Overview', LayoutGrid)}
      {tab(`${base}/inbox`, `Needs your input${needsInput ? ` (${needsInput})` : ''}`, Inbox, needsInput > 0)}
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(tabClass(Boolean(current)), 'inline-flex items-center gap-1.5')}>
          <Kanban aria-hidden className="size-3.5 opacity-80" />
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
      {tab(`${base}/activity`, 'Activity', Activity)}
    </nav>
  );
}
