// Zod input schemas shared by server actions and MCP tools (technical-design-document.md §10).
import { z } from 'zod';
import { AppError } from '@/server/errors';

export const uuid = z.uuid('Invalid id.');
export const name = z.string().trim().min(1, 'Enter a name.').max(80, 'Use at most 80 characters.');

export const createProjectInput = z.object({ name });
export const renameProjectInput = z.object({ projectId: uuid, name });
export const createBoardInput = z.object({ projectId: uuid, name });
export const renameBoardInput = z.object({ boardId: uuid, name });
export const reorderBoardsInput = z.object({ projectId: uuid, boardIds: z.array(uuid).min(1) });

/** Parse or throw a VALIDATION AppError carrying the first issue's message. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new AppError('VALIDATION', result.error.issues[0].message, { issues: result.error.issues });
}

// ── Tasks ────────────────────────────────────────────────────────────────────
export const link = z.object({
  label: z.string().trim().max(200).default(''),
  url: z.url({ protocol: /^https?$/, error: 'Links must be http(s) URLs.' }).max(2048),
});
export const links = z.array(link).max(20, 'Use at most 20 links.');
const longText = z.string().max(20_000, 'Use at most 20,000 characters.');
const shortText = z.string().trim().max(1_000, 'Use at most 1,000 characters.');
const optionalText = z.string().trim().max(200).optional().transform((v) => (v ? v : null));
/** For patches: absent stays undefined (unchanged); empty string clears to null. */
const patchText = z.string().trim().max(200).optional().transform((v) => (v === undefined ? undefined : v || null));
const revision = z.coerce.number().int().positive();

export const title = z.string().trim().min(1, 'Enter a title.').max(200, 'Use at most 200 characters.');
export const createTaskInput = z.object({
  boardId: uuid,
  title,
  instructions: longText.default(''),
  expectedResult: longText.default(''),
  links: links.default([]),
  repository: optionalText,
  branch: optionalText,
  status: z.enum(['backlog', 'todo']).default('backlog'),
  assigneeAgentId: uuid.nullish(),
  requireReview: z.boolean().default(true),
});
export const updateTaskInput = z.object({
  taskId: uuid,
  expectedRevision: revision,
  title: title.optional(),
  instructions: longText.optional(),
  expectedResult: longText.optional(),
  links: links.optional(),
  repository: patchText,
  branch: patchText,
  requireReview: z.boolean().optional(),
  nextAction: shortText.optional(),
});
export const moveTaskStatusInput = z.object({ taskId: uuid, expectedRevision: revision, to: z.enum(['backlog', 'todo']) });
export const moveTaskBoardInput = z.object({ taskId: uuid, expectedRevision: revision, boardId: uuid });
export const assignTaskInput = z.object({ taskId: uuid, expectedRevision: revision, agentId: uuid.nullable() });

/** "label | https://…" or a bare URL per line → links. Blank lines are ignored. */
export function parseLinkLines(text: string): unknown[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [a, b] = line.split('|').map((s) => s.trim());
      return b ? { label: a, url: b } : { label: '', url: a };
    });
}

// ── Agents ───────────────────────────────────────────────────────────────────
export const agentClient = z.enum(['claude_code', 'codex', 'other']);
export const createAgentInput = z.object({ name, client: agentClient, projectIds: z.array(uuid).max(200).default([]) });
export const updateGrantsInput = z.object({ agentId: uuid, projectIds: z.array(uuid).max(200) });
export const agentIdInput = z.object({ agentId: uuid });

// ── Agent work (MCP) ─────────────────────────────────────────────────────────
export const requestId = z.string().trim().min(1).max(200).optional();
const body = z.string().trim().min(1, 'Write a message.').max(20_000);
export const acceptTaskInput = z.object({ taskId: uuid, requestId });
export const postUpdateInput = z.object({ taskId: uuid, body, nextAction: shortText.optional(), links: links.optional(), requestId });
export const postMessageInput = z.object({
  taskId: uuid,
  body,
  to: z.union([z.literal('owner'), uuid]).optional(),
  replyTo: uuid.optional(),
  kind: z.enum(['message', 'question']).default('message'),
  links: links.default([]),
  requestId,
});
export const listAssignmentsInput = z.object({ projectId: uuid.optional() });

// ── Handoffs and blockers ───────────────────────────────────────────────────
export const proposeHandoffInput = z.object({
  taskId: uuid,
  toAgentId: uuid,
  reason: shortText.pipe(z.string().min(1, 'Say why you are handing off.')),
  workCompleted: longText.pipe(z.string().trim().min(1, 'Summarise the work completed.')),
  nextAction: shortText.pipe(z.string().min(1, 'Say what the next agent should do.')),
  links: links.default([]),
  requestId,
});
export const respondHandoffInput = z.object({
  handoffId: uuid,
  decision: z.enum(['accept', 'decline']),
  reason: shortText.optional(),
  requestId,
});
export const handoffIdInput = z.object({ handoffId: uuid });
export const reportBlockerInput = z.object({
  taskId: uuid,
  reason: shortText.pipe(z.string().min(1, 'Say what is blocking you.')),
  question: shortText.pipe(z.string().min(1, 'Ask a specific question.')),
  needs: z.union([z.literal('owner'), uuid]).optional(),
  missingResource: shortText.optional(),
  requestId,
});
export const resolveBlockerInput = z.object({
  blockerId: uuid,
  resolution: shortText.pipe(z.string().min(1, 'Say how it was resolved.')),
  requestId,
});
