import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { idempotencyKeys } from './db/schema';
import type { Tx } from './db/client';
import type { Actor } from './policy';
import { AppError } from './errors';

/**
 * Run `operation` at most once per (agent, requestId) — technical-design-document.md §5.
 * Must be called inside the transaction that performs the write. A concurrent duplicate blocks
 * on the primary key until the first commits, then replays the stored response.
 * ponytail: keys are never cleaned up; add a 7-day delete job if the table grows.
 */
export async function once<T>(
  tx: Tx,
  actor: Actor,
  requestId: string | undefined,
  operation: string,
  run: () => Promise<T>,
): Promise<T> {
  if (!requestId || actor.kind !== 'agent') return run();

  const claimed = await tx
    .insert(idempotencyKeys)
    .values({ agentConnectionId: actor.agentId, key: requestId, operation, response: sql`'null'::jsonb` })
    .onConflictDoNothing()
    .returning({ key: idempotencyKeys.key });

  if (claimed.length === 0) {
    const [prior] = await tx
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.agentConnectionId, actor.agentId), eq(idempotencyKeys.key, requestId)));
    if (prior.operation !== operation) {
      throw new AppError('VALIDATION', `request_id was already used for ${prior.operation}.`);
    }
    return prior.response as T;
  }

  const result = await run();
  await tx
    .update(idempotencyKeys)
    .set({ response: result as unknown as object })
    .where(and(eq(idempotencyKeys.agentConnectionId, actor.agentId), eq(idempotencyKeys.key, requestId)));
  return result;
}
