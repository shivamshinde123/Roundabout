import { FormDialog } from '@/components/form-dialog';
import { Label } from '@/components/ui/label';
import { createTaskAction } from '@/app/(app)/tasks/actions';
import { AgentSelect, NativeSelect, TaskFields } from './task-fields';

export function NewTaskButton({ boardId, agents }: { boardId: string; agents: { id: string; name: string }[] }) {
  return (
    <FormDialog trigger="+ New task" title="New task" submitLabel="Create task" action={createTaskAction} variant="ghost">
      <input type="hidden" name="boardId" value={boardId} />
      <TaskFields prefix="new" />
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="new-status">Column</Label>
          <NativeSelect id="new-status" name="status" defaultValue="backlog" options={[{ value: 'backlog', label: 'Backlog' }, { value: 'todo', label: 'To Do' }]} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-assignee">Assign to</Label>
          <AgentSelect id="new-assignee" name="assigneeAgentId" agents={agents} emptyLabel={agents.length ? 'Unassigned' : 'No agents connected yet'} />
        </div>
      </div>
    </FormDialog>
  );
}
