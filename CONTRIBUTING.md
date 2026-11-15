# Contributing to Roundabout

Thanks for helping! Bug reports, client setup fixes, docs and code are all welcome. By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Found a bug or want a feature?** [Open an issue](https://github.com/shivamshinde123/Roundabout/issues/new/choose) first, so we can agree on the approach before you write code.
- **Found a security problem?** Don't open an issue. Follow [SECURITY.md](SECURITY.md).
- **Small fixes** (typos, docs, a wrong setup step) can go straight to a pull request.

## Set up locally

You need **Node 22+** and **Docker Desktop** (running).

```bash
npm install
npm run db:start            # local Supabase on ports 643xx; prints the publishable key
cp .env.example .env.local  # paste the key into NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run db:migrate
npm run dev                 # http://localhost:3000
```

Emails (sign-up confirmation, password reset) land in the local inbox at http://127.0.0.1:64324.

## Make a change

1. Fork the repo and create a branch from `main`.
2. Make your change. Keep it focused: one fix or feature per pull request.
3. Run the same checks CI runs:

   ```bash
   npm run lint
   npm run typecheck
   npm test        # needs local Supabase running; only deletes @test.roundabout data
   ```

4. If you changed `src/server/db/schema.ts`, run `npm run db:generate` and commit the new migration in `drizzle/`.
5. Open a pull request and fill in the template.

## How the code is organised

- **One set of rules.** The web app and the MCP tools both call the services and policy in `src/server/`. Put business rules there, never in a page or a tool handler, so the board and agents can't drift apart.
- **Every write is one transaction:** lock the task, check its state and owner, apply the change, record an activity event, bump the revision.
- **Badges are derived, never stored** (Waiting for pickup, Handoff, Blocked, Stalled, Agent can't access).

More detail is in [`Docs/`](Docs/): [coding-conventions.md](Docs/coding-conventions.md), [system-architecture-document.md](Docs/system-architecture-document.md) and [flow.md](Docs/flow.md).

## Docs and decisions

If your change alters behaviour, update the matching doc in `Docs/`, and add an entry to [decision.md](Docs/decision.md) when you make a choice someone might later wonder about. Record *why*, not just *what*.

## Adding or fixing a client setup guide

Client guides live in `src/lib/agent-setup.ts`, and `tests/agent-setup.test.ts` checks each config shape. Please cite the client's official docs in the PR, and update [client-compatibility.md](Docs/client-compatibility.md). If you've verified a client end to end, say how.

## Licence

Roundabout is [MIT licensed](LICENSE). By contributing, you agree that your contributions are licensed under the same terms.
