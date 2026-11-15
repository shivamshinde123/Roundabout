import Link from 'next/link';
import { requireOwner } from '@/server/auth';
import { orNotFound } from '@/server/actions';
import { listActivity } from '@/server/activity';
import { getProject } from '@/server/projects';
import { listAssignableAgents } from '@/server/tasks';
import { ActivityFeed } from '@/components/activity-feed';

export default async function ActivityPage({ params, searchParams }: PageProps<'/projects/[projectId]/activity'>) {
  const { projectId } = await params;
  const { agent, handoffs } = await searchParams;
  const owner = await requireOwner();
  const project = await orNotFound(getProject(owner, projectId));
  const agentId = typeof agent === 'string' ? agent : undefined;
  const handoffsOnly = handoffs === '1';
  const [events, agents] = await Promise.all([
    listActivity(owner, project.id, { agentId, handoffsOnly }),
    listAssignableAgents(owner, project.id),
  ]);
  const base = `/projects/${project.id}/activity`;
  const filtered = Boolean(agentId || handoffsOnly);

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-medium">Activity</h2>
      {/* Plain GET form: filters live in the URL, so they survive refresh and back/forward (diagram 15, step 04). */}
      <form className="flex flex-wrap items-end gap-3 text-sm" action={base}>
        <label className="grid gap-1">
          <span>Agent</span>
          <select name="agent" defaultValue={agentId ?? ''} className="h-9 rounded-md border border-input bg-transparent px-2">
            <option value="">All</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="flex h-9 items-center gap-2">
          <input type="checkbox" name="handoffs" value="1" defaultChecked={handoffsOnly} className="size-4 accent-primary" /> Handoffs only
        </label>
        <button type="submit" className="h-9 rounded-md border px-3 hover:bg-muted">Apply</button>
        {filtered && <Link href={base} className="h-9 content-center underline">Reset filters</Link>}
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
