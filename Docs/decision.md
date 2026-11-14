# Decision log

Chronological record of product and technical decisions for Roundabout. Newest at the bottom. When a decision is superseded, add a new entry and mark the old one `Superseded by D-n`.

Sources:
- `Roundabout.md`: the product requirements and **primary source**, with sections §1–§10.
- `Crosswalk review and product planning.docx`: items S1–S5, F1–F5 and O1–O5.
- `Roundabout workflow atlas.html`: diagrams 01–23.

Where these conflict, `Roundabout.md` wins unless a decision below overrides it.

---

## D-1 · 2026-11-10 · First-release scope

**Decision:** Build O1–O5: one project overview, a Kanban board (Backlog → To Do → In Progress → Review → Done), easy-to-scan cards, visible handoff history, and a "Needs your input" view. Keep Crosswalk's strengths S1–S5.
**Why:** Crosswalk spreads one project across five pages (F1) and hides progress, handoffs and blockers (F2–F5). Roundabout's difference is a single view a person can read.
**Proof workflow:** create a task, assign an agent, receive its result, hand the work to another agent, and review the outcome on the same board (diagram 17).

## D-2 · 2026-11-14 · Blocked is a badge, not a column

**Resolves:** `Roundabout.md` §4 and §10, where this was marked TBD.
**Decision:** A blocked task stays in its current column with a Blocked badge that shows the blocker question. It also appears in Needs your input.
**Why:** The task keeps its place in the workflow, so it doesn't need to move back when the blocker clears. Needs your input already lists every blocker in one place, so a separate column adds nothing.
**Tradeoff:** Blocked tasks are spread across columns. The overview and Needs your input make up for that.
**Implication:** Blocked is separate from `status` and never changes the column. It is not stored on the task. It is derived from whether the task has an open row in `blockers` (see D-9).

## D-3 · 2026-11-14 · Review is on by default

**Resolves:** `Roundabout.md` §4 and §10, where this was marked TBD.
**Decision:** "Require my review" is on for new tasks. The owner can turn it off for each task.
**Why:** Agents write code. Having results wait for a person to approve them is the safer default, and diagram 13 already supports both completion paths.
**Not doing:** a per-project default. Add it if switching review off task by task becomes tedious.

## D-4 · 2026-11-14 · Stalled work is flagged after 24 hours, never changed automatically

**Decision:** A task is flagged as Stalled after 24 hours with no activity in one of these states:
- Waiting for pickup (assigned but not accepted)
- A handoff that is still pending
- In Progress with no update from the owning agent

A Stalled task gets a badge and appears in Needs your input. Ownership never changes automatically. The owner reassigns or cancels the work (diagram 14).
**Why:** Agents only check for work when they're opened (no automatic pickup in the first release), so long waits are normal. Changing ownership automatically could undo real progress.
**Implementation note:** Stalled can be computed when the task is read (`now - last_activity_at > 24h`), so no scheduler is needed.
**Open:** 24 hours is a starting value. Make it configurable only if it proves wrong in use.

## D-5 · 2026-11-14 · Agents authenticate with scoped tokens first

**Decision:** In the first release, each agent connection uses an owner-generated token that is limited to the projects the owner picks. The owner pastes the token into the client's remote MCP config. Revoking the connection invalidates the token at once.
**Why:** It works the same way for Claude Code and Codex, it's simple to verify and revoke, and it meets diagrams 05–07 without building an OAuth authorization server.
**Implications:** Store only a hash of the token. Show the token once, when it's created. Record the last successful contact for each connection.
**Relation to `Roundabout.md` §3:** The PRD prefers browser authorization where a client supports it and treats a token as the alternative. This decision only changes the order: tokens ship first, and OAuth follows without a change in scope.
**Later:** Add browser OAuth when verifying more clients (diagram 18).

## D-6 · 2026-11-14 · Deferred until their release

- **Teammate roles and defaults (diagram 20):** deferred. The first release has one owner per workspace.
- **Upload types and size limits (diagram 21):** deferred. The first release supports links only.
- **Retry policies for automatic pickup and email delivery (diagrams 19, 23):** deferred along with those features.

## D-7 · 2026-11-14 · Database: Supabase Free (PostgreSQL)

