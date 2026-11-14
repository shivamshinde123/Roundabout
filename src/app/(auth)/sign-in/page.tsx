import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { isGoogleSignInEnabled } from '@/lib/supabase/server';
import { signIn, signInWithGoogle } from '../actions';
import { Field } from '@/components/field';

export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  const { error, notice } = await searchParams;
  const google = await isGoogleSignInEnabled();
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
        {google && (
          <>
            <ActionForm action={signInWithGoogle} submitLabel="Continue with Google" />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Separator className="flex-1" /> or <Separator className="flex-1" />
            </div>
          </>
        )}
        <ActionForm action={signIn} submitLabel="Sign in">
          <Field name="email" label="Email" type="email" autoComplete="email" />
          <Field name="password" label="Password" type="password" autoComplete="current-password" />
        </ActionForm>
        <p className="text-sm text-muted-foreground">
          <Link className="underline" href="/forgot-password">Forgot password?</Link>
          {' · '}
          <Link className="underline" href="/sign-up">Create account</Link>
        </p>
      </CardContent>
    </Card>
  );
}
