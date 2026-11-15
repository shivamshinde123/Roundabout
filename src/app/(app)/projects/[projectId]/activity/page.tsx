import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { requireOwner } from '@/server/auth';
import { orNotFound } from '@/server/actions';
import { ACTIVITY_KINDS, listActivity, type ActivityKind } from '@/server/activity';
import { listAgents } from '@/server/agents';
import { getProject } from '@/server/projects';
import { ActivityFeed } from '@/components/activity-feed';

const LIMIT = 200;
const field = 'h-8 rounded-md border border-input bg-card px-2 text-sm text-foreground';
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Project activity with filters (D-37). Plain GET form: filters live in the URL, so they survive refresh and back/forward. */
export default async function ActivityPage({ params, searchParams }: PageProps<'/projects/[projectId]/activity'>) {
  const { projectId } = await params;
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' && sp[k] ? (sp[k] as string) : undefined);
  const owner = await requireOwner();
  const project = await orNotFound(getProject(owner, projectId));
  const filter = {
    agentId: str('who'),
    kind: (str('kind') && str('kind')! in ACTIVITY_KINDS ? str('kind') : undefined) as ActivityKind | undefined,
    // Older links used ?handoffs=1 (D-22).
    handoffsOnly: str('handoffs') === '1',
    boardId: str('board'),
    from: str('from'),
    to: str('to'),
    q: str('q'),
  };
  const [events, agents] = await Promise.all([
    listActivity(owner, project.id, { ...filter, limit: LIMIT }),
    listAgents(owner),
  ]);
  const projectAgents = agents.filter((a) => a.projects.some((p) => p.id === project.id) || a.status === 'revoked');
  const base = `/projects/${project.id}/activity`;
  const filtered = Object.values(filter).some(Boolean);
  const today = new Date();
  const preset = (label: string, days: number) => {
    const from = new Date(today.getTime() - days * 86_400_000);
    const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(filter).filter(([, v]) => typeof v === 'string')), from: isoDay(from), to: isoDay(today) });
    return <Link key={label} href={`${base}?${q}`} className="rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground hover:border-[#3a3a40] hover:text-foreground">{label}</Link>;
  };

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-medium">Activity</h2>
      <form className="grid gap-3 rounded-xl border bg-card/40 p-3 text-sm" action={base}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">From</span>
            <input type="date" name="from" defaultValue={filter.from} max={isoDay(today)} className={field} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">To</span>
            <input type="date" name="to" defaultValue={filter.to} max={isoDay(today)} className={field} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">What</span>
            <select name="kind" defaultValue={filter.kind ?? (filter.handoffsOnly ? 'handoffs' : '')} className={field}>
              <option value="">Everything</option>
              {Object.entries(ACTIVITY_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Who</span>
            <select name="who" defaultValue={filter.agentId ?? ''} className={field}>
              <option value="">Anyone</option>
              <option value="owner">You</option>
              {projectAgents.map((a) => <option key={a.id} value={a.id}>{a.name}{a.status === 'revoked' ? ' (disconnected)' : ''}</option>)}
            </select>
          </label>
          {project.boards.length > 1 && (
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Board</span>
              <select name="board" defaultValue={filter.boardId ?? ''} className={field}>
                <option value="">All boards</option>
                {project.boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}
          <label className="grid min-w-40 flex-1 gap-1">
            <span className="text-xs text-muted-foreground">Task title</span>
            <input type="search" name="q" defaultValue={filter.q} placeholder="Search tasks" className={field} />
          </label>
          <button type="submit" className="h-8 rounded-md bg-primary px-3 text-primary-foreground hover:bg-primary/85">Apply</button>
          {filtered && <Button asChild variant="ghost" size="sm" className="h-8"><Link href={base}>Reset</Link></Button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Quick ranges:</span>
          {preset('Today', 0)}
          {preset('Last 7 days', 7)}
          {preset('Last 30 days', 30)}
          <span className="ml-auto text-xs text-muted-foreground">
            {events.length === LIMIT ? `Showing the latest ${LIMIT} events` : `${events.length} ${events.length === 1 ? 'event' : 'events'}`}
            {filter.from || filter.to ? ' · dates in UTC' : ''}
          </span>
        </div>
      </form>
      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          {filtered ? 'Nothing matches these filters.' : 'No activity yet.'}
        </p>
      ) : (
        <div className="rounded-xl border bg-card/40 p-4"><ActivityFeed items={events} projectId={project.id} /></div>
      )}
    </section>
  );
}
