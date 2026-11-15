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

## D-16 · 2026-11-14 · Stage 4: tasks and the Kanban board

- **Drag starts from a grip handle, not the whole card.** *Why:* dnd-kit's keyboard sensor starts a drag on Enter or Space anywhere inside the draggable, so Enter on the title link would have started a drag instead of opening the task.
- **Owner board moves are only Backlog ↔ To Do** (`ownerMoves`). Other columns only accept drops wired to their own action (review, stage 8). An invalid drop shows a toast and the server rejects it too (`INVALID_STATE`).
- **`DndContext` gets a `useId()` id.** *Why:* its default global counter differed between server and client and caused a hydration mismatch, which browser testing caught.
- **The Geist font variable is named `--font-sans`.** *Why:* shadcn's `@theme inline` maps `font-sans` to `var(--font-sans)`, but the template named it `--font-geist-sans`, so every page fell back to Times. Turbopack's on-disk cache also had to be cleared (`rm -rf .next`) to pick up the CSS fix.
- **Native `<select>` and checkbox** in task forms. *Why:* they're accessible and post with the form directly, with no hidden-input plumbing. The unused shadcn select, checkbox and tooltip were removed.
- **Card badges are computed in one board query** (subqueries for blocker, pending handoff, latest result and grant) and turned into labels by the pure, tested `deriveBadges`.
- **`updateTask` patches** leave absent fields unchanged, and an empty repository or branch clears it. *Why:* the create schema's defaults would otherwise have nulled fields on every edit.
- `ponytail:` **history timestamps are formatted on the server** (server time zone). Format them on the client if hosted time-zone differences matter.

## D-17 · 2026-11-14 · Stage 5: agent connections

- **The token is returned in server-action state** and rendered once on the client (`TokenReveal`). It never goes into a URL, a redirect or stored page data. Only its SHA-256 hash and an 8-character display prefix are stored.
- **`authenticateAgent` loads grants on every request** and records `last_contact_at`, moving `setup` to `active`. The UI labels this "last successful check (a recorded check, not live availability)" (§3).
- **Disconnected agents free their name.** The unique name index is partial (`where status <> 'revoked'`, migration 0002). *Why:* browser testing showed that disconnecting "Claude Code" would otherwise block reconnecting under the same name.
- **Correlated subqueries use table-qualified outer columns.** *Why:* Drizzle drops the table name in join-less queries, and a test caught `id` binding to the inner table, which zeroed the work counts.
- **Reconnect uses a plain dialog** (`SimpleDialog`) that hosts the token form. Disconnect uses a confirmation dialog that explains what is kept.

## D-18 · 2026-11-14 · Stage 6: MCP server

- **The MCP endpoint is stateless and builds a fresh `McpServer` per request** on the SDK's `WebStandardStreamableHTTPServerTransport` with `enableJsonResponse: true`. Auth happens before the server is built. A bad token gets HTTP 401 with `WWW-Authenticate: Bearer error="invalid_token"`, and `GET` and `DELETE` get 405.
- **Tool results are always objects** (for example `{ agents: [...] }`). *Why:* text content and `structuredContent` must carry the same shape, and a test caught them diverging for arrays.
- **Messages don't bump the task revision.** See technical design §9.
- **Owner replies use the same `postMessage` service as agents.** A reply to a question addressed to you marks it answered. Read receipts are set by `get_task` for agents, and by a server action fired after the task panel opens for the owner.
- **Verified with the official SDK client** (`Client` with `StreamableHTTPClientTransport`) against the dev server: initialize, list tools, every tool, idempotent `accept_task` replay, an owner answer, and the read receipt. Real Claude Code and Codex configuration is still to be tested (§3, stage 11).
- **Approval:** the owner approved `gh pr merge --admin`, because `main` has lock-branch protection (2026-11-14).

## D-19 · 2026-11-14 · Stage 7: handoffs and blockers

