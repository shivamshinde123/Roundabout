import { ActionForm } from '@/components/action-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createSupabaseServerClient, isGoogleSignInEnabled } from '@/lib/supabase/server';
import { requireOwner } from '@/server/auth';
import { linkGoogle } from './actions';

export default async function SettingsPage({ searchParams }: PageProps<'/settings'>) {
  await requireOwner();
  const { error } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: user } = await supabase.auth.getUser();
  const { data: ids } = await supabase.auth.getUserIdentities();
  const google = await isGoogleSignInEnabled();
  const providers = new Set((ids?.identities ?? []).map((i) => i.provider));

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      {typeof error === 'string' && (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle><h2>Sign-in methods</h2></CardTitle>
          <CardDescription>Signed in as {user.user?.email}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p>Email and password: {providers.has('email') ? 'Linked' : 'Not set up'}</p>
          <p>Google: {providers.has('google') ? 'Linked' : google ? 'Not linked' : 'Not available yet'}</p>
          {google && !providers.has('google') && <ActionForm action={linkGoogle} submitLabel="Link Google account" />}
        </CardContent>
      </Card>
    </div>
  );
}
