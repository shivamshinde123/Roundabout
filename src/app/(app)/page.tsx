import { redirect } from 'next/navigation';
import { requireOwner } from '@/server/auth';
import { listProjects } from '@/server/projects';
import { NewProjectButton } from './projects/new-project';

export default async function HomePage() {
  const [first] = await listProjects(await requireOwner());
  if (first) redirect(`/projects/${first.id}`);
  return (
    <section className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-2xl font-semibold">Create your first project</h1>
      <p className="mt-2 mb-6 text-muted-foreground">
        A project holds boards of tasks that you assign to your agents.
      </p>
      <NewProjectButton variant="default" />
    </section>
  );
}
