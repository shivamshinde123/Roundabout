import { requireOwner } from '@/server/auth';
import { orNotFound } from '@/server/actions';
import { listInbox } from '@/server/inbox';
import { getProject } from '@/server/projects';
import { AutoRefresh } from '@/components/board/auto-refresh';
import { InboxList } from '@/components/inbox-list';

export default async function InboxPage({ params }: PageProps<'/projects/[projectId]/inbox'>) {
  const { projectId } = await params;
  const owner = await requireOwner();
  const project = await orNotFound(getProject(owner, projectId));
  const items = await listInbox(owner, [project.id]);
  return (
    <section className="grid gap-3">
      <AutoRefresh />
      <h2 className="text-lg font-medium">Needs your input <span className="text-muted-foreground">({items.length})</span></h2>
      <InboxList items={items} />
    </section>
  );
}
