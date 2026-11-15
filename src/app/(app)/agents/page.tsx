import Link from 'next/link';
import { deleteAgentItem } from './delete-agent';
import { ActionMenu } from '@/components/action-menu';
import { Settings2 } from 'lucide-react';
import { AgentAvatar } from '@/lib/visual';
import { requireOwner } from '@/server/auth';
import { listAgents } from '@/server/agents';
import { Button } from '@/components/ui/button';
import { CLIENT_LABELS, type AgentClient } from '@/lib/agent-setup';
import { ago } from '@/lib/time';
import { AgentStatus } from './status';

export default async function AgentsPage() {
  const agents = await listAgents(await requireOwner());
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Agents</h1>
        <Button asChild>
          <Link href="/agents/new">Connect agent</Link>
        </Button>
      </header>
      {agents.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Connect Claude Code or Codex to start assigning work.
        </p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground [&_th]:py-2 [&_th]:pr-4 [&_th]:font-medium">
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Projects</th>
              <th>Last check</th>
              <th>Work</th>
              <th className="w-10"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id} className="border-t align-middle [&>td]:py-3 [&>td]:pr-4 [&>td]:whitespace-nowrap">
                <td>
                  <Link href={`/agents/${a.id}`} className="flex items-center gap-2.5 hover:underline">
                    <AgentAvatar name={a.name} client={a.client} className="size-7 text-xs" />
                    <span className="grid leading-tight">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-xs text-muted-foreground">{CLIENT_LABELS[a.client as AgentClient] ?? a.client}</span>
                    </span>
                  </Link>
                </td>
                <td>
                  <AgentStatus status={a.status} />
                  {a.lastError && <p className="mt-1 text-xs text-destructive">{a.lastError}</p>}
                </td>
                <td>{a.projects.map((p) => p.name).join(', ') || <span className="text-muted-foreground">None</span>}</td>
                <td>{a.lastContactAt ? ago(a.lastContactAt) : <span className="text-muted-foreground">Never</span>}</td>
                <td className="text-muted-foreground">{a.waiting} waiting · {a.inProgress} in progress</td>
                <td className="text-right">
                  <ActionMenu
                    label={`Actions for ${a.name}`}
                    items={[{ label: 'Manage', icon: <Settings2 />, href: `/agents/${a.id}` }, deleteAgentItem(a)]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
