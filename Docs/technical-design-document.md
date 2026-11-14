# Technical design

Implementation-level rules. The schema is in `database-schema.md`, the interfaces are in `api-specification.md`, and the decisions are in `decision.md`.

## 1. Actor context

Every service function receives an `Actor`:

```ts
type Actor =
  | { kind: 'human'; actorId: string; userId: string; workspaceId: string }
  | { kind: 'agent'; actorId: string; agentId: string; workspaceId: string; projectIds: Set<string> };
```

- **Human:** taken from the Supabase session. The workspace is found through `workspace_members` (role `owner`).
- **Agent:** taken from the bearer token. `projectIds` is loaded from `agent_project_grants` **on each request**, so a change to an agent's access applies to the very next call (atlas diagram 06).

## 2. Access policy (atlas diagram 07)

| Check | Rule |
|---|---|
| Workspace | The target row's `workspace_id` must equal `actor.workspaceId`. |
| Project | A human owner can access every project in the workspace. An agent needs `project_id ∈ actor.projectIds`. |
| No disclosure | A request that fails the workspace or project check returns `NOT_FOUND`, the same as a missing row, so it never reveals that the target exists. |
| Owner-only actions | These need `actor.kind = 'human'`: approve or request changes, reassign or reopen, cancel a handoff, move tasks between boards, change backlog ↔ todo, manage agents, and manage projects and boards. |
| Task ownership | Agent writes to an in-flight task (update, blocker, handoff, submit) need `tasks.assignee_agent_id = actor.agentId` and `status = 'in_progress'`, checked under a row lock. A stale owner gets `CONFLICT` with the current state (atlas diagram 14, step 03). |

## 3. Task state machine

| From | To | Trigger | Who | Side effects |
|---|---|---|---|---|
| — | backlog / todo | `createTask` | Owner, or an agent with a grant | `task.created`. An agent may create a task straight into `todo` with an assignee who has access to the project. Agent-created tasks always have `require_review = true` (D-11). |
| backlog | todo | move | Owner | |
| todo | backlog | move | Owner | The assignee is kept |
| todo (assigned) | in_progress | `acceptTask` | **Assigned agent only** | `task.accepted` |
| in_progress | review | `submitResult` with `require_review` | Owner agent | A result with `review_status = 'pending'`. The task appears in Needs your input. |
| in_progress | done | `submitResult` with review off | Owner agent | `review_status = 'not_required'`, `completed_by` = the agent |
| review | done | `approve` | Owner | The result is marked `approved`, `completed_by` = the owner |
| review | in_progress | `requestChanges(comment)` | Owner | The result is marked `changes_requested`. The comment is posted as a message to the agent. Earlier results are kept. |
| any except done | todo | `reassign(agent)` | Owner | Covered in section 6 |
| done | todo / backlog | `reopen` | Owner | `completed_*` is cleared. The history is kept. |

Any other transition, including dragging a card to In Progress, returns `INVALID_STATE`. On the board, only valid targets accept a drop. Dropping a card on Done from Review runs `approve`, and dropping it on In Progress from Review opens the request-changes dialog.

`assign(agent)` while a task is in backlog or todo sets `assignee_agent_id` and keeps the status. The agent must not be revoked and must have a grant for the task's project, otherwise the call returns `VALIDATION` (atlas diagram 09, step 01). The same check applies to `reassign`, `reopen` with an agent, and agent `create_task`. If the task was in backlog, the owner moves it to todo when ready. The card shows **Waiting for pickup** only in `todo`.

## 4. Concurrency

- **Agent writes:** `SELECT … FROM tasks WHERE id = $1 FOR UPDATE` inside the transaction, then the checks, then the write. Two agents claiming the same task are serialized by the lock. The second one sees that the status is no longer `todo`, or that it isn't the assignee, and gets `CONFLICT` with the current task (atlas diagram 09, step 03).
- **Board writes:** the client sends `expectedRevision`. If `tasks.revision` differs, the action fails with `CONFLICT`. The UI refreshes and explains that "this task changed since you opened it" (atlas diagrams 08 and 14).
- **Handoff accept:** lock the task, then lock the handoff. Commit only if the handoff is still `pending`, the task is still `in_progress` with `assignee = from_agent_id`, and the recipient still has a grant. Ownership and handoff status change in one transaction (atlas diagram 12, step 04).
- **Unique partial indexes** back up the locks: one pending handoff and one pending review per task.

## 5. Idempotency

Every **mutating** MCP tool accepts an optional `request_id` (a client-generated UUID).

1. Inside the transaction, insert `(agent_connection_id, request_id, operation)` into `idempotency_keys`.
2. If the insert conflicts, return the stored `response` without doing anything else. If the stored `operation` is a different tool, return `VALIDATION`.
3. Otherwise run the operation and store the response before committing.

Owner server actions don't use idempotency keys, because the revision check already makes a double submit fail safely.

## 6. Reassign, reopen and revoke

