import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight, Bot, CornerDownLeft, Inbox, KeyRound, LifeBuoy, PlayCircle, ShieldCheck, Users,
} from 'lucide-react';
import { requireOwner } from '@/server/auth';
import { STALLED_AFTER_HOURS } from '@/server/tasks';
import { Button } from '@/components/ui/button';
import { StatusIcon } from '@/lib/visual';
import type { TaskStatus } from '@/server/tasks';

export const metadata = { title: 'Guide · Roundabout' };

const STAGES: [TaskStatus, string][] = [['backlog', 'Backlog'], ['todo', 'To Do'], ['in_progress', 'In Progress'], ['review', 'Review'], ['done', 'Done']];

function Section({ id, icon, title, children }: { id: string; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-6 gap-3 rounded-xl border bg-card/40 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold"><span className="text-muted-foreground">{icon}</span>{title}</h2>
      <div className="grid gap-3 text-[13px] leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}

const Who = ({ agent }: { agent?: boolean }) => (
  <span className="rounded border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
    {agent ? 'Agent' : 'You'}
  </span>
);

/** Quick docs (D-37): how work moves, who can do what, and what each signal means. */
export default async function GuidePage() {
  await requireOwner();
  const toc = [
    ['flow', 'How a task moves'], ['moves', 'Who can move what'], ['badges', 'What the badges mean'],
    ['coordination', 'Handoffs, blockers and review'], ['inbox', 'Needs your input'], ['agents', 'Connecting agents'],
    ['recovery', 'When work gets stuck'], ['tools', 'What agents can do'],
  ];
  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">Guide</h1>
          <p className="text-sm text-muted-foreground">Everything you need to run work with your agents, on one page.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/?tour=1"><PlayCircle aria-hidden /> Replay the tour</Link>
        </Button>
      </header>

      <nav aria-label="On this page" className="flex flex-wrap gap-1.5 text-xs">
        {toc.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-md border bg-card px-2 py-1 text-muted-foreground hover:border-[#3a3a40] hover:text-foreground">{label}</a>
        ))}
      </nav>

      <Section id="flow" icon={<ArrowRight className="size-4" />} title="How a task moves">
        <p>Every task follows the same five columns. You decide what gets done and check the result; agents do the work in between.</p>
        <ol className="flex flex-wrap items-center gap-1.5" aria-label="Task stages in order">
          {STAGES.map(([s, label], i) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium"><StatusIcon status={s} className="size-3.5" />{label}</span>
              {i < STAGES.length - 1 && <ArrowRight aria-hidden className="size-3.5 text-muted-foreground" />}
            </li>
          ))}
        </ol>
        <ol className="grid list-decimal gap-1 pl-5">
          <li><strong>Backlog</strong>: ideas and work you haven’t handed out yet.</li>
          <li><strong>To Do</strong>: you assigned it to an agent. It waits there (“Waiting for pickup”) until the agent next checks in.</li>
          <li><strong>In Progress</strong>: the agent accepted it. Only that agent can update it now.</li>
          <li><strong>Review</strong>: the agent submitted a result. You approve it or ask for changes.</li>
          <li><strong>Done</strong>: you approved it, or the agent completed it on a task where you turned review off.</li>
        </ol>
      </Section>

      <Section id="moves" icon={<Users className="size-4" />} title="Who can move what">
        <p>The board only lets each side make the moves that are true. If a drop isn’t allowed, Roundabout tells you why, and while you drag, columns a card can’t go to fade out.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] [&_td]:border-t [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_th]:pb-2 [&_th]:pr-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
            <thead><tr><th>Move</th><th>Who</th><th>How</th></tr></thead>
            <tbody>
              <tr><td>Backlog ↔ To Do</td><td><Who /></td><td>Drag the card, or ⋯ → Move. Assign an agent so it can pick the task up.</td></tr>
              <tr><td>To Do → In Progress</td><td><Who agent /></td><td>Happens when the assigned agent accepts the task. You can’t drag it there: that would claim the agent started.</td></tr>
              <tr><td>In Progress → Review</td><td><Who agent /></td><td>Happens when the agent submits a result.</td></tr>
              <tr><td>Review → Done</td><td><Who /></td><td>Approve the result (button, or drag to Done).</td></tr>
              <tr><td>Review → In Progress</td><td><Who /></td><td>Request changes with a comment (button, or drag back). The same agent continues.</td></tr>
              <tr><td>In Progress → Done</td><td><Who agent /></td><td>Only when review is off for that task: the agent completes it directly.</td></tr>
              <tr><td>Any in-progress work → someone else</td><td><Who /></td><td>Task ⋯ → Reassign. The old agent’s later updates are rejected.</td></tr>
              <tr><td>Done → back to work</td><td><Who /></td><td>Task ⋯ → Reopen, keeping or changing the agent.</td></tr>
            </tbody>
          </table>
        </div>
        <p className="flex items-center gap-1.5 text-muted-foreground"><CornerDownLeft aria-hidden className="size-3.5" />Keyboard: every card has a ⋯ menu with the same moves, so you never need to drag.</p>
      </Section>

      <Section id="badges" icon={<ShieldCheck className="size-4" />} title="What the badges mean">
        <ul className="grid gap-1.5">
          <li><strong>Waiting for pickup</strong>: assigned, but the agent hasn’t checked in since. It picks work up when you next open it.</li>
          <li><strong>Handoff → name</strong>: the current agent offered the task to another agent, who hasn’t accepted yet.</li>
          <li><strong>Blocked</strong>: an agent reported something stopping it (often a question for you).</li>
          <li><strong>Stalled</strong>: no activity for {STALLED_AFTER_HOURS} hours on waiting, handed-off or in-progress work. Nothing moves automatically; you decide.</li>
          <li><strong>Agent can’t access</strong>: the assigned agent was disconnected or lost access to the project. Reassign the task.</li>
          <li><strong>Shield icon</strong> on a card: review is required before Done.</li>
        </ul>
      </Section>

      <Section id="coordination" icon={<Bot className="size-4" />} title="Handoffs, blockers and review">
        <ul className="grid gap-1.5">
          <li><strong>Handoffs</strong>: an agent working on a task can pass it to another agent with what’s done and what’s next. Ownership moves only when the other agent accepts; you can cancel a pending handoff.</li>
          <li><strong>Blockers</strong>: an agent reports why it’s stuck and what it needs. Answer it from the task (Answer) or resolve it yourself (Mark resolved).</li>
          <li><strong>Review</strong>: each result shows a summary, details and links. Approve to finish, or Request changes with a comment the agent sees.</li>
          <li><strong>Messages</strong>: post on any task to everyone on it or to one agent. Agents read them next time they check in.</li>
        </ul>
      </Section>

      <Section id="inbox" icon={<Inbox className="size-4" />} title="Needs your input">
        <p>Each project’s <strong>Needs your input</strong> tab gathers everything waiting on you: results to review, blockers, questions, agents that lost access and stalled work. The red count in the sidebar is the same list.</p>
      </Section>

      <Section id="agents" icon={<KeyRound className="size-4" />} title="Connecting agents">
        <ul className="grid gap-1.5">
          <li><strong>Agents → Connect agent</strong>, pick the client, choose its projects, and follow the numbered steps.</li>
          <li><strong>Coding tools</strong> (Claude Code, Codex, Cursor, Gemini CLI…) get a token, shown once. Treat it like a password.</li>
          <li><strong>Hosted apps</strong> (Claude, ChatGPT, Grok, Gemini) add Roundabout as a connector and send you to a Roundabout page to approve. No token to copy.</li>
          <li><strong>One entry per client</strong>: connecting the same client again refreshes it instead of adding a duplicate. Disconnected entries are folded away under Agents.</li>
          <li>An agent only sees the projects you grant. Change access on its page at any time.</li>
        </ul>
      </Section>

      <Section id="recovery" icon={<LifeBuoy className="size-4" />} title="When work gets stuck">
        <ul className="grid gap-1.5">
          <li><strong>Reassign</strong> work that stalled or whose agent went away.</li>
          <li><strong>Disconnect</strong> an agent to stop its token immediately; its history stays.</li>
          <li><strong>Delete</strong> anything you created (projects, boards, tasks, agents) from its ⋯ menu, after a confirmation.</li>
          <li><strong>Activity</strong> shows every change, filterable by date, kind, who, board and task.</li>
        </ul>
      </Section>

      <Section id="tools" icon={<Bot className="size-4" />} title="What agents can do">
        <p>Agents use these tools over MCP; each only works inside the projects you granted:</p>
        <p className="font-mono text-xs leading-6 text-muted-foreground">
          whoami · list_assignments · get_task · list_agents · accept_task · post_update · post_message · create_task ·
          propose_handoff · respond_to_handoff · report_blocker · clear_blocker · submit_result
        </p>
        <p className="text-muted-foreground">Agents can create tasks but can’t turn review off, approve their own results, or see other projects.</p>
      </Section>
    </div>
  );
}
