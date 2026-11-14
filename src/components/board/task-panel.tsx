import { FormDialog } from '@/components/form-dialog';
import { Label } from '@/components/ui/label';
import { assignTaskAction, moveTaskBoardAction, reassignTaskAction, reopenTaskAction, updateTaskAction } from '@/app/(app)/tasks/actions';
import { label, type TaskDetail } from '@/server/tasks';
import type { Message } from '@/server/messages';
import { Discussion } from './discussion';
import { BlockerList, HandoffList } from './coordination';
import { ResultList } from './results';
import type { ResultView } from '@/server/results';
import type { BlockerView } from '@/server/blockers';
import type { HandoffView } from '@/server/handoffs';
import { TaskBadges } from './badges';
import { ClosePanel } from './close-panel';
import { AgentSelect, NativeSelect, TaskFields } from './task-fields';

const when = (d: Date) => d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export function describeEvent(type: string, data: Record<string, unknown>): string {
  switch (type) {
    case 'task.created': return 'created the task';
    case 'task.edited': return `edited ${(data.fields as string[] | undefined)?.join(', ') ?? 'the task'}`;
    case 'task.status_changed': return `moved it from ${data.from} to ${data.to}`;
    case 'task.moved_board': return 'moved it to another board';
    case 'task.assigned': return data.toAgentId ? 'assigned it' : 'unassigned it';
    case 'task.accepted': return 'accepted it';
    case 'task.reassigned': return data.toAgentId ? 'reassigned it' : 'moved it back to Backlog';
    case 'task.reopened': return 'reopened it';
    case 'handoff.proposed': return 'proposed a handoff';
    case 'handoff.accepted': return 'accepted the handoff';
    case 'handoff.declined': return 'declined the handoff';
    case 'handoff.cancelled': return 'cancelled the handoff';
    case 'handoff.superseded': return 'superseded the handoff';
    case 'blocker.reported': return 'reported a blocker';
    case 'blocker.resolved': return 'resolved a blocker';
    case 'result.submitted': return `submitted a result: ${data.summary ?? ''}`;
    case 'review.approved': return 'approved the result';
    case 'review.changes_requested': return 'requested changes';
    case 'task.completed': return 'completed the task';
    case 'message.posted': return data.kind === 'update' ? 'posted an update' : data.kind === 'question' ? 'asked a question' : 'posted a message';
    default: return type.replace('.', ' ').replace('_', ' ');
  }
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
  const canAssign = task.status === 'backlog' || task.status === 'todo';
  const canReassign = task.status === 'in_progress' || task.status === 'review';
  return (
    <aside aria-label={`Task: ${task.title}`} className="grid content-start gap-4 rounded-lg border bg-background p-4 text-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="grid gap-1">
          <h2 className="text-base font-semibold">{task.title}</h2>
          <p className="text-muted-foreground">
            {label(task.status)} · {task.assignee?.name ?? 'Unassigned'}
            {task.requireReview ? ' · Review required' : ' · Agent can complete'}
          </p>
          <TaskBadges task={task} />
        </div>
        <ClosePanel taskId={task.id} />
      </header>

      <div className="flex flex-wrap gap-2">
        <FormDialog trigger="Edit" title="Edit task" submitLabel="Save" action={updateTaskAction}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="expectedRevision" value={task.revision} />
          <TaskFields prefix="edit" values={task} />
        </FormDialog>
        {canAssign && (
          <FormDialog trigger={task.assignee ? 'Change assignee' : 'Assign'} title="Assign task" submitLabel="Save" action={assignTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="expectedRevision" value={task.revision} />
            <div className="grid gap-2">
              <Label htmlFor="assign-agent">Agent</Label>
              <AgentSelect id="assign-agent" name="agentId" agents={agents} defaultValue={task.assignee?.id} />
              {agents.length === 0 && <p className="text-xs text-muted-foreground">Connect an agent with access to this project first.</p>}
            </div>
          </FormDialog>
        )}
        {canReassign && (
          <FormDialog trigger="Reassign" title="Reassign this task" submitLabel="Reassign" action={reassignTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="expectedRevision" value={task.revision} />
            <div className="grid gap-2">
              <Label htmlFor="reassign-agent">New agent</Label>
              <AgentSelect id="reassign-agent" name="agentId" agents={agents.filter((a) => a.id !== task.assignee?.id)} emptyLabel="Nobody (move to Backlog)" />
            </div>
            <p className="text-xs text-muted-foreground">
              {task.assignee?.name ?? 'The current agent'} loses the task immediately; their later updates are rejected. Results,
              messages and history stay on the task. Any pending handoff or review is set aside.
            </p>
          </FormDialog>
        )}
        {task.status === 'done' && (
          <FormDialog trigger="Reopen" title="Reopen this task" submitLabel="Reopen" action={reopenTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="expectedRevision" value={task.revision} />
            <div className="grid gap-2">
              <Label htmlFor="reopen-agent">Assign to</Label>
              <select id="reopen-agent" name="agentId" defaultValue="keep" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                {task.assignee && <option value="keep">Keep {task.assignee.name}</option>}
                <option value="">Nobody (Backlog)</option>
                {agents.filter((a) => a.id !== task.assignee?.id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </FormDialog>
        )}
        {boards.length > 1 && (
          <FormDialog trigger="Move board" title="Move to another board" submitLabel="Move" action={moveTaskBoardAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="expectedRevision" value={task.revision} />
            <div className="grid gap-2">
              <Label htmlFor="move-board">Board</Label>
              <NativeSelect id="move-board" name="boardId" defaultValue={task.boardId} options={boards.map((b) => ({ value: b.id, label: b.name }))} />
            </div>
          </FormDialog>
        )}
      </div>

      <ResultList results={results} revision={task.revision} />
      <BlockerList taskId={task.id} blockers={blockers} />

      <section className="grid gap-1">
        <h3 className="font-medium">Instructions</h3>
        <p className="whitespace-pre-wrap text-muted-foreground">{task.instructions || 'None yet.'}</p>
      </section>
      {task.expectedResult && (
        <section className="grid gap-1">
          <h3 className="font-medium">Expected result</h3>
          <p className="whitespace-pre-wrap text-muted-foreground">{task.expectedResult}</p>
        </section>
      )}
      {(task.repository || task.branch) && (
        <p className="text-muted-foreground">Repo {task.repository ?? '—'} · branch {task.branch ?? '—'}</p>
      )}
      {task.links.length > 0 && (
        <section className="grid gap-1">
          <h3 className="font-medium">Links</h3>
          <ul className="grid gap-1">
            {task.links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="underline">{l.label || l.url}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {task.nextAction && (
        <section className="grid gap-1">
          <h3 className="font-medium">Next action</h3>
          <p className="text-muted-foreground">{task.nextAction}</p>
        </section>
      )}

      <HandoffList handoffs={handoffs} />

      <Discussion taskId={task.id} messages={messages} ownerActorId={ownerActorId} agents={agents} />

      <section className="grid gap-1">
        <h3 className="font-medium">History</h3>
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
