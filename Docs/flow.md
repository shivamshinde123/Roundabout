# Code flow

A living map of how requests move through the code. Update it whenever an entry point or call path changes. Diagram numbers refer to `Roundabout workflow atlas.html`.

> Status: **built** (first release, stages 1–11). Paths 1–6 below describe the implemented code. Each stage's files are listed in `decision.md` (D-13 to D-23).

## Entry points

| Entry | File | Leads to |
|---|---|---|
| Any page request | `src/proxy.ts` (Next.js 16's replacement for `middleware.ts`) | Refreshes the Supabase session cookie (`getClaims()`). Skips static assets and `/api/mcp`. **Not an auth gate**: `(app)/layout.tsx` and every server action call `requireOwner()`, which redirects to `/sign-in`, because the Next.js 16 docs warn that matchers can silently miss Server Functions |
| Owner pages | `src/app/(app)/**/page.tsx` | `requireOwner()` → read services (`tasks`, `inbox`, `activity`, `agents`, `projects`) → render. The `(app)` layout also computes per-project Needs-your-input counts for the sidebar. |
| Owner writes | `src/app/(app)/{projects,tasks,agents,settings}/actions.ts` | `requireOwner()` → service (Zod inside) → `revalidatePath` |
| Auth callback | `src/app/auth/callback/route.ts` | `exchangeCodeForSession` → `ensureWorkspace()` → redirect |
| Agent calls | `src/app/api/mcp/route.ts` | `authenticateAgent()` → MCP server → tool → service → `updates.pendingUpdatesNote()` appends "📬 N new updates" to the reply (D-41) |

## Path 1: an owner opens a board (diagram 04)

```
GET /projects/:p/boards/:b?task=:t
 → proxy (session refresh)
 → (app)/layout.tsx: requireOwner() → Actor{human}
 → boards/[boardId]/page.tsx
     → tasks.listBoard(actor, boardId)        // tasks + derived badges + latest result
     → if ?task: tasks.getDetail(actor, t)   // the side panel
 → <Board> (client) mounts <AutoRefresh every=10s onFocus>   // router.refresh()
```

## Path 2: an agent accepts a task (diagram 09)

```
POST /api/mcp  tools/call accept_task {task_id, request_id}
 → authenticateAgent(req)       // sha256(token) → agent_connections, grants → Actor{agent}
                                // touch last_contact_at, setup→active
 → mcp/tools.ts accept_task     // Zod parse
 → tasks.acceptTask(actor, input)
     db.transaction(tx =>
       idempotency.claim(tx, actor, request_id, 'accept_task')   // replay if seen
       task = lockTask(tx, task_id)                              // SELECT … FOR UPDATE
       policy.assertProjectAccess(actor, task.project_id)        // else NOT_FOUND
       assert task.status='todo' && task.assignee=actor.agentId  // else CONFLICT + snapshot
       update tasks set status='in_progress', revision+1, last_activity_at=now()
       events.append(tx, 'task.accepted', …)
       idempotency.store(tx, response))
 → JSON result → agent
 … the owner's board shows In Progress on its next refresh
```

## Path 3: a handoff (diagram 12)

```
Agent A: propose_handoff → handoffs.propose   (lock task, A owns it, B has a grant,
                                               no other pending handoff → insert pending, event)
Agent B: list_assignments → handoffs_to_me includes it
Agent B: respond_to_handoff accept → handoffs.respond
   tx: lock task → lock handoff → still pending? A still owns the task? B still has a grant?
       → handoff.status='accepted', tasks.assignee=B (stays in_progress), event 'handoff.accepted'
Owner: cancelHandoff (server action) → handoffs.cancel → 'cancelled', A keeps ownership
```

## Path 4: submit, review and complete (diagram 13)

```
Agent: submit_result → results.submit
   tx: lock task, assert owner + in_progress
       require_review ? insert result(pending), status='review'
                      : insert result(not_required), status='done', completed_by=agent
Owner: approveResult → results.approve      → result approved, status done, completed_by=owner
Owner: requestChanges → results.requestChanges → result changes_requested, status in_progress,
                                                  message to the agent containing the comment
```

## Path 5: blocker and response (diagram 11)

```
Agent: report_blocker → blockers.report (insert open blocker, event)
Owner: inbox shows it → opens task → postMessage(answer)  [+ optional resolveBlocker]
Agent: list_assignments.answers / get_task → reads the answer → clear_blocker
```

## Path 6: an agent connects (diagram 05)

```
Owner: /agents/new → createAgentConnection(name, client, projectIds)
   tx: insert agent_connections(status setup, token_hash), actor row, grants, event
   → page shows the raw token once + copy-paste setup for Claude Code / Codex
Agent: first call (whoami) → authenticateAgent → status setup→active, last_contact_at
Owner: /agents/:id shows Active + last contact
```

## State that crosses requests

- **Session:** the Supabase cookie, refreshed in `proxy.ts`.
- **Board freshness:** the client timer calls `router.refresh()`. No client-side cache of task data is kept.
- **Open task panel:** the `?task=` search parameter, so closing it returns to the same board (diagram 04, step 04).
- **Activity filters:** the `?agent=` and `?type=handoff` search parameters (diagram 15).

## External dependencies on the hot path

- Supabase Postgres (every request).
- Supabase Auth (session validation on owner requests; agent requests don't use it).
