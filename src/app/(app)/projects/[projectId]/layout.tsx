import { requireOwner } from '@/server/auth';
import { orNotFound } from '@/server/actions';
import { getProject } from '@/server/projects';
import { listInbox } from '@/server/inbox';
import { FormDialog } from '@/components/form-dialog';
import { Field } from '@/components/field';
import { createBoardAction, deleteProjectAction, renameProjectAction } from '../actions';
import { ConfirmDelete } from '@/components/confirm-delete';
import { ProjectTabs } from './project-tabs';

export default async function ProjectLayout({ children, params }: LayoutProps<'/projects/[projectId]'>) {
  const { projectId } = await params;
  const owner = await requireOwner();
  const project = await orNotFound(getProject(owner, projectId));
  const needsInput = (await listInbox(owner, [project.id])).length;
  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <FormDialog trigger="Rename project" title="Rename project" submitLabel="Save" action={renameProjectAction} variant="ghost">
          <input type="hidden" name="projectId" value={project.id} />
          <Field name="name" label="Project name" defaultValue={project.name} />
        </FormDialog>
        <ConfirmDelete trigger="Delete project" title={`Delete ${project.name}?`} action={deleteProjectAction} fields={{ projectId: project.id }}>
          <p>
            Deletes <strong>{project.name}</strong> with {project.boards.length === 1 ? 'its board' : `all ${project.boards.length} boards`}, every task on {project.boards.length === 1 ? 'it' : 'them'},
            and their results, handoffs, blockers and history.
          </p>
          <p className="text-muted-foreground">Agents lose access to this project. The agents themselves stay connected.</p>
        </ConfirmDelete>
      </header>
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        <ProjectTabs projectId={project.id} boards={project.boards} needsInput={needsInput} />
        <FormDialog trigger="+ Board" title="Add a board" submitLabel="Add board" action={createBoardAction} variant="ghost">
          <input type="hidden" name="projectId" value={project.id} />
          <Field name="name" label="Board name" />
        </FormDialog>
      </div>
      {children}
    </div>
  );
}
