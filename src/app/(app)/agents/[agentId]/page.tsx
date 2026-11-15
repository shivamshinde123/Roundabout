import Link from 'next/link';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { requireOwner } from '@/server/auth';
import { orNotFound } from '@/server/actions';
import { getAgentProfile } from '@/server/agents';
import { listProjects } from '@/server/projects';
import { label } from '@/server/tasks';
import { ActionForm } from '@/components/action-form';
import { ActionMenu } from '@/components/action-menu';
import { RefreshCw, Unplug } from 'lucide-react';
import { AgentAvatar } from '@/lib/visual';
import { ReconnectForm } from '@/components/agents/connect-form';
import { CLIENT_LABELS, type AgentClient } from '@/lib/agent-setup';
import { ago } from '@/lib/time';
import { revokeAgentAction, updateGrantsAction } from '../actions';
import { AgentStatus } from '../status';
import { deleteAgentItem } from '../delete-agent';

export default async function AgentPage({ params }: PageProps<'/agents/[agentId]'>) {
  const { agentId } = await params;
  const owner = await requireOwner();
  const [agent, projects] = await Promise.all([orNotFound(getAgentProfile(owner, agentId)), listProjects(owner)]);
  const granted = new Set(agent.projects.map((p) => p.id));
  const revoked = agent.status === 'revoked';

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Breadcrumbs items={[{ label: 'Agents', href: '/agents' }, { label: agent.name }]} />
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <AgentAvatar name={agent.name} client={agent.client} className="size-7 text-xs" />
          <h1 className="text-2xl font-semibold">{agent.name}</h1>
          <AgentStatus status={agent.status} />
          <ActionMenu
            label={`Actions for ${agent.name}`}
            className="ml-auto"
            items={[
              ...(revoked ? [] : [
                {
                  label: 'Reconnect', icon: <RefreshCw />, title: `Reconnect ${agent.name}`,
                  content: <ReconnectForm agentId={agent.id} client={agent.client} />,
                },
                {
                  label: 'Disconnect', icon: <Unplug />, title: `Disconnect ${agent.name}?`, submitLabel: 'Disconnect', destructive: true,
                  action: revokeAgentAction,
                  body: (
                    <div className="grid gap-2 text-sm">
                      <input type="hidden" name="agentId" value={agent.id} />
                      <p>Its token stops working and it loses access to every project.</p>
                      <p className="text-muted-foreground">Its past work stays attributed to it, and tasks assigned to it stay on the board so you can reassign them.</p>
                    </div>
                  ),
                },
              ]),
              deleteAgentItem(agent),
            ]}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {CLIENT_LABELS[agent.client as AgentClient] ?? agent.client}
          {agent.tokenPrefix && !revoked && <> · token <code>{agent.tokenPrefix}…</code></>}
          {' · '}last successful check {agent.lastContactAt ? ago(agent.lastContactAt) : 'never'} (a recorded check, not live availability)
        </p>
        {agent.lastError && <p className="text-sm text-destructive">Last error: {agent.lastError}</p>}
      </header>

      {!revoked && (
        <section className="grid gap-3 rounded-lg border p-4">
          <h2 className="font-medium">Project access</h2>
          <ActionForm action={updateGrantsAction} submitLabel="Save access">
            <input type="hidden" name="agentId" value={agent.id} />
            <fieldset className="grid gap-2">
              <legend className="sr-only">Projects this agent may use</legend>
              {projects.length === 0 && <p className="text-sm text-muted-foreground">No projects yet.</p>}
              {projects.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="projectIds" value={p.id} defaultChecked={granted.has(p.id)} className="size-4 accent-primary" />
                  {p.name}
                </label>
              ))}
            </fieldset>
          </ActionForm>
        </section>
      )}

      <section className="grid gap-2">
        <h2 className="font-medium">Assigned work</h2>
        {agent.work.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing assigned right now.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {agent.work.map((t) => (
              <li key={t.id}>
                <Link className="underline" href={`/projects/${t.projectId}/boards/${t.boardId}?task=${t.id}`}>{t.title}</Link>
                <span className="text-muted-foreground"> · {t.status === 'todo' ? 'Waiting for pickup' : label(t.status)}</span>
                {revoked && <span className="text-destructive"> · needs reassignment</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="font-medium">Recent activity</h2>
        {agent.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ol className="grid gap-1 text-sm text-muted-foreground">
            {agent.events.map((e) => (
              <li key={e.id}>{ago(e.createdAt)} · {e.type}</li>
            ))}
          </ol>
        )}
      </section>

    </div>
  );
}
