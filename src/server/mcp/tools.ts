import 'server-only';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toErrorBody } from '../errors';
import { recordAgentError } from '../agents';
import { getTaskForAgent, listAssignments, listProjectAgents, toolTask } from '../agent-work';
import { postMessage, postUpdate } from '../messages';
import { proposeHandoff, respondToHandoff } from '../handoffs';
import { clearBlocker, reportBlocker } from '../blockers';
import { submitResult } from '../results';
import { listProjects } from '../projects';
import { acceptTask, createTask, queryCards } from '../tasks';
import { listUpdates, pendingUpdatesNote } from '../updates';
import { tasks } from '../db/schema';
import type { AgentActor } from '../policy';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { agentConnections } from '../db/schema';

const agentName = async (id: string) =>
  (await db.select({ name: agentConnections.name }).from(agentConnections).where(eq(agentConnections.id, id)))[0]?.name;

type ToolResult = { content: { type: 'text'; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };

/** Tool results are always JSON objects, returned both as text and as structuredContent. */
const ok = (data: object): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  structuredContent: data as Record<string, unknown>,
});

/** Thin adapters: parse (SDK), call the service, map errors. No business rules here (coding-conventions.md). */
export function buildMcpServer(actor: AgentActor) {
  const server = new McpServer({ name: 'roundabout', version: '0.1.0' }, {
    instructions:
      'Roundabout is a shared task board. Call list_assignments when you start. Call list_updates before you start a task and before you submit a result, ' +
      'and whenever a tool reply says new updates are waiting: they tell you about changes requested, approvals, handoffs and messages for you.',
  });

  /** Append the "new updates" nudge to a reply (D-41). Best effort: a failure here never breaks the tool. */
  const withNote = async (result: ToolResult): Promise<ToolResult> => {
    const note = await pendingUpdatesNote(actor).catch(() => null);
    if (!note) return result;
    return {
      ...result,
      content: [...result.content, { type: 'text', text: note.text }],
      structuredContent: { ...result.structuredContent, pending_updates: note.count },
    };
  };

  const tool = <S extends z.ZodRawShape>(
    name: string,
    description: string,
    inputSchema: S,
    run: (args: z.infer<z.ZodObject<S>>) => Promise<object>,
    readOnly = false,
  ) =>
    server.registerTool(
      name,
      { description, inputSchema, annotations: { readOnlyHint: readOnly } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (async (args: any) => {
        let result: ToolResult;
        try {
          result = ok(await run(args));
        } catch (e) {
          const error = toErrorBody(e);
          if (error.code === 'INTERNAL') await recordAgentError(actor.agentId, `${name}: ${error.message}`).catch(() => {});
          result = { content: [{ type: 'text', text: JSON.stringify({ error }, null, 2) }], structuredContent: { error }, isError: true };
        }
        return name === 'list_updates' ? result : withNote(result);
      }) as never,
    );

  const requestId = z.string().max(200).optional().describe('Client-generated id; repeating it replays the first result instead of acting twice.');
  const taskId = z.string().describe('Task id');
  const links = z.array(z.object({ label: z.string().optional(), url: z.string() })).optional();

  tool('whoami', 'Check the connection: who you are in Roundabout and which projects and boards you can use.', {}, async () => ({
    agent: { id: actor.agentId, name: await agentName(actor.agentId) },
    projects: (await listProjects(actor)).map((p) => ({ id: p.id, name: p.name, boards: p.boards })),
  }), true);

  tool(
    'list_assignments',
    'Your work: tasks waiting for you to accept, tasks you own in progress, handoffs offered to you, and unread messages. Call this when you start.',
    { project_id: z.string().optional() },
    (a) => listAssignments(actor, { projectId: a.project_id }),
    true,
  );

  tool(
    'list_updates',
    'What changed for you since you last called this: changes requested or approved on your tasks, handoffs to or from you, reassignments, and messages to you. Oldest first; each update is shown once. Call it before starting or submitting work, and whenever a reply says updates are waiting.',
    {},
    () => listUpdates(actor),
  );

  tool('get_task', 'Full task: instructions, links, repo/branch, messages and history. Marks messages to you as read.', { task_id: taskId },
    (a) => getTaskForAgent(actor, a.task_id));

  tool('list_agents', 'Other agents with access to a project (for handoffs or messages).', { project_id: z.string() },
    async (a) => ({ agents: await listProjectAgents(actor, a.project_id) }), true);

  tool('accept_task', 'Accept a task assigned to you in To Do. It moves to In Progress and you own it.', { task_id: taskId, request_id: requestId },
    async (a) => {
      await acceptTask(actor, { taskId: a.task_id, requestId: a.request_id });
      const [card] = await queryCards(eq(tasks.id, a.task_id));
      return toolTask(card);
    });

  tool(
    'post_update',
    'Post progress on a task you own. Optionally set the next action shown on the board card.',
    { task_id: taskId, body: z.string(), next_action: z.string().optional(), links, request_id: requestId },
    (a) => postUpdate(actor, { taskId: a.task_id, body: a.body, nextAction: a.next_action, links: a.links, requestId: a.request_id }),
  );

  tool(
    'post_message',
    "Message about a task. `to` is 'owner' or an agent id. Use kind 'question' to ask the owner something (it appears in their Needs your input). `reply_to` answers a message.",
    {
      task_id: taskId, body: z.string(), to: z.string().optional(), reply_to: z.string().optional(),
      kind: z.enum(['message', 'question']).optional(), links, request_id: requestId,
    },
    (a) => postMessage(actor, { taskId: a.task_id, body: a.body, to: a.to, replyTo: a.reply_to, kind: a.kind, links: a.links, requestId: a.request_id }),
  );

  tool(
    'create_task',
    'Create a follow-up task on a board you can access, optionally assigned to an agent with access. Review by the owner is always required.',
    {
      board_id: z.string(), title: z.string(), instructions: z.string().optional(), expected_result: z.string().optional(),
      links, repository: z.string().optional(), branch: z.string().optional(),
      status: z.enum(['backlog', 'todo']).optional(), assignee_agent_id: z.string().optional(), request_id: requestId,
    },
    async (a) => {
      const task = await createTask(actor, {
        boardId: a.board_id, title: a.title, instructions: a.instructions, expectedResult: a.expected_result, links: a.links,
        repository: a.repository, branch: a.branch, status: a.status, assigneeAgentId: a.assignee_agent_id,
      });
      const [card] = await queryCards(eq(tasks.id, task.id));
      return toolTask(card);
    },
  );

  tool(
    'propose_handoff',
    'Offer a task you own to another agent with access to the project (see list_agents). You stay the owner until they accept. Include what you did and what is next.',
    {
      task_id: taskId, to_agent_id: z.string(), reason: z.string(), work_completed: z.string(), next_action: z.string(),
      links, request_id: requestId,
    },
    (a) => proposeHandoff(actor, {
      taskId: a.task_id, toAgentId: a.to_agent_id, reason: a.reason, workCompleted: a.work_completed,
      nextAction: a.next_action, links: a.links, requestId: a.request_id,
    }),
  );

  tool(
    'respond_to_handoff',
    "Accept or decline a handoff offered to you (from list_assignments.handoffs_to_me). Accepting makes you the task's owner.",
    { handoff_id: z.string(), decision: z.enum(['accept', 'decline']), reason: z.string().optional(), request_id: requestId },
    (a) => respondToHandoff(actor, { handoffId: a.handoff_id, decision: a.decision, reason: a.reason, requestId: a.request_id }),
  );

  tool(
    'report_blocker',
    "Report what blocks a task you own, with a specific question. The owner sees it in Needs your input. `needs` is 'owner' (default) or an agent id; name any missing access in `missing_resource`.",
    {
      task_id: taskId, reason: z.string(), question: z.string(), needs: z.string().optional(),
      missing_resource: z.string().optional(), request_id: requestId,
    },
    (a) => reportBlocker(actor, {
      taskId: a.task_id, reason: a.reason, question: a.question, needs: a.needs, missingResource: a.missing_resource, requestId: a.request_id,
    }),
  );

  tool(
    'clear_blocker',
    'Clear a blocker on a task you own once you are unblocked, saying how it was resolved.',
    { blocker_id: z.string(), resolution: z.string(), request_id: requestId },
    (a) => clearBlocker(actor, { blockerId: a.blocker_id, resolution: a.resolution, requestId: a.request_id }),
  );

  tool(
    'submit_result',
    "Submit your result for a task you own: a one-line summary (shown on the card), details and links (PRs, commits). If the owner requires review it goes to Review; otherwise it's Done.",
    { task_id: taskId, summary: z.string(), details: z.string().optional(), links, request_id: requestId },
    (a) => submitResult(actor, { taskId: a.task_id, summary: a.summary, details: a.details, links: a.links, requestId: a.request_id }),
  );

  return server;
}
