'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { startTransition, useActionState, type FormEvent } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CLIENT_LABELS } from '@/lib/agent-setup';
import { AgentAvatar } from '@/lib/visual';
import { createAgentAction, rotateTokenAction, type TokenState } from '@/app/(app)/agents/actions';
import { TokenReveal } from './token-reveal';

function useTokenAction(action: typeof createAgentAction) {
  const [state, run, pending] = useActionState<TokenState, FormData>(action, undefined);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => run(data));
  };
  return { state, onSubmit, pending };
}

export function ConnectAgentForm({ projects }: { projects: { id: string; name: string }[] }) {
  const { state, onSubmit, pending } = useTokenAction(createAgentAction);
  if (state?.client && state.url && (state.token || state.oauth)) {
    return (
      <div className="grid gap-4">
        <h2 className="text-lg font-medium">
          Step 2 of 2 · {state.oauth ? 'Set up' : 'Copy your token and set up'} {CLIENT_LABELS[state.client]}
        </h2>
        {state.reusedName && (
          <Alert>
            <AlertDescription>
              You already had {CLIENT_LABELS[state.client]} connected as <strong>{state.reusedName}</strong>, so Roundabout refreshed that
              connection instead of adding a second one. Its old token has stopped working; set it up again with the steps below.
            </AlertDescription>
          </Alert>
        )}
        <TokenReveal client={state.client} token={state.token} url={state.url} />
        {state.agentId && (
          <Button asChild variant="outline" className="justify-self-start"><Link href={`/agents/${state.agentId}`}>Go to the agent&apos;s page <ChevronRight aria-hidden /></Link></Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <h2 className="text-lg font-medium">Step 1 of 2 · Choose the agent and its access</h2>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Client</legend>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
          {Object.entries(CLIENT_LABELS).map(([value, label], i) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:border-[#3a3a40] has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input type="radio" name="client" value={value} defaultChecked={i === 0} className="sr-only" />
              <AgentAvatar name={label} client={value} className="size-6" />
              <span className="truncate">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-2">
        <Label htmlFor="agent-name">Connection name</Label>
        <Input id="agent-name" name="name" placeholder="e.g. Claude Code – laptop" maxLength={80} />
        <p className="text-xs text-muted-foreground">Defaults to the client name. Names tell your agents apart on the board.</p>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Projects this agent may use</legend>
        {projects.length === 0 && <p className="text-sm text-muted-foreground">No projects yet — you can grant access later.</p>}
        {projects.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="projectIds" value={p.id} defaultChecked className="size-4 accent-primary" /> {p.name}
          </label>
        ))}
      </fieldset>
      <div role="status" aria-live="polite">
        {state?.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create connection'}</Button>
    </form>
  );
}

export function ReconnectForm({ agentId, client }: { agentId: string; client: string }) {
  const { state, onSubmit, pending } = useTokenAction(rotateTokenAction);
  if (state?.token && state.client && state.url) return <TokenReveal client={state.client} token={state.token} url={state.url} />;
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <input type="hidden" name="agentId" value={agentId} />
      <input type="hidden" name="client" value={client} />
      <p className="text-sm text-muted-foreground">Issues a new token. The current token stops working immediately.</p>
      <div role="status" aria-live="polite">
        {state?.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
      </div>
      <Button type="submit" variant="outline" disabled={pending}>{pending ? 'Issuing…' : 'Issue a new token'}</Button>
    </form>
  );
}
