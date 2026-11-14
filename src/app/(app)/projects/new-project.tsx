import { FormDialog } from '@/components/form-dialog';
import { Field } from '@/components/field';
import { createProjectAction } from './actions';

export function NewProjectButton({ variant }: { variant?: 'outline' | 'ghost' | 'default' }) {
  return (
    <FormDialog trigger="New project" title="Create a project" submitLabel="Create project" action={createProjectAction} variant={variant}>
      <Field name="name" label="Project name" />
    </FormDialog>
  );
}
