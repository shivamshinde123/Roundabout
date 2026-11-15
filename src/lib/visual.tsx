// Small visual identity helpers (Docs/design-system.md, D-31, D-32): project, status and event icons, agent avatars.
import {
  ArrowRight, ArrowRightLeft, Bird, Bot, Circle, CircleCheck, CircleDashed, CircleDot, CircleX, Compass, Contrast, Dot,
  Feather, FileCheck2, Flame, Gem, Handshake, Kanban, Leaf, MessageSquare, Mountain, OctagonAlert, Palette, Pencil, Play,
  Plus, Rocket, RotateCcw, ShieldCheck, Sparkles, Target, Trash2, UserPlus, Users, Zap, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskStatus } from '@/server/tasks';

const PROJECT_ICONS: LucideIcon[] = [Rocket, Zap, Flame, Leaf, Sparkles, Target, Compass, Gem, Palette, Mountain, Feather, Bird];
// Bright enough to read on the dark shell; each is a Linear-like accent.
const PROJECT_COLORS = ['#5e6ad2', '#f2c94c', '#eb5757', '#4cb782', '#26b5ce', '#f2994a', '#bb87fc', '#e879a6'];

/** Stable 32-bit hash so a project keeps its icon and colour forever without storing them. */
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function ProjectIcon({ id, className }: { id: string; className?: string }) {
  const h = hash(id);
  const Icon = PROJECT_ICONS[h % PROJECT_ICONS.length];
  return <Icon aria-hidden className={cn('size-4 shrink-0', className)} style={{ color: PROJECT_COLORS[(h >> 4) % PROJECT_COLORS.length] }} />;
}

const STATUS: Record<TaskStatus, { Icon: LucideIcon; color: string }> = {
  backlog: { Icon: CircleDashed, color: '#8d8d95' },
  todo: { Icon: Circle, color: '#c4c4cc' },
  in_progress: { Icon: Contrast, color: '#f2c94c' },
  review: { Icon: CircleDot, color: '#4cb782' },
  done: { Icon: CircleCheck, color: '#5e6ad2' },
};

export function StatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  const { Icon, color } = STATUS[status];
  return <Icon aria-hidden className={cn('size-4 shrink-0', className)} style={{ color }} />;
}

const AGENT_COLORS: Record<string, string> = { claude_code: '#d97757', codex: '#10a37f', other: '#5e6ad2' };

/** Round avatar with the agent's initial, coloured by client (Claude Code orange, Codex green). */
export function AgentAvatar({ name, client, className }: { name: string; client?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white', className)}
      style={{ background: AGENT_COLORS[client ?? 'other'] ?? AGENT_COLORS.other }}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

const EVENT_ICONS: Record<string, { Icon: LucideIcon; color: string }> = {
  'result.submitted': { Icon: FileCheck2, color: '#26b5ce' },
  'review.approved': { Icon: CircleCheck, color: '#4cb782' },
  'review.changes_requested': { Icon: RotateCcw, color: '#f2994a' },
  'task.completed': { Icon: CircleCheck, color: '#5e6ad2' },
  'handoff.proposed': { Icon: ArrowRightLeft, color: '#bb87fc' },
  'handoff.accepted': { Icon: Handshake, color: '#4cb782' },
  'handoff.declined': { Icon: CircleX, color: '#eb5757' },
  'handoff.cancelled': { Icon: CircleX, color: '#8d8d95' },
  'handoff.superseded': { Icon: CircleX, color: '#8d8d95' },
  'blocker.reported': { Icon: OctagonAlert, color: '#eb5757' },
  'blocker.resolved': { Icon: ShieldCheck, color: '#4cb782' },
  'task.created': { Icon: Plus, color: '#8d8d95' },
  'task.accepted': { Icon: Play, color: '#f2c94c' },
  'task.assigned': { Icon: UserPlus, color: '#8d8d95' },
  'task.reassigned': { Icon: Users, color: '#f2994a' },
  'task.reopened': { Icon: RotateCcw, color: '#f2994a' },
  'task.status_changed': { Icon: ArrowRight, color: '#8d8d95' },
  'task.moved_board': { Icon: Kanban, color: '#8d8d95' },
  'task.edited': { Icon: Pencil, color: '#8d8d95' },
  'message.posted': { Icon: MessageSquare, color: '#8d8d95' },
};

/** Small round marker for an activity event, coloured by what happened. */
export function EventIcon({ type }: { type: string }) {
  const { Icon, color } = EVENT_ICONS[type]
    ?? (type.endsWith('.deleted') ? { Icon: Trash2, color: '#eb5757' } : type.startsWith('agent.') ? { Icon: Bot, color: '#26b5ce' } : { Icon: Dot, color: '#8d8d95' });
  return (
    <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-card">
      <Icon className="size-3.5" style={{ color }} />
    </span>
  );
}
