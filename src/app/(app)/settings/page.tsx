import { KeyRound, Mail, ShieldAlert, User, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { ActionForm } from '@/components/action-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Field } from '@/components/field';
import { FormDialog } from '@/components/form-dialog';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireOwner } from '@/server/auth';
import { getWorkspace } from '@/server/workspace';
import {
  changeEmailAction, changePasswordAction, deleteAccountAction, updateDisplayNameAction, updateWorkspaceAction,
} from './actions';

function Section({ icon, title, description, children, danger }: {
  icon: ReactNode; title: string; description: string; children: ReactNode; danger?: boolean;
}) {
  return (
    <section className={`grid gap-4 rounded-xl border bg-card p-5 ${danger ? 'border-destructive/40' : ''}`}>
      <header className="flex items-start gap-3">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div className="grid gap-0.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

/** Account and workspace settings (D-32). */
export default async function SettingsPage({ searchParams }: PageProps<'/settings'>) {
  const owner = await requireOwner();
  const { error } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data: claims }, workspace] = await Promise.all([supabase.auth.getClaims(), getWorkspace(owner)]);
  const email = (claims?.claims.email as string | undefined) ?? '';
  const displayName = ((claims?.claims.user_metadata as { display_name?: string } | undefined)?.display_name) ?? '';
  const icon = 'size-5';

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <h1 className="text-2xl font-semibold">Settings</h1>
      {typeof error === 'string' && (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      )}

      <Section icon={<User className={icon} />} title="Profile" description="How you appear in Roundabout.">
        <ActionForm compact action={updateDisplayNameAction} submitLabel="Save name">
          <Field name="displayName" label="Display name" defaultValue={displayName} autoComplete="name" />
        </ActionForm>
      </Section>

      <Section icon={<Mail className={icon} />} title="Email" description={`You sign in as ${email}.`}>
        <ActionForm compact action={changeEmailAction} submitLabel="Change email">
          <Field name="email" label="New email" type="email" autoComplete="email" />
          <p className="text-xs text-muted-foreground">
            We send a confirmation link to both addresses. The change applies once you confirm.
          </p>
        </ActionForm>
      </Section>

      <Section icon={<KeyRound className={icon} />} title="Password" description="Passwords are stored only as a bcrypt hash by Supabase Auth.">
        <ActionForm compact action={changePasswordAction} submitLabel="Change password">
          <Field name="currentPassword" label="Current password" type="password" autoComplete="current-password" />
          <Field name="newPassword" label="New password (8+ characters)" type="password" autoComplete="new-password" />
        </ActionForm>
      </Section>

      <Section icon={<Users className={icon} />} title="Workspace" description="Applies to every project in this workspace.">
        <ActionForm compact action={updateWorkspaceAction} submitLabel="Save workspace">
          <Field name="name" label="Workspace name" defaultValue={workspace.name} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="defaultRequireReview" defaultChecked={workspace.defaultRequireReview} className="mt-0.5 size-4 accent-primary" />
            <span>
              Require my review on new tasks by default
              <span className="block text-xs text-muted-foreground">You can still change it per task. Tasks agents create always need review.</span>
            </span>
          </label>
        </ActionForm>
      </Section>

      <Section danger icon={<ShieldAlert className={icon} />} title="Delete account" description="Removes your login, workspace, projects, boards, tasks, agents and history.">
        <div>
          <FormDialog trigger="Delete my account" title="Delete your account?" submitLabel="Delete everything" action={deleteAccountAction} variant="destructive" submitVariant="destructive">
            <p className="text-sm">
              This deletes your login and everything in <strong>{workspace.name}</strong>. Connected agents stop working immediately.
            </p>
            <Field name="confirm" label="Type DELETE to confirm" />
            <p className="text-sm font-medium">This can&apos;t be undone.</p>
          </FormDialog>
        </div>
      </Section>
    </div>
  );
}