- **Handoff locking order is task, then handoff.** Accept re-checks that the handoff is still pending, the sender still owns the task in progress, and the recipient still has project access (via `lockTask`), then moves ownership and the handoff status in one transaction. Accepting copies the handoff's `next_action` onto the card.
- **One pending handoff per task** is checked in the transaction for a friendly `CONFLICT`, with the partial unique index as a backstop.
- **`needs` on a blocker is the owner by default.** Answering a blocker sends a message and doesn't resolve it: either the agent clears it (`clear_blocker`) or the owner marks it resolved (atlas diagram 11, step 04).
- **Tests delete only test-owned data** (supersedes the "truncate" note in D-13). *Why:* each test run wiped the developer's browser-test data. Deletion order is activity events, tasks, then workspaces, because Postgres checks NO ACTION foreign keys before the workspace cascade reaches tasks.
- **Verified with the SDK client as two agents**: create, accept, blocker reported and cleared, a second blocker, handoff proposed and seen by the recipient. In the browser the owner saw "Handoff → Codex" and "Blocked" on the card, resolved the blocker and cancelled the handoff.

## D-20 · 2026-11-14 · Stage 8: results and review

- **`submit_result` follows `require_review`:** `pending` plus Review, or `not_required` plus Done with the agent as `completed_by`. Submitting supersedes any pending handoff, because that work is now under review or done.
- **Review actions lock the task, check `expectedRevision`, and require the task in Review with that submission pending.** A second approval or a stale form gets `CONFLICT`.
- **Request changes is one transaction:** the result is marked `changes_requested` with the comment, the task returns to In Progress with next action "Address requested changes", and a message to the submitting agent says "Changes requested: …". Earlier submissions are always kept.
- **Review on the board:** `ownerMoves` allows Review → Done (approve) and Review → In Progress (a comment dialog), and only while a submission is pending. The menu labels are Approve and Request changes….
- **Done cards show "Approved by you" or "Completed by \<agent\>"** (`Roundabout.md` §4).
- **Verified:** a real SDK client submitted, the owner requested changes from the card menu, the agent resubmitted, and the owner approved. The card reached Done with both submissions listed.

## D-21 · 2026-11-14 · Stage 9: reassign, reopen, stalled and no-access work

- **Reassign applies to In Progress and Review work.** Before pickup, the owner uses Assign; for Done work, Reopen. Reassign supersedes a pending handoff and review, then moves the task to To Do for the new agent or to Backlog if unassigned, and clears the next action.
- **The stale-owner guard needs no new code.** Every agent write already checks `assignee = me` and `in_progress` under the row lock, so after a reassign the old agent's `post_update`, `submit_result` and `report_blocker` all get `CONFLICT` (tested and browser-verified).
- **Reopen with "keep"** keeps the previous agent only if it is still active and has a grant; otherwise the task goes to Backlog unassigned.
- **Stalled and "Agent can't access"** were already derived in stage 4. This stage adds real-data tests: 25-hour idle work shows Stalled, blocked work never does, and a revoked assignee shows "Agent can't access" until reassigned.

## D-22 · 2026-11-14 · Stage 10: Needs your input, activity, overview

- **The inbox is computed on read** from results, blockers, messages and the card badges. Ordering is review, blocked, question, can't access, stalled, then newest first. A task that is stalled and also has a no-access agent is listed once, as no-access.
- **In-app alerts are per-project counts** in the sidebar (which links straight to the inbox when non-zero) and on the project's "Needs your input (n)" tab. There's no toast or notification table, which keeps it simple. Optional email alerts are a later extension (atlas diagram 23).
- **Activity filters are GET query parameters** (`?agent=`, `?handoffs=1`) with a Reset link, so they survive refresh and back/forward (diagram 15, step 04).
- **The overview** (O1) shows stage counts across boards, the top three inbox items with inline actions, agents with access (status, last check, work), recent results and handoffs, and the boards.
- `ponytail:` the sidebar and the project layout both compute the inbox per request (O(projects × queries)). Add `react.cache` or a single counts query if it ever shows in timings.

