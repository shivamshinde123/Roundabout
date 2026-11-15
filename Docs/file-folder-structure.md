# File and folder structure

Target layout for the first release. Add folders only when there is code to put in them.

```
Roundabout/
├── Docs/                          # Product and engineering docs (this folder)
│   ├── Roundabout.md              # Product requirements (primary source)
│   ├── Roundabout workflow atlas.html
│   ├── Crosswalk review and product planning.docx
│   └── *.md                       # Living engineering docs
├── video/                         # Product video (D-43): its own Remotion project (scenes, voiceover and music scripts); excluded from the app's lint, typecheck and Vercel upload
├── site/                          # Project website (D-42): one static page plus assets/ (icon, product video + poster, D-44), published to GitHub Pages by .github/workflows/pages.yml
├── drizzle/                       # Generated SQL migrations (checked in, never hand-edited after they're applied)
├── supabase/
│   └── config.toml                # Local Supabase settings (auth providers, redirect URLs)
├── src/
│   ├── proxy.ts                   # Session refresh + auth redirect (Next.js 16 name for middleware)
│   ├── app/
│   │   ├── layout.tsx             # Root html/body, theme
│   │   ├── (auth)/                # Signed-out pages
│   │   │   ├── actions.ts         # signIn, signUp, Google, password reset
│   │   │   ├── fields.tsx         # Labelled input
│   │   │   ├── sign-in/page.tsx
│   │   │   ├── sign-up/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   ├── auth/callback/route.ts # OAuth / email-link callback
│   │   ├── (app)/                 # Signed-in shell (sidebar: projects, agents, inbox count)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx           # Redirects to the last project or shows the empty state
│   │   │   ├── projects/[projectId]/
│   │   │   │   ├── page.tsx       # Project overview
│   │   │   │   ├── inbox/page.tsx # Needs your input
│   │   │   │   ├── activity/page.tsx
│   │   │   │   ├── boards/[boardId]/page.tsx   # Kanban board + ?task= side panel
│   │   │   │   └── actions.ts     # Task, board and review server actions
│   │   │   ├── tasks/actions.ts   # Task server actions (create, edit, move, assign)
│   │   │   ├── agents/
│   │   │   │   ├── page.tsx       # Agent list
│   │   │   │   ├── new/page.tsx   # Connect agent (shows the token once)
│   │   │   │   ├── [agentId]/page.tsx
│   │   │   │   └── actions.ts
│   │   │   └── settings/page.tsx  # Account: sign-in methods, sign-out
│   │   └── api/mcp/route.ts       # MCP endpoint
│   ├── server/                    # Server-only code (imports 'server-only')
│   │   ├── db/
│   │   │   ├── schema.ts          # Drizzle tables (mirrors database-schema.md)
│   │   │   └── client.ts
│   │   ├── auth.ts                # requireOwner(), authenticateAgent(), token hashing
│   │   ├── policy.ts              # Access + owner-only checks
│   │   ├── errors.ts              # AppError + codes
│   │   ├── events.ts              # append() activity events
│   │   ├── idempotency.ts
│   │   ├── workspace.ts           # ensureWorkspace
│   │   ├── projects.ts            # projects + boards (create/rename/reorder/list)
│   │   ├── actions.ts             # formAction() + orNotFound() helpers for actions/pages
│   │   ├── agents.ts              # connections, grants, rotate, revoke
│   │   ├── tasks.ts               # CRUD, state machine, assign/accept/reassign/reopen, badges
│   │   ├── handoffs.ts
│   │   ├── blockers.ts
│   │   ├── messages.ts
│   │   ├── results.ts             # submit, approve, request changes
│   │   ├── inbox.ts               # Needs your input query
│   │   ├── activity.ts            # Project activity feed + filters
│   │   ├── updates.ts             # list_updates + pending-updates note (D-41)
│   │   └── mcp/tools.ts           # MCP tool registrations → services
│   ├── lib/
│   │   ├── schemas.ts             # Zod input schemas shared by actions and MCP tools
│   │   └── supabase/              # Browser + server Supabase clients (auth only)
│   └── components/
│       ├── ui/                    # shadcn/ui primitives (generated; Radix + Nova preset, `components.json`)
│       ├── action-form.tsx        # Server-action form: pending state, announced errors, keeps fields
│       ├── board/                 # board.tsx (Board/Column/Card/MoveMenu, dnd-kit), badges, task-fields, new-task, task-panel, close-panel, auto-refresh
│       ├── task/                  # TaskPanel, MessageThread, ResultList, HandoffList, BlockerList, History
│       └── agents/                # ConnectAgentForm, TokenReveal, SetupInstructions
├── tests/                         # Vitest, one file per service (tasks.test.ts, handoffs.test.ts, …)
│   ├── setup.ts                   # Localhost guard + reset before each test
│   ├── helpers.ts                 # resetDb + seed helpers (owner, project, agent)
│   ├── fixtures/dev-owner.json    # Local-only account for manual browser checks
│   └── server-only-stub.ts        # Lets tests import 'server-only' modules
├── .github/workflows/ci.yml       # Lint, typecheck, test (Supabase Postgres), build
├── public/                        # Static assets
├── .env.example                   # Committed; .env.local is gitignored
├── AGENTS.md                      # Generated by Next.js (agent notes for this Next version); keep it
├── README.md                      # Setup + scripts
├── drizzle.config.ts
├── eslint.config.mjs
├── next.config.ts
├── vitest.config.mts
├── package.json                   # npm
└── tsconfig.json
```

## Ownership rules

- `src/server/**` is the only place that imports the database client. Pages, actions and the MCP route call services.
- `src/app/**/actions.ts` and `src/server/mcp/tools.ts` are thin adapters: parse, call the service, map the result.
- `src/components/**` never imports from `src/server/**`. Data reaches components through props from server components, or through action calls.
- Split a service file once it passes about 400 lines. Don't split one ahead of time.
