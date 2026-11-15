import { redirect } from 'next/navigation';
import { requireOwner } from '@/server/auth';
import { listProjects } from '@/server/projects';
import { NewProjectButton } from './projects/new-project';

export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const { tour } = await searchParams;
  const [first] = await listProjects(await requireOwner());
  // Keep ?tour=1 so "Replay the tour" lands on the overview with the tour open (D-37).
  if (first) redirect(`/projects/${first.id}${tour === '1' ? '?tour=1' : ''}`);
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
