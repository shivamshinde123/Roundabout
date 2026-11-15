'use client';

import { startTransition, useActionState, useEffect, type FormEvent, type ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export type FormState = { error?: string; ok?: string } | undefined;

/**
 * A form bound to a server action, with pending state and an announced result message.
 * Submits via onSubmit (not the `action` prop) so React doesn't reset the fields after a
 * failed attempt — the user shouldn't have to retype their email after a wrong password.
 */
export function ActionForm({
  action,
  submitLabel,
  children,
  className,
  onSuccess,
  submitVariant = 'default',
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  children?: ReactNode;
  className?: string;
  /** Called after an action returns `{ ok }`, e.g. to close a dialog. */
  onSuccess?: () => void;
  submitVariant?: 'default' | 'destructive';
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  useEffect(() => {
    if (state?.ok) onSuccess?.();
  }, [state, onSuccess]);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  };
  return (
    <form onSubmit={onSubmit} className={className ?? 'grid gap-4'}>
      {children}
      <div role="status" aria-live="polite">
        {state?.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        {state?.ok && (
          <Alert>
            <AlertDescription>{state.ok}</AlertDescription>
          </Alert>
        )}
      </div>
      <Button type="submit" variant={submitVariant} disabled={pending}>
        {pending ? 'Working…' : submitLabel}
      </Button>
    </form>
  );
}