## D-23 · 2026-11-14 · Stage 11: end-to-end verification and hardening

- **The §8 scenario is automated** in one test (`tests/release-scenario.test.ts`): sign-in, two boards, two agents and a restricted project; pickup; update; handoff; review with request changes then approve; review-off completion; blocker; reassign with stale-owner rejection; a three-way simultaneous claim; cross-project denial; revocation; and history intact.
- **Real-client checks** on the dev machine:
  - **Claude Code 2.1.81:** `claude mcp add --transport http … --header "Authorization: Bearer …"` (local scope) and `claude mcp get` reported **✓ Connected** against `/api/mcp`. The entry was removed afterwards.
  - **Codex 0.148.0:** `codex mcp add … --url … --bearer-token-env-var ROUNDABOUT_TOKEN` gave `transport: streamable_http` with bearer auth, which matches the snippet Roundabout shows. Codex's `list` and `get` don't probe the server, and a live Codex tool call would need a model run, so that stays in the owner's manual stage 12 checklist. The entry was removed afterwards.
  - **Every tool:** the official MCP SDK client (`StreamableHTTPClientTransport`) exercised all of them during stages 6–10.
- **Hardening:** a "Skip to content" link (first Tab stop, which focuses `<main>`), and security headers on every route (`X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, a strict referrer policy, and a permissions policy). Every server-action module calls `requireOwner()`.
- **Known limits, not blocking release:**
  - No rate limiting on `/api/mcp`. Add one per token if a client misbehaves.
  - History timestamps are formatted in the server's time zone (D-16).
  - Pointer drag-and-drop is now browser-verified: Backlog → To Do moved the card, and To Do → In Progress was refused with the toast and the card stayed. This closes the gap noted in D-16.

## D-24 · 2026-11-14 · Stage 12: deploy

- **Choices (the owner's):** Supabase project `roundabout` in the owner's default org, region `us-east-1`; Vercel personal Hobby project `roundabout`, functions in `iad1` next to the database; Google sign-in **skipped for now**. The app already hides the Google button when the provider is off (stage 2), so turning it on later is a Supabase setting plus an OAuth client, with no code change.
- **Production URL:** https://roundabout-orcin.vercel.app. Supabase Auth's site URL and allow-list point at its `/auth/callback`, plus localhost. Manual identity linking is on, as it is locally. Email confirmation is on.
- **Migrations go over the session pooler (port 5432), not the direct host.** *Why:* the direct `db.<ref>` host is IPv6-only and the dev machine has no IPv6 route. The runtime uses the transaction pooler (6543), as planned in D-8.
- **Deploys go through the Vercel CLI, not Git integration.** *Why:* the Vercel GitHub app has no access to the private repo, and granting it is the owner's call. CI still gates `main`.
- **Smoke checks on production:** `/` redirects to `/sign-in`; the sign-up page renders with no console errors and no Google button; security headers are present; `/api/mcp` returns 401 "Missing or malformed bearer token" without a token, and 401 "Invalid or revoked token" for an unknown `rbt_` token. That second check proves the function reaches the database through the pooler.
- **Known limits:**
  - Supabase's built-in email sender only delivers to members of the Supabase org, at about 2 emails an hour. That's fine for the single owner. Add custom SMTP before inviting anyone else.
  - Free projects pause after about a week of inactivity.
  - The owner's own account, the agent connections, and the manual §8 run, including a live Codex tool call, are done by hand on production.

## D-25 · 2026-11-14 · Email links opened in another browser

- **Symptom:** the owner's first production sign-up showed "That link is invalid or has expired." Supabase had confirmed the email (`email_confirmed_at` was set), but `exchangeCodeForSession` failed with `pkce_code_verifier_not_found`. The PKCE verifier cookie lives in the browser that submitted sign-up, and the link was opened in a different one.
- **Fix:** when the verifier is missing, the callback says what really happened. For a confirmation, it shows the notice "Your email is confirmed. Sign in to continue." on the sign-in page. For a password reset, it asks the user to open the link in the browser where they requested it.
- **Not done: token_hash email links, which work in any browser.** *Why:* they need custom email templates, and Supabase refuses template changes on Free projects that use the built-in email sender (`entitlement_required`). When custom SMTP is added (it's also needed before inviting anyone, see D-24), switch the confirmation and recovery templates to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=…` and verify them in the callback with `verifyOtp`.

## D-26 · 2026-11-14 · Setup snippets work for a first-time user on any OS

- **Claude Code's command adds `--scope user`.** *Why:* without it, `claude mcp add` registers Roundabout only for the folder where the command ran, so the agent "loses" Roundabout in every other repository. A new user can't be expected to know that flag.
- **Codex uses `codex mcp add … --bearer-token-env-var ROUNDABOUT_TOKEN`** (checked against Codex 0.148.0 in D-23) instead of a hand-edited `config.toml` block, which saves the user a file edit. Codex reads the token from the environment, so the page shows one line that saves it on Windows (`setx`, persistent) and one for macOS/Linux (append to `~/.zshrc`). Both say to open a new terminal. The old `export …` line was Unix-only and lasted for a single shell.
- A "check it" line (`claude mcp get roundabout`) follows the Claude Code command, so the user sees **✓ Connected** before leaving the page.
- **Update (same day): numbered steps and a Copy that always works.** The token page now lists the setup as numbered steps: (1) add, (2) check, or save the token for Codex, (3) ask the agent to call `whoami`. Long commands wrap instead of scrolling sideways. Copy used to fail silently in embedded browsers (the Claude pane raised `NotAllowedError: Document is not focused`). It now falls back to `execCommand('copy')`. If that fails too, the text is selected and a live hint says to press Ctrl+C. Both paths and the 375 px layout were browser-checked.

## D-27 · 2026-11-15 · Pin postgres.js to 3.4.7 (production pages hung)

- **Symptom:** on production, opening a project never loaded, and Vercel killed the request after 300 s (`/projects/[projectId]`). The MCP endpoint and sign-in worked.
- **Cause:** postgres.js **4.1.1** hangs when it sends several queries at once over one connection through Supabase's **transaction pooler** (Supavisor, port 6543). The project page runs four queries in a `Promise.all`. In `pg_stat_activity` the backends sat `active` / `ClientRead`, waiting for the rest of a pipelined request that never came. A standalone script reproduced it: 12 parallel `select`s hung on 6543, with `max: 1` too. Sequential queries worked, and so did the same parallel queries on the session pooler (5432). Locally there's no pooler, so tests and dev never saw it.
- **Fix:** pin `postgres` to **3.4.7** (exact). The same script finishes in under 1 s on 6543 with v3, including with `max: 1`. *Why not move the runtime to the session pooler instead:* session mode ties one server connection to each client connection, so idle serverless instances use up the Free plan's small pool. Transaction mode is the one meant for serverless (D-8).
- **Before upgrading postgres.js again,** run 12 parallel queries against the hosted `DATABASE_URL` (6543) and make sure they finish.
- **Update (2026-11-15): Claude Code setup starts with `claude mcp remove roundabout -s user`.** *Why:* `claude mcp add` refuses to replace an existing entry with the same name, so after a disconnect or reconnect the owner's Claude Code kept the revoked token and showed "✗ Failed to connect". This happened on production with conn1 versus conn3. Running remove first is harmless on a first setup ("No user-scoped MCP server found") and makes the same steps work for reconnects. Codex needs no equivalent, because it reads the token from `ROUNDABOUT_TOKEN`, so a new token only needs the `setx`/`~/.zshrc` step.
