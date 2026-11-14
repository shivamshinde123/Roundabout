# Environment and configuration reference

Values live in `.env.local` for local development and in Vercel project settings for deployed environments. `.env.example` lists every key with no values. Never commit `.env*` files except `.env.example`.

## Variables

| Variable | Required | Exposed to the browser | Example / default | Purpose |
|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | yes | yes | `http://localhost:3000` | Absolute URL for auth redirects and the MCP endpoint shown on Connect agent |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | `http://127.0.0.1:64321` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | yes | `sb_publishable_…` (the legacy anon key also works) | Supabase Auth from the browser and server. It can read no app data, because RLS has no policies. |
| `DATABASE_URL` | yes | **no** | `postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres` | App runtime connection through the **transaction pooler**. postgres.js must use `prepare: false`. |
| `DIRECT_URL` | migrations only | **no** | `postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres` | Session or direct connection for `drizzle-kit migrate`. Not set on Vercel. |

There's no service-role key: the app never calls Supabase admin APIs. Add `SUPABASE_SECRET_KEY` (server-only) only if account deletion or a similar admin feature needs it.

## Configured outside the app

| Where | Setting |
|---|---|
| Supabase → Authentication → Providers | Email: confirm email **on**. Google: client ID and secret from Google Cloud. Manual identity linking **on**, so an owner can link Google to an email account (§2). |
| Supabase → Authentication → URL configuration | Site URL = production URL. Redirect URLs = `<site>/auth/callback` and `http://localhost:3000/auth/callback`. |
| Google Cloud → OAuth client | Authorized redirect URI = `https://<project-ref>.supabase.co/auth/v1/callback` |
| `supabase/config.toml` | The same auth settings for local development (`npm run db:start`). **Local ports are 643xx** (API 64321, DB 64322), not Supabase's default 543xx, because Windows/Hyper-V reserves 54258–54357 on the dev machine. |
| Vercel → Project → Functions | Region next to the Supabase region |

## Constants in code (deliberately not configurable)

| Constant | Value | Location | Decision |
|---|---|---|---|
| `STALLED_AFTER` | 24 hours | `src/server/tasks.ts` | D-4 |
| Board refresh interval | 10 s, plus on window focus | `components/board/AutoRefresh.tsx` | D-8 |
| Token prefix | `rbt_` | `src/server/auth.ts` | D-5 |
| Idempotency key retention | 7 days (no cleanup job yet) | `src/server/idempotency.ts` | technical design §5 |

Turn one of these into an environment variable only when it needs different values in different environments.

## Secrets guidance

- `DATABASE_URL` and `DIRECT_URL` contain the database password. They are server-only, so never prefix them with `NEXT_PUBLIC_`.
- Agent tokens are not environment variables on the server. Only their hashes are stored. On the agent's machine, keep the token in the client's config or an environment variable such as `ROUNDABOUT_TOKEN` for Codex.
- Rotate the database password in Supabase if it leaks, then update Vercel and redeploy.
- Store per-environment values in Vercel environment settings (Development, Preview, Production). Preview deployments should point at a separate Supabase project before real data exists.
