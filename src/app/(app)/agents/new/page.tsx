import Link from 'next/link';
import { requireOwner } from '@/server/auth';
import { listProjects } from '@/server/projects';
import { ConnectAgentForm } from '@/components/agents/connect-form';

export default async function ConnectAgentPage() {
  const projects = await listProjects(await requireOwner());
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <Link href="/agents" className="text-sm underline">← Agents</Link>
      <h1 className="text-2xl font-semibold">Connect agent</h1>
      <ConnectAgentForm projects={projects.map(({ id, name }) => ({ id, name }))} />
    </div>
  );
}
