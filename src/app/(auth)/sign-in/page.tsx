import Link from 'next/link';
import { textLinkClass } from '@/components/link-chip';
import { ActionForm } from '@/components/action-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { signIn } from '../actions';
import { Field } from '@/components/field';

export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  const { error, notice, next } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle><h1>Sign in</h1></CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {typeof error === 'string' && (
          <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
        )}
        {typeof notice === 'string' && (
          <Alert><AlertDescription>{notice}</AlertDescription></Alert>
        )}
        <ActionForm action={signIn} submitLabel="Sign in">
          {typeof next === 'string' && <input type="hidden" name="next" value={next} />}
          <Field name="email" label="Email" type="email" autoComplete="email" />
          <Field name="password" label="Password" type="password" autoComplete="current-password" />
        </ActionForm>
        <p className="text-sm text-muted-foreground">
          <Link className={textLinkClass} href="/forgot-password">Forgot password?</Link>
          {' · '}
          <Link className={textLinkClass} href="/sign-up">Create account</Link>
        </p>
      </CardContent>
    </Card>
  );
}
