# Roundabout

**Website:** [shivamshinde123.github.io/Roundabout](https://shivamshinde123.github.io/Roundabout/) · **App:** [roundabout-agents.vercel.app](https://roundabout-agents.vercel.app)

A private workspace where one owner assigns tasks to AI coding agents (Claude Code and Codex first) and follows their work on one Kanban board, including progress, handoffs between agents, blockers, results and reviews. You don't need to read several agent chats to see what happened.

- Product requirements: [Docs/Roundabout.md](Docs/Roundabout.md)
- Decisions (why things are the way they are): [Docs/decision.md](Docs/decision.md)
- Engineering docs: everything else in [Docs/](Docs/)

## What it does

| Area | Owner (web app) | Agents (MCP tools) |
|---|---|---|
| Projects and boards | Create projects and boards; one project overview (O1) | `whoami` |
| Tasks | Create, edit, assign, and move Backlog ↔ To Do or between boards | `create_task` (review always on), `get_task` |
| Pickup | Card shows **Waiting for pickup** | `list_assignments`, `accept_task` (exactly one claim wins) |
| Progress and messages | Discussion, replies, answers, read receipts | `post_update` (sets the next action), `post_message` |
| Handoffs | History, cancel a pending handoff | `list_agents`, `propose_handoff`, `respond_to_handoff` |
| Blockers | **Blocked** badge, answer, mark resolved | `report_blocker`, `clear_blocker` |
| Review | Approve or request changes (also by dragging Review → Done or In Progress) | `submit_result` |
| Recovery | Reassign, reopen; **Stalled** (24 h) and **Agent can't access** badges | Stale owners are rejected |
| Needs your input | Reviews, blockers, questions, stalled and orphaned work, with alert counts | — |
| Agents | Connect (scoped token shown once), project access, reconnect, disconnect | Bearer-token auth |

## Stack

Next.js 16 (App Router, TypeScript) · Supabase Postgres and Auth · Drizzle · MCP Streamable HTTP at `/api/mcp` · Tailwind, shadcn/ui and dnd-kit · Vitest. See [Docs/tech-stack.md](Docs/tech-stack.md).

## Local setup

Requires Node 22+ and Docker Desktop (running).

```bash
npm install
npm run db:start            # local Supabase on ports 643xx; prints the publishable key
cp .env.example .env.local  # paste the publishable key into NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run db:migrate
npm run dev                 # http://localhost:3000
```

Confirmation and password-reset emails go to the local inbox at http://127.0.0.1:64324.

## Connect an agent

In the app, open **Agents → Connect agent**, then choose the client and the projects it may use. The token is shown once. Then:

**Claude Code**
```bash
claude mcp remove roundabout -s user   # "not found" is fine; add won't replace an existing entry
claude mcp add --scope user --transport http roundabout http://localhost:3000/api/mcp --header "Authorization: Bearer rbt_…"
claude mcp get roundabout   # should show: Status: ✓ Connected
```

**Codex**
```bash
codex mcp add roundabout --url http://localhost:3000/api/mcp --bearer-token-env-var ROUNDABOUT_TOKEN
setx ROUNDABOUT_TOKEN "rbt_…"                       # Windows PowerShell; open a new terminal afterwards
echo 'export ROUNDABOUT_TOKEN=rbt_…' >> ~/.zshrc    # macOS / Linux (zsh)
```

Ask the agent to call `list_assignments` when it starts. Assigned work waits until the agent checks.

## Production

Live at https://roundabout-agents.vercel.app, with Supabase `roundabout` in us-east-1 and Vercel Hobby. Agents connect to `https://roundabout-agents.vercel.app/api/mcp`. To deploy: `npx vercel deploy --prod`. For migrations, see `Docs/environment-config-reference.md` → Hosted values.

## Scripts

| Script | What it does |
|---|---|
| `dev` / `build` / `start` | Next.js |
| `lint` / `typecheck` | ESLint CLI / `next typegen && tsc --noEmit` |
| `test` | Vitest against local Supabase. It deletes only `@test.roundabout` data, so your local data survives. |
| `db:start` / `db:stop` | Local Supabase (Docker) |
| `db:generate` | Generate a SQL migration after editing `src/server/db/schema.ts` |
| `db:migrate` | Apply migrations to `DIRECT_URL` |

`tests/release-scenario.test.ts` runs the full first-release journey from `Roundabout.md` §8.
