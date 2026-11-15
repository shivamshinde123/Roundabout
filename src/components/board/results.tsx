import { ActionForm } from '@/components/action-form';
import { ExternalChip } from '@/components/link-chip';
import { FormDialog } from '@/components/form-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { approveResultFormAction, requestChangesAction } from '@/app/(app)/tasks/actions';
import type { ResultView } from '@/server/results';
import { ago } from '@/lib/time';

const statusText = {
  pending: 'Waiting for your review',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  not_required: 'Completed by agent (no review)',
  superseded: 'Superseded',
} as const;

/** Submissions newest first; the pending one carries Approve / Request changes (diagram 13). */
export function ResultList({ results, revision }: { results: ResultView[]; revision: number }) {
  if (results.length === 0) return null;
  return (
    <section className="grid gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">Results</h3>
      <ol className="grid gap-2">
        {results.map((r) => (
          <li key={r.id} className={r.reviewStatus === 'pending' ? 'grid gap-1.5 rounded-lg border border-primary/50 bg-panel/60 p-3' : 'grid gap-1.5 rounded-lg border bg-panel/60 p-3'}>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{statusText[r.reviewStatus]}</span> · {r.submittedBy.name} · {ago(r.createdAt)}
            </p>
            <p className="font-medium text-foreground">{r.summary}</p>
            {r.details && <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/80">{r.details}</p>}
            {r.links.length > 0 && (
              <ul className="text-xs">
                {r.links.map((l) => (
                  <li key={l.url}><ExternalChip href={l.url} label={l.label || l.url} /></li>
                ))}
              </ul>
            )}
            {r.reviewComment && <p className="text-xs">Your comment: {r.reviewComment}</p>}
            {r.reviewStatus === 'pending' && (
              <div className="flex flex-wrap gap-2">
                <ActionForm action={approveResultFormAction} submitLabel="Approve">
                  <input type="hidden" name="resultId" value={r.id} />
                  <input type="hidden" name="expectedRevision" value={revision} />
                </ActionForm>
                <FormDialog trigger="Request changes" title="Request changes" submitLabel="Request changes" action={requestChangesAction}>
                  <input type="hidden" name="resultId" value={r.id} />
                  <input type="hidden" name="expectedRevision" value={revision} />
                  <Label htmlFor={`rc-${r.id}`}>What needs to change?</Label>
                  <Textarea id={`rc-${r.id}`} name="comment" rows={4} required />
                </FormDialog>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
