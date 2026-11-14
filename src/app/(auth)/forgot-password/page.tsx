import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requestPasswordReset } from '../actions';
import { Field } from '../fields';

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle><h1>Reset your password</h1></CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ActionForm action={requestPasswordReset} submitLabel="Send reset link">
          <Field name="email" label="Email" type="email" autoComplete="email" />
        </ActionForm>
        <p className="text-sm text-muted-foreground">
          <Link className="underline" href="/sign-in">Back to sign in</Link>
        </p>
      </CardContent>
    </Card>
  );
}
