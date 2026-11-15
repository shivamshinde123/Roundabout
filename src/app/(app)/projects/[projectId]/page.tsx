import Link from 'next/link';
import { Kanban } from 'lucide-react';
import { requireOwner } from '@/server/auth';
import { orNotFound } from '@/server/actions';
import { listActivity, stageCounts } from '@/server/activity';
import { listAgents } from '@/server/agents';
import { listInbox } from '@/server/inbox';
import { getProject } from '@/server/projects';
import { AutoRefresh } from '@/components/board/auto-refresh';
import { InboxList } from '@/components/inbox-list';
import { AgentStatus } from '../../agents/status';
import { ActivityFeed } from '@/components/activity-feed';
import { ago } from '@/lib/time';
import { AgentAvatar, StatusIcon } from '@/lib/visual';

const STAGES = [['backlog', 'Backlog'], ['todo', 'To Do'], ['in_progress', 'In Progress'], ['review', 'Review'], ['done', 'Done']] as const;
const HIGHLIGHTS = ['result.submitted', 'review.approved', 'review.changes_requested', 'task.completed', 'handoff.proposed', 'handoff.accepted', 'handoff.declined'];

/** One project overview (O1): stages across boards, what needs you, agents, recent results and handoffs. */
export default async function ProjectOverviewPage({ params }: PageProps<'/projects/[projectId]'>) {
  const { projectId } = await params;
  const owner = await requireOwner();
  const project = await orNotFound(getProject(owner, projectId));
  const [counts, inbox, agents, recent] = await Promise.all([
    stageCounts(owner, project.id),
    listInbox(owner, [project.id]),
    listAgents(owner),
    listActivity(owner, project.id, { types: HIGHLIGHTS, limit: 8 }),
  ]);
  const projectAgents = agents.filter((a) => a.status !== 'revoked' && a.projects.some((p) => p.id === project.id));

  return (
    <div className="grid gap-6">
      <AutoRefresh />
      <section aria-label="Tasks by stage" className="flex flex-wrap gap-2">
        {STAGES.map(([key, label]) => (
          <div key={key} className="min-w-28 rounded-lg border bg-card px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><StatusIcon status={key} className="size-3.5" />{label}</div>
            <div className="text-xl font-semibold">{counts[key]}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Needs your input ({inbox.length})</h2>
          {inbox.length > 3 && <Link className="text-sm underline" href={`/projects/${project.id}/inbox`}>View all</Link>}
        </div>
        <InboxList items={inbox} limit={3} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="grid content-start gap-2">
          <h2 className="text-lg font-medium">Agents</h2>
          {projectAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No agents can use this project yet. <Link className="underline" href="/agents/new">Connect an agent</Link>.
            </p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {projectAgents.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
                  <AgentAvatar name={a.name} client={a.client} />
                  <Link href={`/agents/${a.id}`} className="font-medium hover:underline">{a.name}</Link>
                  <AgentStatus status={a.status} />
                  <span className="text-muted-foreground">
                    last check {a.lastContactAt ? ago(a.lastContactAt) : 'never'} · {a.inProgress} in progress · {a.waiting} waiting
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid content-start gap-3 rounded-xl border bg-card/40 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Recent results and handoffs</h2>
            <Link className="text-sm underline" href={`/projects/${project.id}/activity`}>All activity</Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ActivityFeed items={recent} projectId={project.id} />
          )}
        </section>
      </div>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Boards</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {project.boards.map((b) => (
            <li key={b.id}>
              <Link href={`/projects/${project.id}/boards/${b.id}`} className="flex items-center gap-2 rounded-lg border bg-card p-4 hover:border-[#3a3a40]"><Kanban aria-hidden className="size-4 text-muted-foreground" />{b.name}</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
