'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useId, useState, useTransition, type ReactNode } from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { GripVertical, MoreHorizontal, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { approveResultAction, moveTaskStatusAction } from '@/app/(app)/tasks/actions';
import type { TaskCard, TaskStatus } from '@/server/tasks';
import { TaskBadges } from './badges';
import { RequestChangesDialog } from './review';

export const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' },
];

/** Board moves the owner can make by dragging or the Move menu (technical-design-document.md §3). */
export function ownerMoves(task: Pick<TaskCard, 'status' | 'pendingResultId'>): TaskStatus[] {
  if (task.status === 'backlog') return ['todo'];
  if (task.status === 'todo') return ['backlog'];
  // Review → Done approves; Review → In Progress requests changes (opens a comment dialog).
  if (task.status === 'review' && task.pendingResultId) return ['done', 'in_progress'];
  return [];
}

/** Menu wording for each board move. */
export function moveLabel(task: Pick<TaskCard, 'status'>, to: TaskStatus): string {
  if (task.status === 'review') return to === 'done' ? 'Approve' : 'Request changes…';
  return `Move to ${COLUMNS.find((c) => c.status === to)!.label}`;
}

const labelOf = (s: TaskStatus) => COLUMNS.find((c) => c.status === s)!.label;

export function Board({ tasks, newTask }: { tasks: TaskCard[]; newTask: ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const dndId = useId(); // stable ids avoid a server/client aria-describedby mismatch
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const [changesFor, setChangesFor] = useState<TaskCard | null>(null);

  const move = (task: TaskCard, to: TaskStatus) => {
    if (task.status === to) return;
    if (!ownerMoves(task).includes(to)) {
      toast.error(`Can't move from ${labelOf(task.status)} to ${labelOf(to)}. Use the task's actions instead.`);
      return;
    }
    if (task.status === 'review' && to === 'in_progress') {
      setChangesFor(task);
      return;
    }
    startTransition(async () => {
      const res = task.status === 'review'
        ? await approveResultAction({ resultId: task.pendingResultId!, expectedRevision: task.revision })
        : await moveTaskStatusAction({ taskId: task.id, expectedRevision: task.revision, to });
      if (!res.ok) toast.error(res.error);
      else if (task.status === 'review') toast.success(`Approved “${task.title}”.`);
      router.refresh();
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const task = tasks.find((t) => t.id === active.id);
    if (task && over) move(task, over.id as TaskStatus);
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${tasks.find((t) => t.id === active.id)?.title}.`,
          onDragOver: ({ over }) => (over ? `Over ${labelOf(over.id as TaskStatus)}.` : 'Not over a column.'),
          onDragEnd: ({ over }) => (over ? `Dropped in ${labelOf(over.id as TaskStatus)}.` : 'Dropped.'),
          onDragCancel: () => 'Move cancelled.',
        },
      }}
    >
      <div className="grid min-w-[900px] grid-cols-5 gap-3">
        {COLUMNS.map((col) => (
          <Column key={col.status} status={col.status} label={col.label} count={tasks.filter((t) => t.status === col.status).length}>
            {col.status === 'backlog' && newTask}
            {tasks.filter((t) => t.status === col.status).map((t) => (
              <Card key={t.id} task={t} onMove={(to) => move(t, to)} />
            ))}
          </Column>
        ))}
      </div>
      {changesFor && (
        <RequestChangesDialog
          open
          onOpenChange={(open) => !open && setChangesFor(null)}
          resultId={changesFor.pendingResultId!}
          revision={changesFor.revision}
          title={changesFor.title}
        />
      )}
    </DndContext>
  );
}

function Column({ status, label, count, children }: { status: TaskStatus; label: string; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${label}, ${count} ${count === 1 ? 'task' : 'tasks'}`}
      className={cn('flex min-h-64 flex-col gap-2 rounded-lg bg-muted/40 p-2', isOver && 'ring-2 ring-primary/40')}
    >
      <h3 className="flex items-center justify-between px-1 text-sm font-medium">
        {label} <span className="text-muted-foreground">{count}</span>
      </h3>
      {children}
      {count === 0 && status !== 'backlog' && <p className="px-1 text-xs text-muted-foreground">No tasks</p>}
    </section>
  );
}

function Card({ task, onMove }: { task: TaskCard; onMove: (to: TaskStatus) => void }) {
  const path = usePathname();
  const draggable = ownerMoves(task).length > 0;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: !draggable });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const detailLine =
    task.status === 'in_progress' && task.nextAction ? `Next: ${task.nextAction}`
      : (task.status === 'review' || task.status === 'done') && task.latestResult ? `Result: ${task.latestResult}`
        : null;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn('grid gap-2 rounded-md border bg-background p-3 text-sm shadow-xs', isDragging && 'z-10 opacity-80 shadow-lg')}
    >
      <div className="flex items-start gap-1">
        {draggable && (
          // Drag handle only, so Enter on the title link opens the task instead of starting a drag.
          <button
            ref={setActivatorNodeRef}
            type="button"
            className="-ml-1 mt-0.5 cursor-grab rounded text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            {...listeners}
            {...attributes}
            aria-roledescription="draggable task"
            aria-label={`Drag ${task.title}`}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        )}
        <Link href={`${path}?task=${task.id}`} scroll={false} className="line-clamp-2 flex-1 font-medium hover:underline" data-task-link={task.id}>
          {task.title}
        </Link>
        <MoveMenu task={task} onMove={onMove} />
      </div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {task.assignee ? task.assignee.name : 'Unassigned'}
        {task.requireReview && (
          <span title="Review required" className="inline-flex items-center">
            <ShieldCheck className="size-3.5" aria-hidden />
            <span className="sr-only">, review required</span>
          </span>
        )}
      </p>
      {detailLine && <p className="line-clamp-2 text-xs">{detailLine}</p>}
      {task.status === 'done' && task.completedBy && (
        <p className="text-xs text-muted-foreground">{task.requireReview ? 'Approved by' : 'Completed by'} {task.completedBy}</p>
      )}
      <TaskBadges task={task} />
    </article>
  );
}

function MoveMenu({ task, onMove }: { task: TaskCard; onMove: (to: TaskStatus) => void }) {
  const path = usePathname();
  const moves = ownerMoves(task);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${task.title}`}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`${path}?task=${task.id}`} scroll={false}>Open</Link>
        </DropdownMenuItem>
        {moves.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{task.status === 'review' ? 'Review' : 'Move'}</DropdownMenuLabel>
            {moves.map((to) => (
              <DropdownMenuItem key={to} onSelect={() => onMove(to)}>{moveLabel(task, to)}</DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