**Source:** `Roundabout.md` §1 and §7, listed as confirmed scope.
**Decision:** Use hosted PostgreSQL on Supabase's Free plan for development. The web app and the MCP tools share it as the single source of truth. Claims, accepted handoffs and completions each run in one transaction together with their activity events.
**Still open:** the Supabase organization, project name and region (confirm before provisioning), the hosting provider for the web app and MCP endpoint, and the database schema. Using Supabase Auth to meet §2's "managed authentication" is the obvious fit, but it hasn't been confirmed yet. Supabase Auth is now confirmed by D-8.

## D-8 · 2026-11-14 · Tech stack: one Next.js app on Vercel and Supabase

**Decision:** A single TypeScript Next.js (App Router) app hosts both the owner's board and the remote MCP endpoint (`/api/mcp`, Streamable HTTP, `@modelcontextprotocol/sdk`). It uses Supabase Auth for people, scoped bearer tokens for agents, Drizzle for database access and migrations, Tailwind with shadcn/ui and dnd-kit for the UI, Zod for validation, Vitest for tests, and Vercel for hosting. Full table in `tech-stack.md`.
**Why:** The PRD requires the board and the agent tools to apply the same permissions and task rules to one PostgreSQL source (§7, atlas diagram 07). Putting both in one app means both call the same policy and service functions, with no second service to keep in sync. Radix and dnd-kit cover the keyboard and accessibility requirements in §6.
**Tradeoffs:**
- Authorization lives in application code, not Supabase RLS, because agent tokens aren't Supabase users. RLS stays enabled with no public policies as a backstop.
- Live updates use a ~10 s refresh rather than Realtime, which is simpler with a small delay.
- Vercel Hobby is for non-commercial use only, so revisit hosting before a public launch.
**Rejected:**
- A separate Express or FastAPI backend: it adds a deployment and duplicates checks.
- Supabase Realtime and a job queue in the first release: nothing needs them yet.

## D-9 · 2026-11-14 · Design choices made while writing the engineering docs

Details are in `technical-design-document.md` and `database-schema.md`.
- **An `actors` table** gives humans and agents one reference type for requesters, message senders, blocker raisers and events. *Why:* it replaces two nullable foreign keys in about six tables, and attribution survives a revoked agent.
- **Badges are derived, never stored.** Waiting for pickup, Handoff pending, Blocked, Stalled and Agent can't access are computed from rows. *Why:* a stored copy can't drift out of sync with the real state.
- **Only the assigned agent can move a task to In Progress**, by accepting it. On the board, a card can only be dropped where the transition is valid. Review → Done means approve, and Review → In Progress means request changes.
- **Reassigning supersedes** any pending handoff and pending review, and moves the task back to To Do or Backlog. Open blockers stay until someone resolves them.
- **A revoked agent's tasks keep it as the assignee**, show an "Agent can't access" badge and appear in Needs your input until reassigned. D-11 extends this to agents that have lost access to a project.
- **Access failures return `NOT_FOUND`**, so the response never reveals that the target exists (atlas diagram 07).
- **Agent writes accept an optional `request_id`** for retries. Owner actions rely on `expectedRevision` instead.

## D-10 · 2026-11-14 · Which documents the docs set includes

- `Roundabout.md` is the product requirements document. Writing a separate `product-requirements-document.md` would only duplicate it, so it is not created.
- `data-extraction-specification.md` is skipped. Roundabout has no data-ingestion or extraction pipeline. Create it if imports (for example from Crosswalk) are ever added.

## D-11 · 2026-11-14 · Rules added after reviewing the docs

- **Agents can't turn off review.** The agent `create_task` tool has no `require_review` input, so tasks an agent creates always require review. Only the owner changes it. *Why:* `Roundabout.md` §4 makes review the owner's choice. Without this rule, an agent could create a follow-up task with review off and mark it Done itself.
- **The "Agent can't access" badge** replaces "Agent disconnected". It appears when the assignee is revoked **or** no longer has access to the task's project. Removing a project from an agent's access cancels its pending handoffs in that project. *Why:* atlas diagram 06 asks for affected work to be surfaced after any change to an agent's access, not only after a disconnect.
- **The assignee must have access to the project.** Every assignment path checks it: owner assign, reassign, reopen, and agent `create_task` (atlas diagram 09).
- **Blocked tasks are never Stalled.** *Why:* they are already in Needs your input, and listing them twice adds noise.
- **Marking messages read happens through a server action** called when the owner opens a task, not during page render. *Why:* page loads should never write to the database.
- **Next.js 16 conventions:** `proxy.ts` replaces `middleware.ts`, and linting runs through the ESLint CLI. Confirmed against the Next.js 16 upgrade guide.

