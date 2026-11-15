import Link from 'next/link';
import { DeleteAgent } from './delete-agent';
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
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2">Name</th>
              <th>Status</th>
              <th>Projects</th>
              <th>Last successful check</th>
              <th>Work</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id} className="border-t align-top">
                <td className="py-3">
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{CLIENT_LABELS[a.client as AgentClient] ?? a.client}</div>
                </td>
                <td className="py-3">
                  <AgentStatus status={a.status} />
                  {a.lastError && <p className="mt-1 text-xs text-destructive">{a.lastError}</p>}
                </td>
                <td className="py-3">{a.projects.map((p) => p.name).join(', ') || <span className="text-muted-foreground">None</span>}</td>
                <td className="py-3">{a.lastContactAt ? ago(a.lastContactAt) : <span className="text-muted-foreground">Never</span>}</td>
                <td className="py-3">{a.waiting} waiting · {a.inProgress} in progress</td>
                <td className="py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link className="underline" href={`/agents/${a.id}`}>
                      Manage<span className="sr-only"> {a.name}</span>
                    </Link>
                    <DeleteAgent agent={a} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
