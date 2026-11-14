import { notFound } from 'next/navigation';
import { requireOwner } from '@/server/auth';
import { orNotFound } from '@/server/actions';
import { getProject } from '@/server/projects';
import { FormDialog } from '@/components/form-dialog';
import { Field } from '@/components/field';
import { renameBoardAction } from '../../../actions';

export default async function BoardPage({ params }: PageProps<'/projects/[projectId]/boards/[boardId]'>) {
  const { projectId, boardId } = await params;
  const project = await orNotFound(getProject(await requireOwner(), projectId));
  const board = project.boards.find((b) => b.id === boardId); // also rejects malformed ids
  if (!board) notFound();
  return (
    <section className="grid gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-medium">{board.name}</h2>
        <FormDialog trigger="Rename board" title="Rename board" submitLabel="Save" action={renameBoardAction} variant="ghost">
          <input type="hidden" name="boardId" value={board.id} />
          <Field name="name" label="Board name" defaultValue={board.name} />
        </FormDialog>
      </div>
      <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">No tasks yet.</p>
    </section>
  );
}
