import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { signUp } from '../actions';
import { Field } from '@/components/field';

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle><h1>Create your account</h1></CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ActionForm action={signUp} submitLabel="Create account">
          <Field name="email" label="Email" type="email" autoComplete="email" />
          <Field name="password" label="Password (8+ characters)" type="password" autoComplete="new-password" />
        </ActionForm>
        <p className="text-sm text-muted-foreground">
          Already have an account? <Link className="underline" href="/sign-in">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  );
}
