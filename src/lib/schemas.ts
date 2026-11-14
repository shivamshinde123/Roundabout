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
