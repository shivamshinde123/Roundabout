# Roundabout

A private workspace where one owner assigns tasks to AI coding agents (Claude Code and Codex first) and follows their work, handoffs, blockers and reviews on one Kanban board.

- Product requirements: [Docs/Roundabout.md](Docs/Roundabout.md)
- Decisions: [Docs/decision.md](Docs/decision.md)
- Engineering docs: everything else in [Docs/](Docs/)

## Stack

Next.js 16 (App Router, TypeScript) on Vercel · Supabase Postgres + Auth · Drizzle · MCP (Streamable HTTP) at `/api/mcp` · Vitest. See [Docs/tech-stack.md](Docs/tech-stack.md).

## Local setup

Requires Node 22+ and Docker Desktop (running) for local Supabase.

```bash
npm install
npm run db:start            # starts local Supabase; prints the publishable key
cp .env.example .env.local  # paste the publishable key into NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run db:migrate          # applies drizzle/ migrations
npm run dev                 # http://localhost:3000
```

## Scripts

| Script | What it does |
|---|---|
| `dev` / `build` / `start` | Next.js |
| `lint` / `typecheck` | ESLint CLI / `tsc --noEmit` |
| `test` | Vitest (`tests/**/*.test.ts`), against local Supabase |
| `db:start` / `db:stop` | Local Supabase (Docker) |
| `db:generate` | Generate a SQL migration after editing `src/server/db/schema.ts` |
| `db:migrate` | Apply migrations to `DIRECT_URL` |