`reassign(task, newAgent | null)` runs in one transaction:
1. Supersede any pending handoff (`handoff.superseded`).
2. Mark any pending result `superseded`.
3. Set `assignee_agent_id = newAgent`, `status = 'todo'` (or `backlog` when unassigned), and clear `next_action`.
4. Open blockers are left open. The owner resolves them explicitly.
5. Write `task.reassigned` with the previous and new agent.

The previous agent's next write fails the ownership check (atlas diagram 14, step 03).

`revokeAgent(agent)` runs in one transaction:
1. `status = 'revoked'`, `token_hash = null`, `revoked_at = now()`.
2. Delete its grants.
3. Cancel pending handoffs to or from it.
4. Write `agent.revoked`.

Its tasks keep it as the assignee, show the **Agent can't access** badge and appear in Needs your input until the owner reassigns them. Its actor row and its history stay.

`updateAgentGrants(agent, projectIds)` runs in one transaction:
1. Replace the grants.
2. For every project that was removed, cancel the agent's pending handoffs in that project, whether sent or received (`handoff.cancelled`).
3. Write `agent.access_changed`.

The agent's unfinished tasks in a removed project keep it as the assignee and get the same **Agent can't access** badge, so the owner can reassign them (atlas diagram 06, step 04).

**Reconnect** (atlas diagram 06) rotates the token: generate a new token, replace `token_hash` and `token_prefix`, and set `status = 'setup'`. The old token stops working immediately.

## 7. Agent tokens

- Format: `rbt_` + base64url(32 random bytes), generated with `crypto.randomBytes`.
- Storage: `sha256(token)` in `token_hash`. The raw token is shown once, on the Connect agent screen, with ready-to-paste client setup.
- Lookup: hash the presented token and run `select … where token_hash = $1 and status <> 'revoked'`. Hashes are compared by indexed equality on the full 32-byte digest, which is safe against timing attacks because an attacker can't choose the hash.
- On success: `last_contact_at = now()` and `setup → active`. On failure: return HTTP 401 with an MCP error. A token that matches nothing gives no hint about which connection it might belong to.
- Logs never contain the `Authorization` header or the token.

> **Implementation note (stage 5):** correlated subqueries in board and agent queries name the outer column explicitly (`"tasks"."id"`). Drizzle omits the table name in queries without joins, and an unqualified `id` silently bound to the inner table (found by a test).

## 8. Stalled detection (D-4)

`STALLED_AFTER = 24h` is a constant in `src/server/tasks.ts`. Stalled is computed in the board and inbox queries (`last_activity_at < now() - interval '24 hours'`). No scheduler or stored flag is used. A task with an open blocker is never marked Stalled. It is already listed in Needs your input as Blocked, and flagging it twice would add noise (D-11).

## 9. Read receipts and answered questions

- `read_at` is set the first time the **recipient** loads a directed message.
  - For an agent, this happens inside `get_task`, which is already a tool call.
  - For the owner, the task panel calls the `markMessagesRead` server action after it opens. Page rendering never writes to the database.
- When the owner replies to a `question` addressed to them (`parent_message_id` = the question), that question's `answered_at` is set, which removes it from Needs your input.
- Answering a blocker posts the answer as a message and leaves the blocker open. The agent clears it with `clear_blocker` once it is unblocked, or the owner resolves it on the agent's behalf (atlas diagram 11, step 04).

## 10. Validation limits

| Field | Limit |
|---|---|
| title | 1–200 characters |
| instructions, details, body | ≤ 20,000 characters |
| summary, next_action, reason, question | ≤ 1,000 characters |
| links | ≤ 20 per item, `http`/`https` URLs only, ≤ 2,048 characters each |
| project, board and agent names | 1–80 characters |

## 11. Errors

All service errors are `AppError(code, message, details?)`.

| Code | Board (server action) | MCP |
|---|---|---|
| `UNAUTHENTICATED` | Redirect to sign-in | HTTP 401 |
| `NOT_FOUND` | "Not found or no access" | Tool error, `isError: true` |
| `FORBIDDEN` | Used only for owner-only actions attempted by an agent | Tool error |
| `INVALID_STATE` | Explains which transition is not allowed | Tool error with the current status |
| `CONFLICT` | Refresh and explain | Tool error with the current task snapshot so the agent can recover |
| `VALIDATION` | Field errors | Tool error with the Zod issues |
| `INTERNAL` | Generic message, retry | Tool error marked `retryable: true` |

## 12. Testing strategy

Vitest against a local Supabase Postgres. `tests/setup.ts` refuses any non-localhost `DATABASE_URL` and truncates all app tables before each test (`truncate workspaces cascade`). Files run one at a time. Truncating instead of rolling back each test lets tests open several real connections, which the claim-race and concurrent-retry tests need. One test file per service. The minimum checks mirror `Roundabout.md` §8:

- claim race (two parallel `acceptTask`, exactly one succeeds)
- stale owner after reassign
- handoff accept, decline and cancel
- both completion paths
- request changes keeps the earlier result
- cross-project `NOT_FOUND`
- a revoked token gets 401
- an idempotent retry returns the same result and writes one event
