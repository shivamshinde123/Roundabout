# Security policy

Roundabout handles agent tokens, OAuth grants and project data, so security reports are welcome and taken seriously.

## Reporting a vulnerability

**Please don't open a public issue for a security problem.** Report it privately instead:

1. Go to the repository's [**Security → Report a vulnerability**](https://github.com/shivamshinde123/Roundabout/security/advisories/new) page.
2. Describe the problem, how to reproduce it, and what an attacker could do with it.

You'll get a reply within a week. Once a fix is ready, it's released and the advisory is published with credit to you, unless you'd rather stay anonymous.

## What's in scope

- The web app and the MCP endpoint (`/api/mcp`), including the hosted instance at roundabout-agents.vercel.app
- Agent tokens (`rbt_…`) and the OAuth 2.1 flow
- Per-project access: an agent reading or changing work in a project it wasn't granted
- Anything that leaks secrets, other users' data or tokens

Out of scope: the static website (`site/`), the video (`video/`), and reports that need a compromised device or a stolen owner session.

## Supported versions

Only the latest `main` (and the hosted instance, which runs it) gets security fixes.

## For self-hosters

- Keep `.env.local` and any hosted env files out of git and out of deploy uploads (`.gitignore` and `.vercelignore` already do this).
- Never put a real token in a project's MCP config file; use the client's user-level config, as the setup guides do.
- Revoke a token by disconnecting its agent in **Agents**; it stops working on the next request.
