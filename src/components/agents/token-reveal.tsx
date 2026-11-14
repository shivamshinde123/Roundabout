'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { setupSnippets, type AgentClient } from '@/lib/agent-setup';

function CopyBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs"><code>{code}</code></pre>
    </div>
  );
}

/** Shows a freshly issued token once, with ready-to-paste client setup. Never rendered from stored data. */
export function TokenReveal({ client, token, url }: { client: AgentClient; token: string; url: string }) {
  return (
    <div className="grid gap-4">
      <Alert>
        <AlertDescription>Copy this now. For your security, Roundabout won&apos;t show this token again.</AlertDescription>
      </Alert>
      <CopyBlock label="Token" code={token} />
      {setupSnippets(client, url, token).map((s) => (
        <CopyBlock key={s.label} label={s.label} code={s.code} />
      ))}
      <p className="text-sm text-muted-foreground">
        Then ask the agent to call Roundabout&apos;s <code>whoami</code> tool. The agent shows as Active after its first successful request.
      </p>
    </div>
  );
}
