import { notFound } from 'next/navigation';
import { requireOwner } from '@/server/auth';
import { orNotFound } from '@/server/actions';
import { getProject } from '@/server/projects';
import { getTaskDetail, listAssignableAgents, listBoardTasks } from '@/server/tasks';
import { listMessages } from '@/server/messages';
import { FormDialog } from '@/components/form-dialog';
import { Field } from '@/components/field';
import { AutoRefresh } from '@/components/board/auto-refresh';
import { Board } from '@/components/board/board';
import { NewTaskButton } from '@/components/board/new-task';
import { TaskPanel } from '@/components/board/task-panel';
import { renameBoardAction } from '../../../actions';

export default async function BoardPage({ params, searchParams }: PageProps<'/projects/[projectId]/boards/[boardId]'>) {
  const { projectId, boardId } = await params;
  const { task: taskParam } = await searchParams;
  const owner = await requireOwner();
  const project = await orNotFound(getProject(owner, projectId));
  const board = project.boards.find((b) => b.id === boardId); // also rejects malformed ids
  if (!board) notFound();

  const [tasks, agents] = await Promise.all([listBoardTasks(owner, board.id), listAssignableAgents(owner, project.id)]);
  const openTask = typeof taskParam === 'string'
    ? await getTaskDetail(owner, taskParam).catch(() => null)
    : null;
  const panelTask = openTask && openTask.projectId === project.id ? openTask : null;
  const messages = panelTask ? await listMessages(panelTask.id) : [];

  return (
    <section className="grid gap-4">
      <AutoRefresh />
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-medium">{board.name}</h2>
        <FormDialog trigger="Rename board" title="Rename board" submitLabel="Save" action={renameBoardAction} variant="ghost">
          <input type="hidden" name="boardId" value={board.id} />
          <Field name="name" label="Board name" defaultValue={board.name} />
        </FormDialog>
      </div>
      <div className={panelTask ? 'grid gap-4 xl:grid-cols-[1fr_24rem]' : 'grid'}>
        <div className="overflow-x-auto pb-2">
          <Board tasks={tasks} newTask={<NewTaskButton boardId={board.id} agents={agents} />} />
        </div>
        {panelTask && <TaskPanel task={panelTask} agents={agents} boards={project.boards} messages={messages} ownerActorId={owner.actorId} />}
      </div>
      {typeof taskParam === 'string' && !panelTask && (
        <p role="status" className="text-sm text-muted-foreground">That task wasn&apos;t found or you don&apos;t have access.</p>
      )}
    </section>
  );
}
