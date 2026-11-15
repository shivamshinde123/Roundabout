import type { ReactNode } from 'react';
import { FormDialog } from '@/components/form-dialog';
import type { FormState } from '@/components/action-form';

/** "Delete …" button that opens a confirmation window; nothing is deleted until the red button is pressed. */
export function ConfirmDelete({
  trigger, title, action, fields, children,
}: {
  trigger: string;
  title: string;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  children: ReactNode;
}) {
  return (
    <FormDialog trigger={trigger} title={title} submitLabel="Delete" action={action} variant="destructive" submitVariant="destructive">
      {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <div className="grid gap-2 text-sm">{children}</div>
      <p className="text-sm font-medium">This can&apos;t be undone.</p>
    </FormDialog>
  );
}
