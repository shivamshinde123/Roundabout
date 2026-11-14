import { Badge } from '@/components/ui/badge';
import type { TaskCard } from '@/server/tasks';

const text: Record<TaskCard['badges'][number], string> = {
  waiting_for_pickup: 'Waiting for pickup',
  handoff_pending: 'Handoff pending',
  blocked: 'Blocked',
  stalled: 'Stalled',
  agent_no_access: "Agent can't access",
};
const tone: Record<TaskCard['badges'][number], 'secondary' | 'destructive' | 'outline'> = {
  waiting_for_pickup: 'secondary',
  handoff_pending: 'outline',
  blocked: 'destructive',
  stalled: 'outline',
  agent_no_access: 'destructive',
};

/** Status is always a text label; colour only supplements it (ui-ux-wireframes.md). */
export function TaskBadges({ task }: { task: Pick<TaskCard, 'badges' | 'handoffTo'> }) {
  if (task.badges.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Status">
      {task.badges.map((b) => (
        <li key={b}>
          <Badge variant={tone[b]}>{b === 'handoff_pending' && task.handoffTo ? `Handoff → ${task.handoffTo}` : text[b]}</Badge>
        </li>
      ))}
    </ul>
  );
}
