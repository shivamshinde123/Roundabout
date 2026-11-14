# Tech stack

Chosen 2026-11-14 (decision D-8). It's built around the fixed constraint from `Roundabout.md` §1 and §7: Supabase PostgreSQL is the single source of truth, shared by the web board and the agent MCP tools.

**Guiding rule:** use one deployable app, one language and one policy module. The board and the agents call the same TypeScript functions, so permissions and task rules can't drift apart (atlas diagram 07).

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict) | One language across the UI, the API, the MCP tools and the shared rules. |
| Web app | **Next.js (App Router)** | Server components and server actions for board mutations; the MCP endpoint lives in the same app as a route handler. No separate API server. |
| UI | **Tailwind CSS + shadcn/ui (Radix)** | Radix primitives are accessible to keyboard and screen-reader users out of the box (§6 keyboard requirement). shadcn copies the components into the repo, so it adds no runtime dependency. |
| Drag and drop | **dnd-kit** | Has a keyboard sensor and screen-reader announcements. Explicit "Move to…" controls ship alongside it (§6). |
| Database | **Supabase PostgreSQL (Free)** | Fixed by the PRD (D-7). |
| DB access and migrations | **Drizzle ORM + drizzle-kit** | Typed SQL, real transactions with `SELECT … FOR UPDATE` and revision checks for claims, handoffs and completion. SQL migrations are checked into the repo. Connects through the Supabase pooler. |
| Human auth | **Supabase Auth** | The managed auth required by §2: email and password with verification and recovery, Google sign-in, and identity linking. Used through `@supabase/ssr` for cookie sessions. |
| Agent auth | **Scoped bearer tokens** (D-5) | Random 32-byte token, shown once. A SHA-256 hash is stored on `agent_connections`, and the project grants live in a join table. Checked in the MCP route on every call. |
| Agent interface | **MCP over Streamable HTTP**, `@modelcontextprotocol/sdk` | The remote MCP transport that Claude Code and Codex both support. Runs stateless inside a Next.js route handler (`/api/mcp`). |
| Validation | **Zod** | One schema per operation, shared by server actions and MCP tool inputs. The MCP SDK already uses Zod. |
| Live board updates | **Periodic refresh** (`router.refresh()` every ~10 s plus on window focus) | It's enough to show agent changes without extra infrastructure. `ponytail:` upgrade to Supabase Realtime if a 10 s delay feels slow. |
| Tests | **Vitest** against a local Supabase (Supabase CLI + Docker) | Cover the task state machine and the policy checks (claims, stale owners, cross-project denial) against a real Postgres. |
| Hosting | **Vercel** (Hobby during development) | Hosts both the Next.js app and the MCP route. Pick a Vercel function region next to the Supabase region. The Hobby plan is for non-commercial use, so revisit before a public launch. |
| Package manager | **npm** | It ships with Node, so there's nothing extra to install. pnpm was the first choice but isn't on the dev machine (D-12). |

## Deliberately not using

- **A separate backend service (Express or FastAPI):** the web app and the MCP route already share code in one Next.js app, so a second service only adds a network hop and a deployment.
- **Supabase Row Level Security as the main authorization layer:** agent tokens aren't Supabase users. All access goes through the server-side policy module with a privileged connection. RLS stays enabled with no public policies as a backstop, so the anon key can't read anything.
- **Supabase Realtime, a job queue or cron:** periodic refresh covers live updates, and Stalled status is computed when a task is read (D-4). Add these when automatic pickup (roadmap) needs them.
- **Storage buckets:** the first release supports links only (D-6).

## Still to confirm before provisioning

- Supabase organization, project name and region.
- Vercel team and project, in the region matching Supabase.
- That Codex and Claude Code both connect to `/api/mcp` with a bearer-token header. Test this end to end (§3).

## Resolved at scaffold (2026-11-14, D-12)

- **MCP transport:** `WebStandardStreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js` (SDK 1.32). It takes a web `Request` and returns a `Response`, so the Next.js route handler calls `transport.handleRequest(req)` directly. Configure it with `sessionIdGenerator: undefined` (stateless) and `enableJsonResponse: true`. Vercel's `mcp-handler` isn't needed.
- **Next.js 16 conventions:** `src/proxy.ts` replaces `middleware.ts`, lint runs through the ESLint CLI, and `next typegen` must run before `tsc` so the generated route types (`LayoutProps`, …) exist.

## Installed versions (scaffold)

next 16.4.6 · react 19.3 · @supabase/ssr 0.12 · @supabase/supabase-js 2.119 · drizzle-orm 0.45 · drizzle-kit 0.31 · postgres 4.1 · zod 4.6 · @modelcontextprotocol/sdk 1.32 · @dnd-kit/core 6.3 · vitest 5.1 · supabase CLI 3.1 · Tailwind 4.3 · Node 22.
