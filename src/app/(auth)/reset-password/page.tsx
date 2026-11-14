import { ActionForm } from '@/components/action-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { updatePassword } from '../actions';
import { Field } from '../fields';

// Reached from the recovery email via /auth/callback, which signs the user in first.
export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle><h1>Choose a new password</h1></CardTitle>
      </CardHeader>
      <CardContent>
        <ActionForm action={updatePassword} submitLabel="Save password">
          <Field name="password" label="New password (8+ characters)" type="password" autoComplete="new-password" />
        </ActionForm>
      </CardContent>
    </Card>
  );
}
