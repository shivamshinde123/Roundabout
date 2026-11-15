import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { call, rpc } from './mcp-client';
import { db } from '@/server/db/client';
import { tasks } from '@/server/db/schema';
import { createAgentConnection } from '@/server/agents';
import { createProject } from '@/server/projects';
import { createTask } from '@/server/tasks';
import { requestChanges } from '@/server/results';
import { seedOwner } from './helpers';

type Update = { type: string; summary: string; detail: string | null; task: { title: string } | null };

describe('agent updates (D-41)', () => {
  it('list_updates returns only what concerns me, from others, once; other replies carry the note', async () => {
    const owner = await seedOwner();
    const a = await createProject(owner, { name: 'Website' });
    const claude = await createAgentConnection(owner, { name: 'Claude Code', client: 'claude_code', projectIds: [a.project.id] });
    const codex = await createAgentConnection(owner, { name: 'Codex', client: 'codex', projectIds: [a.project.id] });

    const mine = await createTask(owner, { boardId: a.board.id, title: 'Hero section', status: 'todo', assigneeAgentId: claude.agent.id });
    await createTask(owner, { boardId: a.board.id, title: 'Not mine', status: 'todo', assigneeAgentId: codex.agent.id });

    const first = await call(claude.token, 'list_updates');
    expect(first.data.updates.map((u: Update) => u.task?.title)).toEqual(['Hero section', 'Hero section']);
    expect(first.data.updates[1].summary).toBe('Owner assigned it on "Hero section"');
    expect((await call(claude.token, 'list_updates')).data.updates).toEqual([]);

    // My own actions never come back to me.
    await call(claude.token, 'accept_task', { task_id: mine.id });
    const submitted = await call(claude.token, 'submit_result', { task_id: mine.id, summary: 'PR #1' });
    expect((await call(claude.token, 'list_updates')).data.updates).toEqual([]);

    // The owner requests changes and Codex messages me: the next reply of any tool carries the note.
    const [t] = await db.select().from(tasks).where(eq(tasks.id, mine.id));
    await requestChanges(owner, { resultId: submitted.data.result.id, expectedRevision: t.revision, comment: 'Add mobile layout' });
    await call(codex.token, 'post_message', { task_id: mine.id, to: claude.agent.id, body: 'I can take the footer' });

    const reply = (await rpc(claude.token, 'tools/call', { name: 'whoami', arguments: {} })).body.result;
    expect(reply.content[1].text).toMatch(/^📬 \d+ new updates for you/);
    expect(reply.structuredContent.pending_updates).toBeGreaterThan(0);

    const next = await call(claude.token, 'list_updates');
    const types = next.data.updates.map((u: Update) => u.type);
    expect(types).toEqual(expect.arrayContaining(['review.changes_requested', 'message.posted']));
    expect(next.data.updates.map((u: Update) => u.detail)).toEqual(expect.arrayContaining(['Changes requested: Add mobile layout', 'I can take the footer']));

    // Once read, the note goes away.
    const quiet = (await rpc(claude.token, 'tools/call', { name: 'whoami', arguments: {} })).body.result;
    expect(quiet.content).toHaveLength(1);
    expect(quiet.structuredContent.pending_updates).toBeUndefined();
  });
});
