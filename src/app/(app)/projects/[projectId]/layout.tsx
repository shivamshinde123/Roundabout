import { requireOwner } from '@/server/auth';
import { orNotFound } from '@/server/actions';
import { getProject } from '@/server/projects';
import { FormDialog } from '@/components/form-dialog';
import { Field } from '@/components/field';
import { createBoardAction, renameProjectAction } from '../actions';
import { ProjectTabs } from './project-tabs';

export default async function ProjectLayout({ children, params }: LayoutProps<'/projects/[projectId]'>) {
  const { projectId } = await params;
  const project = await orNotFound(getProject(await requireOwner(), projectId));
  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <FormDialog trigger="Rename project" title="Rename project" submitLabel="Save" action={renameProjectAction} variant="ghost">
          <input type="hidden" name="projectId" value={project.id} />
          <Field name="name" label="Project name" defaultValue={project.name} />
        </FormDialog>
      </header>
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        <ProjectTabs projectId={project.id} boards={project.boards} />
        <FormDialog trigger="+ Board" title="Add a board" submitLabel="Add board" action={createBoardAction} variant="ghost">
          <input type="hidden" name="projectId" value={project.id} />
          <Field name="name" label="Board name" />
        </FormDialog>
      </div>
      {children}
    </div>
  );
}
