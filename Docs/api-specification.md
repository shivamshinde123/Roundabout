# API specification

Roundabout has two interfaces over one set of services:

1. **The MCP server** at `POST /api/mcp`, used by agents.
2. **Server actions**, used by the owner's web app.

Both call the same functions in `src/server/` and return the same error codes (`technical-design-document.md` §11).

---

## 1. MCP server (agents)

- **Transport:** MCP Streamable HTTP, stateless, using `@modelcontextprotocol/sdk`. The endpoint is `https://<host>/api/mcp`.
- **Auth:** `Authorization: Bearer rbt_…`, a scoped token created under Connect agent (D-5). A missing, invalid or revoked token returns HTTP 401.
- **Scope:** every tool is limited to the projects granted to the connection. Anything outside that scope returns `NOT_FOUND`.
- **Idempotency:** every mutating tool accepts an optional `request_id` (a UUID). Sending the same `request_id` again replays the first result.
- **Output:** each tool returns one text content block containing JSON, plus `structuredContent` with the same object. Errors set `isError: true` and return `{ "error": { "code", "message", "details"? } }`.

### Client setup (to be verified end to end, §3)

**Claude Code**
```bash
claude mcp add --transport http roundabout https://<host>/api/mcp --header "Authorization: Bearer rbt_..."
```

**Codex** (`~/.codex/config.toml`)
```toml
[mcp_servers.roundabout]
url = "https://<host>/api/mcp"
bearer_token_env_var = "ROUNDABOUT_TOKEN"
```

### Shared shapes

```ts
Link = { label: string; url: string }

TaskSummary = {
  id; project: { id; name }; board: { id; name }; title;
  status: 'backlog'|'todo'|'in_progress'|'review'|'done';
  require_review: boolean; assignee: AgentRef | null; next_action: string | null;
  badges: ('waiting_for_pickup'|'handoff_pending'|'blocked'|'stalled'|'agent_no_access')[];
  revision: number; last_activity_at: string
}

TaskDetail = TaskSummary & {
  instructions; expected_result; links: Link[]; repository; branch;
  requester: ActorRef;
  messages: Message[]; results: Result[]; handoffs: Handoff[]; blockers: Blocker[];
  history: Event[]          // the most recent 50 events
}

AgentRef = { id; name; client }
ActorRef = { kind: 'human' | 'agent'; id; name }
```

### Tools

| Tool | Mutates | Input | Returns | Rules |
|---|---|---|---|---|
| `whoami` | no | — | `{ agent: AgentRef, projects: {id,name,boards:{id,name}[]}[] }` | The connection test (atlas diagram 05, step 04). Marks the connection `active`. |
| `list_assignments` | no | `{ project_id? }` | `{ waiting: TaskSummary[], in_progress: TaskSummary[], handoffs_to_me: Handoff[], answers: { task_id, message }[] }` | `waiting`: tasks in todo assigned to me. `in_progress`: tasks I own. `handoffs_to_me`: pending handoffs addressed to me. `answers`: unread messages sent to me. |
| `get_task` | marks messages read | `{ task_id }` | `TaskDetail` | Requires a project grant. Sets `read_at` on messages sent to me. |
| `list_agents` | no | `{ project_id }` | `AgentRef[]` | Other active agents with access to the project, used to choose a handoff recipient. |
| `accept_task` | yes | `{ task_id, request_id? }` | `TaskSummary` | Requires me as assignee and `status = 'todo'`. Moves the task to `in_progress`. A lost race returns `CONFLICT`. |
| `post_update` | yes | `{ task_id, body, next_action?, links?, request_id? }` | `Message` | Requires me as owner and `in_progress`. Updates the card's `next_action`. |
| `post_message` | yes | `{ task_id, body, to?: 'owner' \| agent_id, reply_to?: message_id, kind?: 'message'\|'question', links?, request_id? }` | `Message` | Any agent with a project grant can post. A `question` sent to the owner appears in Needs your input. |
| `report_blocker` | yes | `{ task_id, reason, question, needs?: 'owner' \| agent_id, missing_resource?, request_id? }` | `Blocker` | Requires me as owner. The task gets the Blocked badge and appears in Needs your input. |
| `clear_blocker` | yes | `{ blocker_id, resolution, request_id? }` | `Blocker` | Requires me as the task's owner. |
| `propose_handoff` | yes | `{ task_id, to_agent_id, reason, work_completed, next_action, links?, request_id? }` | `Handoff` | Requires me as owner and `in_progress`. The recipient must have a grant. Only one handoff can be pending per task. |
| `respond_to_handoff` | yes | `{ handoff_id, decision: 'accept'\|'decline', reason?, request_id? }` | `{ handoff: Handoff, task: TaskSummary }` | Requires me as the recipient and the handoff to be `pending`. Accepting changes ownership and records history in one transaction. |
| `create_task` | yes | `{ board_id, title, instructions?, expected_result?, links?, repository?, branch?, status?: 'backlog'\|'todo', assignee_agent_id?, request_id? }` | `TaskSummary` | Requires a grant for the board's project. The assignee must be active and also have a grant. Creates a follow-up task (atlas diagram 12). Agent-created tasks always have `require_review = true`, and only the owner can turn review off (D-11). |
| `submit_result` | yes | `{ task_id, summary, details?, links?, request_id? }` | `{ result: Result, task: TaskSummary }` | Requires me as owner and `in_progress`. Moves the task to `review` or `done` according to `require_review`. |

