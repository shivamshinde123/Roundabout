import { ActionMenu, type MenuItem } from '@/components/action-menu';
import { ExternalChip } from '@/components/link-chip';
import { Kanban, Pencil, RotateCcw, Trash2, UserPlus, Users } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { assignTaskAction, deleteTaskAction, moveTaskBoardAction, reassignTaskAction, reopenTaskAction, updateTaskAction } from '@/app/(app)/tasks/actions';
import { label, type TaskDetail } from '@/server/tasks';
import type { Message } from '@/server/messages';
import { Discussion } from './discussion';
import { BlockerList, HandoffList } from './coordination';
import { ResultList } from './results';
import type { ResultView } from '@/server/results';
import type { BlockerView } from '@/server/blockers';
import type { HandoffView } from '@/server/handoffs';
import { TaskBadges } from './badges';
import { describeEvent } from '@/lib/events';
import { ClosePanel } from './close-panel';
import { AgentSelect, NativeSelect, TaskFields } from './task-fields';

const when = (d: Date) => d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });


/** Everything you can do to a task, behind the panel's ⋯ menu (D-33). Items appear only when the move is allowed. */
function taskActions(task: TaskDetail, agents: { id: string; name: string }[], boards: { id: string; name: string }[]): MenuItem[] {
  const ids = <><input type="hidden" name="taskId" value={task.id} /><input type="hidden" name="expectedRevision" value={task.revision} /></>;
  const items: MenuItem[] = [
    { label: 'Edit', icon: <Pencil />, title: 'Edit task', submitLabel: 'Save', action: updateTaskAction, body: <>{ids}<TaskFields prefix="edit" values={task} /></> },
  ];
  if (task.status === 'backlog' || task.status === 'todo') {
    items.push({
      label: task.assignee ? 'Change assignee' : 'Assign', icon: <UserPlus />, title: 'Assign task', submitLabel: 'Save', action: assignTaskAction,
      body: (
        <>{ids}
          <div className="grid gap-2">
            <Label htmlFor="assign-agent">Agent</Label>
            <AgentSelect id="assign-agent" name="agentId" agents={agents} defaultValue={task.assignee?.id} />
            {agents.length === 0 && <p className="text-xs text-muted-foreground">Connect an agent with access to this project first.</p>}
          </div>
        </>
      ),
    });
  }
  if (task.status === 'in_progress' || task.status === 'review') {
    items.push({
      label: 'Reassign', icon: <Users />, title: 'Reassign this task', submitLabel: 'Reassign', action: reassignTaskAction,
      body: (
        <>{ids}
          <div className="grid gap-2">
            <Label htmlFor="reassign-agent">New agent</Label>
            <AgentSelect id="reassign-agent" name="agentId" agents={agents.filter((a) => a.id !== task.assignee?.id)} emptyLabel="Nobody (move to Backlog)" />
          </div>
          <p className="text-xs text-muted-foreground">
            {task.assignee?.name ?? 'The current agent'} loses the task immediately, and its later updates are rejected. Results,
            messages and history stay on the task. Any pending handoff or review is set aside.
          </p>
        </>
      ),
    });
  }
  if (task.status === 'done') {
    items.push({
      label: 'Reopen', icon: <RotateCcw />, title: 'Reopen this task', submitLabel: 'Reopen', action: reopenTaskAction,
      body: (
        <>{ids}
          <div className="grid gap-2">
            <Label htmlFor="reopen-agent">Assign to</Label>
            <select id="reopen-agent" name="agentId" defaultValue="keep" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
              {task.assignee && <option value="keep">Keep {task.assignee.name}</option>}
              <option value="">Nobody (Backlog)</option>
              {agents.filter((a) => a.id !== task.assignee?.id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </>
      ),
    });
  }
  if (boards.length > 1) {
    items.push({
      label: 'Move to board', icon: <Kanban />, title: 'Move to another board', submitLabel: 'Move', action: moveTaskBoardAction,
      body: (
        <>{ids}
          <div className="grid gap-2">
            <Label htmlFor="move-board">Board</Label>
            <NativeSelect id="move-board" name="boardId" defaultValue={task.boardId} options={boards.map((b) => ({ value: b.id, label: b.name }))} />
          </div>
        </>
      ),
    });
  }
  items.push({
    label: 'Delete task', icon: <Trash2 />, title: `Delete "${task.title}"?`, submitLabel: 'Delete', destructive: true, action: deleteTaskAction,
    body: (
      <div className="grid gap-2 text-sm">
        <input type="hidden" name="taskId" value={task.id} />
        <p>Deletes this task with its messages, results, handoffs, blockers and history.</p>
        {task.assignee && task.status !== 'done' && (
          <p className="text-muted-foreground">{task.assignee.name} is assigned to it and will get &ldquo;not found&rdquo; if it tries to work on it.</p>
        )}
      </div>
    ),
  });
  return items;
}

export function TaskPanel({
  task, agents, boards, messages, ownerActorId, handoffs, blockers, results,
}: {
  task: TaskDetail;
  agents: { id: string; name: string }[];
  boards: { id: string; name: string }[];
  messages: Message[];
  ownerActorId: string;
  handoffs: HandoffView[];
  blockers: BlockerView[];
  results: ResultView[];
}) {
  return (
    <aside aria-label={`Task: ${task.title}`} className="grid content-start gap-4 rounded-xl border bg-card p-4 text-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="grid gap-1">
          <h2 className="text-base font-semibold">{task.title}</h2>
          <p className="text-muted-foreground">
            {label(task.status)} · {task.assignee?.name ?? 'Unassigned'}
            {task.requireReview ? ' · Review required' : ' · Agent can complete'}
          </p>
          <TaskBadges task={task} />
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <ActionMenu label={`Actions for ${task.title}`} items={taskActions(task, agents, boards)} />
          <ClosePanel taskId={task.id} />
        </div>
      </header>

      <ResultList results={results} revision={task.revision} />
      <BlockerList taskId={task.id} blockers={blockers} />

      <section className="grid gap-1">
        <h3 className="text-xs font-medium text-muted-foreground">Instructions</h3>
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/80">{task.instructions || 'None yet.'}</p>
      </section>
      {task.expectedResult && (
        <section className="grid gap-1">
          <h3 className="text-xs font-medium text-muted-foreground">Expected result</h3>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/80">{task.expectedResult}</p>
        </section>
      )}
      {(task.repository || task.branch) && (
        <p className="text-muted-foreground">Repo {task.repository ?? '—'} · branch {task.branch ?? '—'}</p>
      )}
      {task.links.length > 0 && (
        <section className="grid gap-1">
          <h3 className="text-xs font-medium text-muted-foreground">Links</h3>
          <ul className="grid gap-1">
            {task.links.map((l) => (
              <li key={l.url}>
                <ExternalChip href={l.url} label={l.label || l.url} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {task.nextAction && (
        <section className="grid gap-1">
          <h3 className="text-xs font-medium text-muted-foreground">Next action</h3>
          <p className="text-[13px] leading-relaxed text-foreground/80">{task.nextAction}</p>
        </section>
      )}

      <HandoffList handoffs={handoffs} />

      <Discussion taskId={task.id} messages={messages} ownerActorId={ownerActorId} agents={agents} />

      <section className="grid gap-1">
        <h3 className="text-xs font-medium text-muted-foreground">History</h3>
        <ol className="grid gap-1 text-muted-foreground">
          {task.history.map((h) => (
            <li key={h.id}>
              <time dateTime={h.createdAt.toISOString()}>{when(h.createdAt)}</time> · {h.actorName} {describeEvent(h.type, h.data)}
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
