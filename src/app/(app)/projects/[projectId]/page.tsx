import Link from 'next/link';
import { requireOwner } from '@/server/auth';
import { orNotFound } from '@/server/actions';
import { getProject } from '@/server/projects';

// Full overview (counts, needs your input, activity) arrives in stage 10.
export default async function ProjectOverviewPage({ params }: PageProps<'/projects/[projectId]'>) {
  const { projectId } = await params;
  const project = await orNotFound(getProject(await requireOwner(), projectId));
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-medium">Boards</h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {project.boards.map((b) => (
          <li key={b.id}>
            <Link href={`/projects/${project.id}/boards/${b.id}`} className="block rounded-lg border p-4 hover:bg-muted">
              {b.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
