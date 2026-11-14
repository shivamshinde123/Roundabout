# Coding conventions

## General

- TypeScript `strict`, no `any`. Prefer `unknown` plus Zod parsing at boundaries.
- Use the smallest change that works. Add no abstraction until a second real use exists.
- Formatting: Prettier defaults. Linting: the ESLint CLI with `eslint-config-next`, run as `npm run lint`. Type-check with `npm run typecheck`, which runs `next typegen` and then `tsc`. Next.js 16 removed `next lint`. Neither is debated in review.
- Naming: files `kebab-case.ts`, React components `PascalCase.tsx`, functions `camelCase`, database columns `snake_case`. Drizzle maps them to `camelCase` in TypeScript.

## Service functions (`src/server/*`)

```ts
export async function acceptTask(actor: Actor, input: AcceptTaskInput): Promise<TaskSummary> {
  return db.transaction(async (tx) => {
    const task = await lockTask(tx, input.taskId);
    policy.assertProjectAccess(actor, task.projectId);
    if (task.status !== 'todo' || task.assigneeAgentId !== agentIdOf(actor))
      throw new AppError('CONFLICT', 'Task was already accepted or reassigned.', { task: summarize(task) });
    // …write, then:
    await events.append(tx, actor, task, 'task.accepted', {});
    return summarize(updated);
  });
}
```

- The first parameter is always `actor: Actor`, and the second is an already-parsed input object.
- **Every write** runs inside `db.transaction`. It locks the task first when a task is involved, appends exactly one activity event per user-visible change, and increments `revision` and `last_activity_at`.
- Policy checks run inside the transaction, after the lock, so they see current state.
- Throw `AppError` and never return error unions from services. Adapters map errors to the action result or the MCP error.
- Never trust an actor or owner ID sent by the client. The actor always comes from `auth`.

## Adapters

- **Server actions:** parse with the shared Zod schema from `lib/schemas.ts`, call `requireOwner()` and the service, `revalidatePath` the affected route, and return `{ ok, data | error }`.
- **MCP tools:** register them with the same Zod schema, call the service and return JSON. No business logic belongs in either adapter.

## Database

- Schema changes are made in `schema.ts`, then generated with `drizzle-kit generate`. Review the SQL and commit it. Update `database-schema.md` in the same change.
- Use Drizzle's query builder. Raw `sql\`\`` is acceptable for `FOR UPDATE`, partial-index-dependent upserts and inbox queries.
- Never store anything derived (badges, stalled, blocked). Compute it in queries.

## UI

- Server components fetch data and client components handle interaction. Keep `'use client'` at the leaves.
- Every drag-and-drop action also has a keyboard path, the card's "Move…" menu. Status is shown as a text label, never by colour alone.
- All interactive elements are reachable with Tab and have visible focus. Use Radix and shadcn primitives rather than custom widgets.
- Empty, loading and error states are required for every list (see `ui-ux-wireframes.md`).

## Security and logging

- Never log tokens, `Authorization` headers, cookies or full task bodies. Log the event type, IDs and error codes.
- Agent tokens appear only in the Connect or Reconnect response. Never put them in a URL.
- Only the server holds the database URL. Never prefix a secret with `NEXT_PUBLIC_`.

## Tests

- One `tests/<service>.test.ts` per service, run against local Supabase. Wrap each test in a transaction that is rolled back.
- A bug fix comes with a test that reproduces the bug.

## Commits

- Imperative subject of 72 characters or fewer. In the body, explain why.
- Update the affected `Docs/*.md` in the same commit as the code (the living-docs rule).