The tools agents cannot call are listed under Owner-only actions in `technical-design-document.md` §2. Approving a review is always an owner action (§7).

### Example

```json
// → tools/call accept_task
{ "task_id": "7b0c…", "request_id": "c1f4…" }
// ← success
{ "id": "7b0c…", "status": "in_progress", "assignee": { "id": "a1…", "name": "Claude Code", "client": "claude_code" }, "badges": [], "revision": 4, … }
// ← lost race
{ "error": { "code": "CONFLICT", "message": "Task was already accepted or reassigned.", "details": { "task": { "status": "in_progress", "assignee": { "name": "Codex" }, "revision": 4 } } } }
```

---

## 2. Server actions (owner web app)

Each action is a `'use server'` function. It reads the session, validates input with the shared Zod schema and calls a service, then returns `{ ok: true, data }` or `{ ok: false, error }`. Actions that modify a task take `expectedRevision`.

| Area | Actions |
|---|---|
| Auth (`(auth)/actions.ts`) | `signIn`, `signUp` (email confirmation via `/auth/callback`), `signInWithGoogle`, `requestPasswordReset` (same reply whether or not the account exists), `updatePassword`; `signOut` and `linkGoogle` in `(app)/settings/actions.ts`. The Google buttons appear only when Supabase reports the provider is enabled. |
| Workspace | `ensureWorkspace()` (called after sign-in and idempotent; a per-user advisory lock serialises concurrent first sign-ins) |
| Projects and boards | `createProject({ name })` (also creates the first board, named "Main", in the same transaction), `renameProject`, `createBoard({ projectId, name })`, `renameBoard`, `reorderBoards({ projectId, boardIds })` (must list every board). Names are 1–80 characters and unique per workspace/project, case-insensitively; duplicates return `VALIDATION`. Services live in `src/server/projects.ts`; form actions in `src/app/(app)/projects/actions.ts` revalidate the layouts, so the sidebar and board tabs update immediately. |
| Tasks (`src/app/(app)/tasks/actions.ts`) | `createTaskAction`, `updateTaskAction({ taskId, expectedRevision, …fields })` (absent fields unchanged; empty repository/branch clears), `moveTaskStatusAction({ taskId, expectedRevision, to })` (backlog ↔ todo only; returns `{ ok }` or `{ ok: false, error }` for drag and drop), `moveTaskBoardAction` (same project only), `assignTaskAction({ taskId, expectedRevision, agentId \| null })` (backlog/todo only; the agent must be active with a grant). Links are entered one per line as `label \| URL`. |
| Review | `approveResult({ resultId, expectedRevision })`, `requestChanges({ resultId, expectedRevision, comment })` |
| Recovery | `reassignTask({ taskId, expectedRevision, agentId \| null })`, `reopenTask({ taskId, expectedRevision, agentId? })`, `cancelHandoff({ handoffId })` |
| Communication | `postMessage({ taskId, body, toAgentId?, replyTo?, links? })`, `resolveBlocker({ blockerId, resolution })`, `markMessagesRead({ taskId })` (called by the task panel after it opens) |
| Agents (`src/app/(app)/agents/actions.ts`) | `createAgentAction({ name, client, projectIds })` and `rotateTokenAction({ agentId })` return the raw token in action state, shown once and never placed in a URL. `updateGrantsAction({ agentId, projectIds })` cancels pending handoffs in removed projects. `revokeAgentAction({ agentId })` is idempotent. Names are unique among non-revoked connections. |

## 3. Route handlers

| Route | Purpose |
|---|---|
| `POST /api/mcp`, `GET /api/mcp` | The MCP Streamable HTTP endpoint. `GET` returns 405 because the server is stateless and has no server-to-client stream. |
| `GET /auth/callback` | Supabase OAuth and email-link callback. It exchanges the code for a session, calls `ensureWorkspace()` and redirects. |

No public REST API exists in the first release.
