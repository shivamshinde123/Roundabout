import { notFound } from 'next/navigation';
import { requireOwner } from '@/server/auth';
import { orNotFound } from '@/server/actions';
import { getProject } from '@/server/projects';
import { getWorkspace } from '@/server/workspace';
import { getTaskDetail, listAssignableAgents, listBoardTasks } from '@/server/tasks';
import { listMessages } from '@/server/messages';
import { listHandoffs } from '@/server/handoffs';
import { listBlockers } from '@/server/blockers';
import { listResults } from '@/server/results';
import { ActionMenu } from '@/components/action-menu';
import { Pencil, Trash2 } from 'lucide-react';
import { Field } from '@/components/field';
import { AutoRefresh } from '@/components/board/auto-refresh';
import { Board } from '@/components/board/board';
import { NewTaskButton } from '@/components/board/new-task';
import { TaskPanel } from '@/components/board/task-panel';
import { deleteBoardAction, renameBoardAction } from '../../../actions';

export default async function BoardPage({ params, searchParams }: PageProps<'/projects/[projectId]/boards/[boardId]'>) {
  const { projectId, boardId } = await params;
  const { task: taskParam } = await searchParams;
  const owner = await requireOwner();
  const project = await orNotFound(getProject(owner, projectId));
  const board = project.boards.find((b) => b.id === boardId); // also rejects malformed ids
  if (!board) notFound();

  const [tasks, agents, workspace] = await Promise.all([
    listBoardTasks(owner, board.id), listAssignableAgents(owner, project.id), getWorkspace(owner),
  ]);
  const openTask = typeof taskParam === 'string'
    ? await getTaskDetail(owner, taskParam).catch(() => null)
    : null;
  const panelTask = openTask && openTask.projectId === project.id ? openTask : null;
  const [messages, handoffs, blockers, results] = panelTask
    ? await Promise.all([listMessages(panelTask.id), listHandoffs(panelTask.id), listBlockers(panelTask.id), listResults(panelTask.id)])
    : [[], [], [], []];

  return (
    <section className="grid gap-4">
      <AutoRefresh />
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-medium">{board.name}</h2>
        <ActionMenu
          label="Board actions"
          items={[
            {
              label: 'Rename board', icon: <Pencil />, title: 'Rename board', submitLabel: 'Save', action: renameBoardAction,
              body: <><input type="hidden" name="boardId" value={board.id} /><Field name="name" label="Board name" defaultValue={board.name} /></>,
            },
            // A project keeps at least one board (D-28), so the only board has no Delete item.
            ...(project.boards.length > 1 ? [{
              label: 'Delete board', icon: <Trash2 />, title: `Delete ${board.name}?`, submitLabel: 'Delete', destructive: true,
              action: deleteBoardAction,
              body: (
                <div className="grid gap-2 text-sm">
                  <input type="hidden" name="boardId" value={board.id} />
                  {tasks.length === 0 ? (
                    <p>Deletes the board <strong>{board.name}</strong>. It has no tasks.</p>
                  ) : (
                    <>
                      <p>
                        Deletes the board <strong>{board.name}</strong> and {tasks.length === 1 ? 'the 1 task' : `all ${tasks.length} tasks`} on it,
                        with their results, handoffs, blockers and history.
                      </p>
                      <p className="text-muted-foreground">To keep a task, move it to another board first (open it, then Move board).</p>
                    </>
                  )}
                </div>
              ),
            }] : []),
          ]}
        />
      </div>
      <div className={panelTask ? 'grid gap-4 xl:grid-cols-[1fr_24rem]' : 'grid'}>
        <div className="relative min-w-0 overflow-x-auto pb-2">
          <Board tasks={tasks} newTask={<NewTaskButton boardId={board.id} agents={agents} defaultRequireReview={workspace.defaultRequireReview} />} />
        </div>
        {panelTask && <TaskPanel task={panelTask} agents={agents} boards={project.boards} messages={messages} ownerActorId={owner.actorId} handoffs={handoffs} blockers={blockers} results={results} />}
      </div>
      {typeof taskParam === 'string' && !panelTask && (
        <p role="status" className="text-sm text-muted-foreground">That task wasn&apos;t found or you don&apos;t have access.</p>
      )}
    </section>
  );
}
