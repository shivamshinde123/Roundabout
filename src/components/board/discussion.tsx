import { ActionForm } from '@/components/action-form';
import { FormDialog } from '@/components/form-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { postMessageAction } from '@/app/(app)/tasks/actions';
import type { Message } from '@/server/messages';
import { ago } from '@/lib/time';
import { AgentSelect } from './task-fields';
import { MarkRead } from './mark-read';

const kindLabel = { update: 'Update', message: 'Message', question: 'Question' } as const;

export function Discussion({
  taskId, messages, ownerActorId, agents,
}: { taskId: string; messages: Message[]; ownerActorId: string; agents: { id: string; name: string }[] }) {
  const unread = messages.some((m) => m.recipient?.actorId === ownerActorId && !m.readAt);
  return (
    <section className="grid gap-2" aria-labelledby={`discussion-${taskId}`}>
      <h3 id={`discussion-${taskId}`} className="text-xs font-medium text-muted-foreground">Discussion</h3>
      <MarkRead taskId={taskId} unread={unread} />
      {messages.length === 0 && <p className="text-muted-foreground">No messages yet.</p>}
      <ol className="grid gap-2">
        {messages.map((m) => {
          const toMe = m.recipient?.actorId === ownerActorId;
          const openQuestion = m.kind === 'question' && toMe && !m.answeredAt;
          return (
            <li key={m.id} className={openQuestion ? 'grid gap-1 rounded-lg border border-amber-500/60 bg-panel/60 p-3' : 'grid gap-1 rounded-lg border bg-panel/60 p-3'}>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{m.sender.name}</span>
                {m.recipient && <> → {toMe ? 'you' : m.recipient.name}</>} · {kindLabel[m.kind]}
                {openQuestion && ' · needs your answer'} · {ago(m.createdAt)}
                {m.recipient && !toMe && (m.readAt ? ' · read' : ' · unread')}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">{m.body}</p>
              {m.links.length > 0 && (
                <ul className="mt-1 text-xs">
                  {m.links.map((l) => (
                    <li key={l.url}>
                      <a className="underline" href={l.url} target="_blank" rel="noopener noreferrer">{l.label || l.url}</a>
                    </li>
                  ))}
                </ul>
              )}
              {m.sender.actorId !== ownerActorId && (
                <div>
                  <FormDialog
                    trigger={openQuestion ? 'Answer' : 'Reply'}
                    title={`Reply to ${m.sender.name}`}
                    submitLabel="Send"
                    action={postMessageAction}
                    inline
                  >
                    <input type="hidden" name="taskId" value={taskId} />
                    <input type="hidden" name="replyTo" value={m.id} />
                    <blockquote className="border-l-2 pl-2 text-sm text-muted-foreground">{m.body}</blockquote>
                    <Label htmlFor={`reply-${m.id}`}>Your reply</Label>
                    <Textarea id={`reply-${m.id}`} name="body" rows={3} required />
                  </FormDialog>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <ActionForm compact action={postMessageAction} submitLabel="Send message">
        <input type="hidden" name="taskId" value={taskId} />
        <div className="grid gap-2">
          <Label htmlFor={`msg-${taskId}`} className="text-xs text-muted-foreground">New message</Label>
          <Textarea id={`msg-${taskId}`} name="body" rows={2} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`to-${taskId}`} className="text-xs text-muted-foreground">To</Label>
          <AgentSelect id={`to-${taskId}`} name="to" agents={agents} emptyLabel="Everyone on the task" />
        </div>
      </ActionForm>
    </section>
  );
}
