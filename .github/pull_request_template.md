## What and why

<!-- What does this change, and why? Link the issue: "Closes #123". -->

## How I checked it

<!-- Tests added, steps you ran in the browser, an agent client you tried. -->

## Checklist

- [ ] `npm run lint`, `npm run typecheck` and `npm test` pass
- [ ] Business rules live in `src/server/` (shared by the web app and the MCP tools)
- [ ] A new migration is committed in `drizzle/` if the schema changed
- [ ] Docs in `Docs/` are updated if behaviour changed (and `decision.md` for notable choices)
- [ ] No tokens, keys or personal data in the code, tests or screenshots
