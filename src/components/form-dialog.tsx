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
}: {
  trigger: string;
  title: string;
  submitLabel: string;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children: ReactNode;
  variant?: 'outline' | 'ghost' | 'default';
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm">{trigger}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ActionForm action={action} submitLabel={submitLabel} onSuccess={() => setOpen(false)}>
          {children}
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
