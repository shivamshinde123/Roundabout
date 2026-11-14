import 'server-only';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toErrorBody } from '../errors';
import { recordAgentError } from '../agents';
import { getTaskForAgent, listAssignments, listProjectAgents, toolTask } from '../agent-work';
import { postMessage, postUpdate } from '../messages';
import { listProjects } from '../projects';
import { acceptTask, createTask, queryCards } from '../tasks';
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
  const server = new McpServer({ name: 'roundabout', version: '0.1.0' });

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
        try {
          return ok(await run(args));
        } catch (e) {
          const error = toErrorBody(e);
          if (error.code === 'INTERNAL') await recordAgentError(actor.agentId, `${name}: ${error.message}`).catch(() => {});
          return { content: [{ type: 'text', text: JSON.stringify({ error }, null, 2) }], structuredContent: { error }, isError: true };
        }
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

  return server;
}
