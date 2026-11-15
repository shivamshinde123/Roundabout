// Small visual identity helpers (Docs/design-system.md, D-31): per-project icons, status icons, agent avatars.
import {
  Bird, Circle, CircleCheck, CircleDashed, CircleDot, Compass, Contrast, Feather, Flame, Gem, Leaf, Mountain, Palette,
  Rocket, Sparkles, Target, Zap, type LucideIcon,
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
