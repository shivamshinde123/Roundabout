'use client';

import { useState, type ReactNode } from 'react';
import { ActionForm, type FormState } from '@/components/action-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

/** A button that opens a dialog containing a server-action form; closes on success. */
export function FormDialog({
  trigger,
  title,
  submitLabel,
  action,
  children,
  variant = 'outline',
  submitVariant,
  inline = false,
}: {
  trigger: string;
  title: string;
  submitLabel: string;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children: ReactNode;
  variant?: 'outline' | 'ghost' | 'default' | 'destructive';
  submitVariant?: 'default' | 'destructive';
  /** A text-style trigger flush with the content above it (Reply, Answer, Mark resolved). */
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={inline ? 'link' : variant} size="sm" className={inline ? 'h-auto px-0 text-primary' : undefined}>{trigger}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ActionForm action={action} submitLabel={submitLabel} submitVariant={submitVariant} onSuccess={() => setOpen(false)}>
          {children}
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