## D-12 · 2026-11-14 · Scaffold choices

- **npm instead of pnpm.** *Why:* npm comes with Node, pnpm isn't installed, and nothing here needs pnpm.
- **MCP transport:** the SDK's `WebStandardStreamableHTTPServerTransport` (stateless, JSON responses). *Why:* SDK 1.32 includes it, and it accepts the `Request` a Next.js route handler receives, so no adapter package is needed. This resolves the open item in `tech-stack.md`.
- **`proxy.ts` only refreshes the session and does no redirecting.** Sign-in is enforced by `requireOwner()` in the `(app)` layout and in every server action. *Why:* the Next.js 16 docs say a proxy matcher can silently miss Server Functions, so checking inside each one is the reliable gate.
- **Local Supabase config** (`supabase/config.toml`): email confirmation on, manual identity linking on (§2), redirect URL `http://localhost:3000/auth/callback`. Google is configured but turned off until OAuth credentials exist.
- **The schema is generated** into `drizzle/0000_init.sql`. It has 14 tables with RLS on all of them, foreign keys to `auth.users`, and partial unique indexes. Drizzle's `schemaFilter: ['public']` leaves Supabase's `auth` schema alone.

## D-13 · 2026-11-14 · Stage 1: tests, local ports, CI

- **Tests reset the database rather than rolling back** each test. *Why:* the claim-race and concurrent-retry tests need real concurrent connections, which a single rolled-back transaction can't provide. A guard refuses any non-localhost `DATABASE_URL`.
- **Local Supabase uses ports 643xx.** *Why:* Windows/Hyper-V reserves 54258–54357 on the dev machine, so Supabase's default 54321/54322 can't bind.
- **CI** (GitHub Actions) runs `supabase db start`, applies migrations, then runs lint, typecheck, tests and build on every PR and push to `main`.
- **Agent project grants use an explicit foreign key name** (`agent_project_grants_agent_fk`), because the generated one was 64 characters, one over Postgres's identifier limit (migration `0001`).

## D-14 · 2026-11-14 · Stage 2: sign-in and workspace

- **Cache Components and partial prefetching are off.** The Next.js 16.4 template turns them on. *Why:* every Roundabout page is signed-in, per-user live data, so there's no static shell worth prerendering. With them on, every session read must sit inside a `<Suspense>` boundary or the route errors. Revisit only if a public, cacheable page appears.
- **`ActionForm` submits through `onSubmit` plus a transition** rather than the form `action` prop. *Why:* React 19 resets a form's fields after an action, which wiped the email after a wrong password (found in browser testing).
- **Google buttons are shown only when Supabase's `/auth/v1/settings` reports Google as enabled.** *Why:* a disabled provider otherwise ends on a raw JSON 400 page.
- **`ensureWorkspace` serialises the first sign-in per user** with `pg_advisory_xact_lock`. Together with the partial unique indexes, this means a replayed or concurrent callback creates exactly one workspace.
- **Password-reset requests always give the same reply**, so the form can't be used to discover which emails have accounts.
- **Local dev account** for manual checks: `tests/fixtures/dev-owner.json` (local Supabase only). Running the test suite truncates its workspace, and the next sign-in recreates it.

## D-15 · 2026-11-14 · Stage 3: projects and boards

- **Projects and boards live in `server/projects.ts`**, and `workspace.ts` keeps only `ensureWorkspace`. *Why:* they're separate concerns, and `projects.ts` will be imported by many pages.
- **Duplicate names are caught by the case-insensitive unique indexes** and mapped from Postgres `23505` to a friendly `VALIDATION` error. *Why:* the database is the source of truth, and a pre-check would race.
- **Create actions call `revalidatePath('/', 'layout')` before redirecting.** *Why:* browser testing showed a new board's tab missing until reload, because layouts aren't re-rendered by a redirect alone.
- **Malformed ids are NOT_FOUND.** A non-UUID id would otherwise reach Postgres and come back as a 500.
