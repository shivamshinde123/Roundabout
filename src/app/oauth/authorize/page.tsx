import { redirect } from 'next/navigation';
import { Orbit, ShieldCheck } from 'lucide-react';
import { ActionForm } from '@/components/action-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { currentUserId, requireOwner } from '@/server/auth';
import { listProjects } from '@/server/projects';
import { errorRedirect, guessClient, loadAuthorizeRequest, type AuthorizeRequest } from '@/server/oauth';
import { CLIENT_LABELS, type AgentClient } from '@/lib/agent-setup';
import { AgentAvatar } from '@/lib/visual';
import { approveAction, denyAction } from './actions';

export const metadata = { title: 'Connect an agent · Roundabout' };

/** OAuth consent for hosted connectors (D-35): the owner decides which projects the app's agent may use. */
export default async function AuthorizePage({ searchParams }: PageProps<'/oauth/authorize'>) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  if (!(await currentUserId())) {
    const back = `/oauth/authorize?${new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === 'string'))}`;
    redirect(`/sign-in?next=${encodeURIComponent(back)}`);
  }
  const owner = await requireOwner();
  const req: AuthorizeRequest = {
    clientId: one('client_id'), redirectUri: one('redirect_uri'), codeChallenge: one('code_challenge'),
    codeChallengeMethod: one('code_challenge_method'), responseType: one('response_type'), state: one('state') || null,
  };
  const loaded = await loadAuthorizeRequest(req);
  if (loaded.fatal === undefined && loaded.redirectError) redirect(errorRedirect(req.redirectUri, loaded.redirectError, req.state));

  const shell = (body: React.ReactNode) => (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="grid w-full max-w-md gap-5 rounded-xl border bg-panel p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="flex size-6 items-center justify-center rounded-md bg-[#2a2a2f] ring-1 ring-white/10"><Orbit aria-hidden className="size-4 text-white" /></span>
          Roundabout
        </div>
        {body}
      </div>
    </main>
  );
  if (loaded.fatal !== undefined) {
    return shell(<Alert variant="destructive"><AlertDescription>{loaded.fatal}</AlertDescription></Alert>);
  }

  const app = loaded.client.clientName;
  const client = guessClient(app, req.redirectUri) as AgentClient;
  const projects = await listProjects(owner);
  const hidden = (
    <>
      {Object.entries({
        client_id: req.clientId, redirect_uri: req.redirectUri, code_challenge: req.codeChallenge,
        code_challenge_method: req.codeChallengeMethod, response_type: req.responseType, state: req.state ?? '',
      }).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </>
  );

  return shell(
    <>
      <header className="grid gap-2">
        <div className="flex items-center gap-3">
          <AgentAvatar name={app} client={client} className="size-9 text-sm" />
          <h1 className="text-lg font-semibold leading-tight">{app} wants to work in Roundabout</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          It will connect as an agent: it can see and update tasks only in the projects you choose, and you can disconnect it at any time.
          It will return to <span className="text-foreground">{new URL(req.redirectUri).host}</span>.
        </p>
      </header>
      <ActionForm action={approveAction} submitLabel="Allow">
        {hidden}
        <div className="grid gap-2">
          <Label htmlFor="name">Agent name</Label>
          <Input id="name" name="name" defaultValue={CLIENT_LABELS[client] === 'Other agent' ? app : CLIENT_LABELS[client]} maxLength={80} required />
          <p className="text-xs text-muted-foreground">Shown on cards and in history. Must be unique among your agents.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="client">Client</Label>
          <select id="client" name="client" defaultValue={client} className="h-9 rounded-md border border-input bg-card px-2 text-sm">
            {Object.entries(CLIENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Projects it may use</legend>
          {projects.length === 0 && <p className="text-sm text-muted-foreground">No projects yet. You can grant access later on the agent’s page.</p>}
          {projects.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="projectIds" value={p.id} defaultChecked className="size-4 accent-primary" /> {p.name}
            </label>
          ))}
        </fieldset>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Roundabout never shares your password. The app gets its own revocable agent token.
        </p>
      </ActionForm>
      <ActionForm action={denyAction} submitLabel="Deny" submitVariant="outline">
        {hidden}
      </ActionForm>
    </>,
  );
}
