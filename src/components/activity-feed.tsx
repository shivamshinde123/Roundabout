import Link from 'next/link';
import type { ActivityItem } from '@/server/activity';
import { describeEvent, eventDetail } from '@/lib/events';
import { AgentAvatar, EventIcon } from '@/lib/visual';
import { ago } from '@/lib/time';

const TARGETED = new Set(['handoff.proposed', 'task.assigned', 'task.reassigned']);

/**
 * Linear-style activity timeline (D-32): an event icon on a thin rail, who did what, the task as a chip,
 * an optional detail line (result summary, decline reason) and the time on the right.
 */
export function ActivityFeed({ items, projectId }: { items: ActivityItem[]; projectId: string }) {
  return (
    <ol className="relative grid">
      {items.map((e, i) => {
        const detail = eventDetail(e.type, e.data);
        const target = TARGETED.has(e.type) && e.targetName ? ` to ${e.targetName}` : '';
        return (
          <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < items.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-3 w-px bg-border" />}
            <EventIcon type={e.type} />
            <div className="grid min-w-0 flex-1 gap-1.5 pt-0.5">
              <div className="flex min-w-0 items-start justify-between gap-3 text-sm">
                <p className="min-w-0 leading-5">
                  <span className="inline-flex items-center gap-1.5 align-middle font-medium text-foreground">
                    {e.actor.kind === 'agent' && <AgentAvatar name={e.actor.name} client={e.actor.client ?? undefined} className="size-4 text-[9px]" />}
                    {e.actor.name}
                  </span>{' '}
                  <span className="text-muted-foreground">{describeEvent(e.type, e.data)}{target}</span>
                  {e.task && (
                    <>
                      {' '}
                      <Link
                        href={`/projects/${projectId}/boards/${e.task.boardId}?task=${e.task.id}`}
                        className="inline-block max-w-full truncate rounded-md border bg-muted px-1.5 align-middle text-xs leading-5 text-foreground hover:border-primary/60"
                      >
                        {e.task.title}
                      </Link>
                    </>
                  )}
                </p>
                <time
                  dateTime={e.createdAt.toISOString()}
                  title={e.createdAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                  className="shrink-0 text-xs leading-5 text-muted-foreground"
                >
                  {ago(e.createdAt)}
                </time>
              </div>
              {detail && (
                <p className="line-clamp-2 rounded-md border bg-card px-3 py-2 text-sm text-foreground">{detail}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
