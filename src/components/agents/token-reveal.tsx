'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CLIENT_LABELS, setupSteps, type AgentClient } from '@/lib/agent-setup';

// navigator.clipboard is refused in some embedded browsers ("Document is not focused") and on plain http,
// so fall back to execCommand, and failing that select the text for a manual Ctrl+C.
async function copyText(text: string, el: HTMLElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.append(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    if (!ok && el) window.getSelection()?.selectAllChildren(el);
    return ok;
  }
}

function CopyBlock({ label, code }: { label?: string; code: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const ref = useRef<HTMLElement>(null);
  return (
    <div className="grid min-w-0 gap-1">
      {label && <span className="text-sm font-medium">{label}</span>}
      <div className="flex items-start gap-2">
        <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs"><code ref={ref}>{code}</code></pre>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => setState((await copyText(code, ref.current)) ? 'copied' : 'manual')}
        >
          {state === 'copied' ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {state === 'manual' && 'Your browser blocked copying. The text is selected: press Ctrl+C (⌘C on Mac).'}
      </span>
    </div>
  );
}

/** Shows a freshly issued token once, with numbered client setup. Never rendered from stored data. */
export function TokenReveal({ client, token, url }: { client: AgentClient; token: string; url: string }) {
  return (
    <div className="grid gap-5">
      <Alert>
        <AlertDescription>Copy this now. For your security, Roundabout won&apos;t show this token again.</AlertDescription>
      </Alert>
      <CopyBlock label="Your token" code={token} />
      <section className="grid gap-3">
        <h3 className="font-medium">Set up {CLIENT_LABELS[client]}</h3>
        <ol className="grid gap-4">
          {setupSteps(client, url, token).map((step, i) => (
            <li key={step.title} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 gap-y-2">
              <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {i + 1}
              </span>
              <div className="grid min-w-0 gap-2">
                <p className="pt-1 text-sm font-medium"><span className="sr-only">Step {i + 1}: </span>{step.title}</p>
                {step.blocks.map((b) => <CopyBlock key={b.code} label={b.label} code={b.code} />)}
                {step.note && <p className="text-sm text-muted-foreground">{step.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
