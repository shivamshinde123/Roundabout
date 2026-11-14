import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { FormDialog } from '@/components/form-dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { approveResultFormAction, postMessageAction, resolveBlockerAction } from '@/app/(app)/tasks/actions';
import type { InboxItem } from '@/server/inbox';
import { ago } from '@/lib/time';

const kindLabel: Record<InboxItem['kind'], string> = {
  review: 'Review',
  blocked: 'Blocked',
  question: 'Question',
  stalled: 'Stalled',
  no_access: "Agent can't access",
};
const tone: Record<InboxItem['kind'], 'default' | 'destructive' | 'secondary' | 'outline'> = {
  review: 'default', blocked: 'destructive', question: 'secondary', stalled: 'outline', no_access: 'destructive',
};

const taskHref = (t: InboxItem['task']) => `/projects/${t.projectId}/boards/${t.boardId}?task=${t.id}`;

/** One place for everything that needs the owner (O5, atlas diagram 16), each with its next action. */
export function InboxList({ items, limit }: { items: InboxItem[]; limit?: number }) {
  if (items.length === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">Nothing needs you right now.</p>;
  }
  return (
    <ul className="grid gap-2">
      {items.slice(0, limit).map((item) => (
        <li key={item.key} className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-[8rem_1fr_auto] sm:items-start">
          <Badge variant={tone[item.kind]} className="w-fit">{kindLabel[item.kind]}</Badge>
          <div className="grid gap-1">
            <Link href={taskHref(item.task)} className="font-medium hover:underline">{item.task.title}</Link>
            <p className="text-muted-foreground">
              {item.kind === 'review' && <>{item.from} submitted “{item.summary}”</>}
              {item.kind === 'blocked' && <>{item.from}: {item.reason} — <span className="text-foreground">{item.question}</span></>}
              {item.kind === 'question' && <>{item.from} asks “{item.body}”</>}
              {(item.kind === 'stalled' || item.kind === 'no_access') && item.detail}
              {' · '}{ago(item.at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {item.kind === 'review' && (
              <ActionForm action={approveResultFormAction} submitLabel="Approve" className="flex">
                <input type="hidden" name="resultId" value={item.resultId} />
                <input type="hidden" name="expectedRevision" value={item.task.revision} />
              </ActionForm>
            )}
            {item.kind === 'question' && (
              <FormDialog trigger="Reply" title={`Reply to ${item.from}`} submitLabel="Send" action={postMessageAction}>
                <input type="hidden" name="taskId" value={item.task.id} />
                <input type="hidden" name="replyTo" value={item.messageId} />
                <blockquote className="border-l-2 pl-2 text-sm text-muted-foreground">{item.body}</blockquote>
                <Label htmlFor={`inbox-reply-${item.messageId}`}>Your reply</Label>
                <Textarea id={`inbox-reply-${item.messageId}`} name="body" rows={3} required />
              </FormDialog>
            )}
            {item.kind === 'blocked' && (
              <FormDialog trigger="Mark resolved" title="Resolve blocker" submitLabel="Resolve" action={resolveBlockerAction}>
                <input type="hidden" name="blockerId" value={item.blockerId} />
                <Label htmlFor={`inbox-res-${item.blockerId}`}>How was it resolved?</Label>
                <Textarea id={`inbox-res-${item.blockerId}`} name="resolution" rows={2} required />
              </FormDialog>
            )}
            <Link href={taskHref(item.task)} className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted">
              {item.kind === 'stalled' || item.kind === 'no_access' ? 'Reassign…' : 'Open task'}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
