'use client';

import { ActionForm } from '@/components/action-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { requestChangesAction } from '@/app/(app)/tasks/actions';

/** Controlled "Request changes" dialog, opened from a drop on In Progress or the card's menu. */
export function RequestChangesDialog({
  open, onOpenChange, resultId, revision, title,
}: { open: boolean; onOpenChange: (open: boolean) => void; resultId: string; revision: number; title: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request changes: {title}</DialogTitle>
        </DialogHeader>
        <ActionForm action={requestChangesAction} submitLabel="Request changes" onSuccess={() => onOpenChange(false)}>
          <input type="hidden" name="resultId" value={resultId} />
          <input type="hidden" name="expectedRevision" value={revision} />
          <div className="grid gap-2">
            <Label htmlFor={`changes-${resultId}`}>What needs to change?</Label>
            <Textarea id={`changes-${resultId}`} name="comment" rows={4} required />
          </div>
          <p className="text-xs text-muted-foreground">The task returns to In Progress. The agent gets your comment and the earlier result stays on the task.</p>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
