import { FormDialog } from '@/components/form-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cancelHandoffAction, postMessageAction, resolveBlockerAction } from '@/app/(app)/tasks/actions';
import type { BlockerView } from '@/server/blockers';
import type { HandoffView } from '@/server/handoffs';
import { ago } from '@/lib/time';

const handoffStatus = { pending: 'Pending', accepted: 'Accepted', declined: 'Declined', cancelled: 'Cancelled', superseded: 'Superseded' } as const;

/** Open blockers first, with what's needed and how to respond (atlas diagram 11, O5). */
export function BlockerList({ taskId, blockers }: { taskId: string; blockers: BlockerView[] }) {
  if (blockers.length === 0) return null;
  const open = blockers.filter((b) => b.status === 'open');
  const resolved = blockers.filter((b) => b.status === 'resolved');
  return (
    <section className="grid gap-2">
      <h3 className="font-medium">Blockers</h3>
      {open.map((b) => (
        <div key={b.id} role="group" aria-label="Open blocker" className="grid gap-1 rounded-md border border-destructive/50 p-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-destructive">Blocked</span> · raised by {b.raisedBy.name} · needs {b.needs} · {ago(b.createdAt)}
          </p>
          <p>{b.reason}</p>
          <p><span className="font-medium">Question:</span> {b.question}</p>
          {b.missingResource && <p className="text-xs">Missing access: {b.missingResource}</p>}
          <div className="flex flex-wrap gap-1">
            {b.raisedBy.agentId && (
              <FormDialog trigger="Answer" title={`Answer ${b.raisedBy.name}`} submitLabel="Send answer" action={postMessageAction} variant="ghost">
                <input type="hidden" name="taskId" value={taskId} />
                <input type="hidden" name="to" value={b.raisedBy.agentId} />
                <blockquote className="border-l-2 pl-2 text-sm text-muted-foreground">{b.question}</blockquote>
                <Label htmlFor={`answer-${b.id}`}>Your answer</Label>
                <Textarea id={`answer-${b.id}`} name="body" rows={3} required />
                <p className="text-xs text-muted-foreground">The blocker stays open until the agent clears it or you mark it resolved.</p>
              </FormDialog>
            )}
            <FormDialog trigger="Mark resolved" title="Resolve blocker" submitLabel="Resolve" action={resolveBlockerAction} variant="ghost">
              <input type="hidden" name="blockerId" value={b.id} />
              <Label htmlFor={`resolution-${b.id}`}>How was it resolved?</Label>
              <Textarea id={`resolution-${b.id}`} name="resolution" rows={2} required />
            </FormDialog>
          </div>
        </div>
      ))}
      {resolved.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary>{resolved.length} resolved</summary>
          <ul className="mt-1 grid gap-1">
            {resolved.map((b) => (
              <li key={b.id}>{b.reason} — {b.resolution}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Who passed the work to whom, whether it was accepted, and the context they handed over (O4). */
export function HandoffList({ handoffs }: { handoffs: HandoffView[] }) {
  if (handoffs.length === 0) return null;
  return (
    <section className="grid gap-2">
      <h3 className="font-medium">Handoffs</h3>
      <ol className="grid gap-2">
        {handoffs.map((h) => (
          <li key={h.id} className="grid gap-1 rounded-md border p-2">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{h.from.name} → {h.to.name}</span> · {handoffStatus[h.status]} · {ago(h.createdAt)}
            </p>
            <p><span className="font-medium">Why:</span> {h.reason}</p>
            <p><span className="font-medium">Done so far:</span> {h.workCompleted}</p>
            <p><span className="font-medium">Next:</span> {h.nextAction}</p>
            {h.declineReason && <p className="text-xs">Declined: {h.declineReason}</p>}
            {h.status === 'pending' && (
              <div>
                <FormDialog trigger="Cancel handoff" title="Cancel this handoff?" submitLabel="Cancel handoff" action={cancelHandoffAction} variant="ghost">
                  <input type="hidden" name="handoffId" value={h.id} />
                  <p className="text-sm">{h.from.name} keeps the task. You can reassign it if the work has stalled.</p>
                </FormDialog>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
