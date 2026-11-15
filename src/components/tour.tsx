'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { finishTourAction } from '@/app/(app)/settings/actions';

type Step = { target?: string; title: string; body: string };

// Steps whose target isn't on the current page are skipped, so the tour works from any landing page (D-37).
const STEPS: Step[] = [
  { title: 'Welcome to Roundabout', body: 'Hand tasks to your AI coding agents and follow every pickup, handoff, blocker and result on one board. This quick tour shows where things are.' },
  { target: 'new-project', title: 'Start with a project', body: 'A project holds one or more boards of tasks. Create one here; you can add boards later from the project’s ⋯ menu.' },
  { target: 'projects', title: 'Your projects', body: 'Every project you own. A red number means something is waiting on you there.' },
  { target: 'stages', title: 'Where work stands', body: 'Counts per column across the project’s boards: Backlog, To Do, In Progress, Review and Done.' },
  { target: 'needs-input', title: 'Needs your input', body: 'Results to review, blockers, questions from agents and stalled work collect here, so nothing slips.' },
  { target: 'agents', title: 'Agents on this project', body: 'Which agents can work here, when they last checked in, and how much they’re holding.' },
  { target: 'nav-agents', title: 'Connect your agents', body: 'Connect Claude Code, Codex, Cursor, ChatGPT, Claude and more. Each gets access only to the projects you choose.' },
  { target: 'nav-guide', title: 'The guide', body: 'Who can move a task where, what each badge means, and how handoffs, blockers and review work. Replay this tour from there anytime.' },
  { target: 'account', title: 'You and your settings', body: 'Your name, email, password and workspace settings live behind this card.' },
];

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 6;
const find = (target?: string) => (target ? document.querySelector<HTMLElement>(`[data-tour="${target}"]`) : null);
const noop = () => () => {};

/** Mounts the tour for first-time owners, and again whenever the Guide links here with ?tour=1. */
const SEEN_KEY = 'roundabout.tourSeen';
const seenLocally = () => { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };

export function Tour({ firstRun }: { firstRun: boolean }) {
  const replay = useSearchParams().get('tour') === '1';
  // The account flag can lag a page behind its session token, so the browser remembers a skip too.
  const seen = useSyncExternalStore(noop, seenLocally, () => false);
  if (!replay && (!firstRun || seen)) return null;
  // A new key restarts the tour from step 1 on each replay.
  return <TourSteps key={replay ? 'replay' : 'first'} replay={replay} />;
}

function TourSteps({ replay }: { replay: boolean }) {
  const router = useRouter();
  const path = usePathname();
  // DOM-dependent, so only after hydration (no server/client mismatch, no setState in an effect).
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [open, setOpen] = useState(true);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const steps = mounted ? STEPS.filter((s) => !s.target || find(s.target)) : [];
  const step = steps[Math.min(i, steps.length - 1)];

  const targetName = step?.target;
  useEffect(() => {
    if (!open || !targetName) return;
    const measure = () => {
      const r = find(targetName)?.getBoundingClientRect();
      setRect(r ? { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 } : null);
    };
    find(targetName)?.scrollIntoView({ block: 'center', behavior: 'instant' });
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, targetName]);

  // Move focus to the primary button on every step, for keyboard and screen-reader users.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => nextRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, i]);

  const finish = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode: the account flag still applies */ }
    void finishTourAction();
    if (replay) router.replace(path);
  }, [replay, router, path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, finish]);

  if (!open || !step) return null;
  const index = steps.indexOf(step);
  const last = index === steps.length - 1;
  const target = step.target ? rect : null;

  // Card goes right of sidebar targets, otherwise below the target (or above when there's no room).
  const card: React.CSSProperties = (() => {
    if (!target) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    const w = 320;
    if (target.left < 260 && target.left + target.width + w + 24 < window.innerWidth) {
      return { top: Math.max(12, Math.min(target.top, window.innerHeight - 220)), left: target.left + target.width + 12 };
    }
    const below = target.top + target.height + 12;
    const left = Math.max(12, Math.min(target.left, window.innerWidth - w - 12));
    return below + 200 < window.innerHeight ? { top: below, left } : { top: Math.max(12, target.top - 212), left };
  })();

  return (
    <div className="fixed inset-0 z-50">
      {target ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-lg ring-2 ring-primary transition-all duration-200 motion-reduce:transition-none"
          style={{ ...target, boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)' }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/60" />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="fixed grid w-80 gap-3 rounded-xl border bg-popover p-4 shadow-2xl"
        style={card}
      >
        <p className="text-xs text-muted-foreground">Step {index + 1} of {steps.length}</p>
        <h2 id="tour-title" className="text-base font-semibold">{step.title}</h2>
        <p id="tour-body" className="text-sm leading-relaxed text-foreground/85">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish} className="text-muted-foreground">Skip tour</Button>
          <div className="flex gap-2">
            {index > 0 && <Button variant="outline" size="sm" onClick={() => setI(index - 1)}>Back</Button>}
            <Button ref={nextRef} size="sm" onClick={() => (last ? finish() : setI(index + 1))}>{last ? 'Done' : 'Next'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
