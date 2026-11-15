import { Kanban, Pencil, Trash2 } from 'lucide-react';
import { requireOwner } from '@/server/auth';
import { orNotFound } from '@/server/actions';
import { getProject } from '@/server/projects';
import { listInbox } from '@/server/inbox';
import { ActionMenu } from '@/components/action-menu';
import { Field } from '@/components/field';
import { ProjectIcon } from '@/lib/visual';
import { createBoardAction, deleteProjectAction, renameProjectAction } from '../actions';
import { ProjectTabs } from './project-tabs';

export default async function ProjectLayout({ children, params }: LayoutProps<'/projects/[projectId]'>) {
  const { projectId } = await params;
  const owner = await requireOwner();
  const project = await orNotFound(getProject(owner, projectId));
  const needsInput = (await listInbox(owner, [project.id])).length;
  const boards = project.boards.length;
  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ProjectIcon id={project.id} className="size-6" />
          {project.name}
        </h1>
        {/* Secondary project actions live behind ⋯ (D-33). */}
        <ActionMenu
          label="Project actions"
          items={[
            {
              label: 'Add board', icon: <Kanban />, title: 'Add a board', submitLabel: 'Add board', action: createBoardAction,
              body: <><input type="hidden" name="projectId" value={project.id} /><Field name="name" label="Board name" /></>,
            },
            {
              label: 'Rename project', icon: <Pencil />, title: 'Rename project', submitLabel: 'Save', action: renameProjectAction,
              body: <><input type="hidden" name="projectId" value={project.id} /><Field name="name" label="Project name" defaultValue={project.name} /></>,
            },
            {
              label: 'Delete project', icon: <Trash2 />, title: `Delete ${project.name}?`, submitLabel: 'Delete', destructive: true,
              action: deleteProjectAction,
              body: (
                <div className="grid gap-2 text-sm">
                  <input type="hidden" name="projectId" value={project.id} />
                  <p>
                    Deletes <strong>{project.name}</strong> with {boards === 1 ? 'its board' : `all ${boards} boards`}, every task on{' '}
                    {boards === 1 ? 'it' : 'them'}, and their results, handoffs, blockers and history.
                  </p>
                  <p className="text-muted-foreground">Agents lose access to this project. The agents themselves stay connected.</p>
                </div>
              ),
            },
          ]}
        />
      </header>
      <div className="border-b pb-2">
        <ProjectTabs projectId={project.id} boards={project.boards} needsInput={needsInput} />
      </div>
      {children}
    </div>
  );
}
