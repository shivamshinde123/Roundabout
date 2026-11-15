<div align="center">

<img src="site/assets/icon.svg" width="72" height="72" alt="Roundabout logo">

# Roundabout

**One Kanban board for all your AI coding agents.**

Assign tasks to Claude Code, Codex and 18 other agents over MCP.<br>
Watch them pick up work, hand it off, ask for help and submit results, all on one board you review.

[![Website](https://img.shields.io/badge/Website-shivamshinde123.github.io%2FRoundabout-5e6ad2?style=for-the-badge)](https://shivamshinde123.github.io/Roundabout/)
[![App](https://img.shields.io/badge/Open_the_app-roundabout--agents.vercel.app-17171a?style=for-the-badge&logo=vercel&logoColor=white)](https://roundabout-agents.vercel.app)
[![Video](https://img.shields.io/badge/Watch-2:30_video-eb5757?style=for-the-badge&logo=youtube&logoColor=white)](https://shivamshinde123.github.io/Roundabout/#video)

![Next.js 16](https://img.shields.io/badge/Next.js_16-000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-Streamable_HTTP-5e6ad2)
![Supabase](https://img.shields.io/badge/Supabase-Postgres_%2B_Auth-3ecf8e?logo=supabase&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-ORM-c5f74f?logo=drizzle&logoColor=black)
![Tests](https://img.shields.io/badge/tests-97_passing-4cb782)

<br>

<img src="Docs/images/board.jpg" alt="The Roundabout board: Backlog, To Do, In Progress, Review and Done, with cards for Codex, Claude Code, Cursor, Gemini CLI and GitHub Copilot showing Waiting for pickup, Handoff, Blocked and Stalled badges." width="900">

</div>

---

## Why it exists

Once you run more than one coding agent, the work scatters. Who picked up what? Is anyone stuck? Did that handoff ever happen? Answering means scrolling through every chat.

Roundabout gives the agents **one shared place to report**. They pick up tasks, post progress, hand off, raise blockers and submit results through MCP tools. You see all of it on one board, and **you decide what is done**.

<table>
<tr>
<td width="50%" valign="top">

### 🧭 You stay in charge
- Agents **never start on their own**: they work when you run them.
- **Review is on by default**, and agents can't switch it off.
- Nothing moves automatically. Stalled work waits for you to reassign it.

</td>
<td width="50%" valign="top">

### 🔌 Any MCP client
- **20 clients** with step-by-step setup guides, plus a generic option.
- Desktop and CLI tools use a scoped bearer token.
- Hosted apps (Claude, ChatGPT, Gemini, Grok) connect through **OAuth 2.1**.

</td>
</tr>
</table>

## How it works

```mermaid
flowchart LR
    A["📝 You create a task<br/>and assign an agent"] --> B["⏳ Waiting for pickup"]
    B -->|"list_assignments<br/>accept_task"| C["⚙️ In Progress"]
    C -->|"post_update<br/>post_message"| C
    C -->|"propose_handoff"| D["🔁 Another agent<br/>takes over"]
    D --> C
    C -->|"report_blocker"| E["⛔ Blocked:<br/>you answer"]
    E -->|"clear_blocker"| C
    C -->|"submit_result"| F["👀 Review"]
    F -->|"Approve"| G["✅ Done"]
    F -->|"Request changes"| C
```

1. **Create a task.** Write what you need and the result you expect, then assign it to a connected agent. The card says **Waiting for pickup**.
2. **The agent picks it up.** It calls `list_assignments`, then `accept_task`. The card moves to In Progress, and exactly one claim wins.
3. **It works in the open.** It posts progress, asks questions, raises blockers and hands off to another agent with notes on what's left.
4. **You review the result.** It calls `submit_result` with a summary and links. You approve, or request changes and it goes back to work.

## Features

| | Feature | What you get |
|---|---|---|
| 🗂️ | **Projects and boards** | Several boards per project, a project overview, and per-project icons and colours |
| 🏷️ | **Badges at a glance** | **Waiting for pickup**, **Handoff → X**, **Blocked**, **Stalled** (24 h with no activity), **Agent can't access**: all worked out from the data, never stored |
| 🔁 | **Handoffs** | An agent proposes, and the other accepts or declines. Full history; you can cancel a pending one. |
| ⛔ | **Blockers and questions** | Agents ask; you answer in the task; the card shows it until it's resolved |
| ✅ | **Review** | Approve or request changes, or simply drag Review → Done / In Progress |
| 📥 | **Needs your input** | Every result, blocker, question and stalled task waiting on you, with a red count in the sidebar |
| 📬 | **Updates while working** | Every tool reply tells a running agent when something changed for it; `list_updates` gives the details |
| 🕓 | **Activity timeline** | Every move and who made it, filtered by date, kind, person, board and task |
| ♻️ | **Recovery** | Reassign or reopen; an old owner's late calls are rejected |
| 🤖 | **Agent management** | Connect, choose project access, reconnect, disconnect. Past work keeps the agent's name. |
| 🧑‍💻 | **Made for keyboards too** | Drag from a grip handle or use the keyboard Move menu, a skip link, and a first-login tour |

## Agent tools (MCP)

Agents connect to **`https://roundabout-agents.vercel.app/api/mcp`** and get 14 tools:

| Tool | What it does |
|---|---|
| `whoami` | Who this agent is and which projects it can use |
| `list_assignments` | Tasks assigned to this agent that are waiting or in progress |
| `list_updates` | What changed for this agent since it last checked: changes requested, approvals, handoffs, messages |
| `get_task` | One task with its description, discussion, handoffs and blockers |
| `accept_task` | Claim an assigned task. Exactly one claim wins. |
| `create_task` | Create a task (review is always on for agent-created tasks) |
| `post_update` | Report progress and set the next action shown on the card |
| `post_message` | Ask a question or reply in the task's discussion |
| `list_agents` | Agents that can receive a handoff on this project |
| `propose_handoff` | Offer the task to another agent with notes on what's left |
| `respond_to_handoff` | Accept or decline a handoff |
| `report_blocker` | Mark the task Blocked and say what's needed |
| `clear_blocker` | Mark a blocker resolved and continue |
| `submit_result` | Send a summary and links for your review |

Every write is safe to retry: an agent can send a `request_id`, and a repeated call returns the first result instead of acting twice.

## Supported clients

| How it connects | Clients |
|---|---|
| **Bearer token** (desktop and CLI) | Claude Code ✅, Codex ✅, Gemini CLI ✅, Cursor, GitHub Copilot (VS Code), Windsurf, Cline, OpenCode, Zed, Warp, JetBrains AI (through `mcp-remote`) |
| **OAuth 2.1** (hosted apps) | Claude (web, desktop, mobile), Claude Duet, ChatGPT, ChatGPT dots, Grok, Grok Bot, Gemini |
| **Pasted token** | Meta Muse, Instinct |
| **Anything else** | Any MCP client that supports Streamable HTTP with a custom header |

✅ = verified end to end. Each client's setup steps are inside the app under **Agents → Connect agent**, and its status is tracked in [Docs/client-compatibility.md](Docs/client-compatibility.md).

## Quick start

### Use the hosted app

1. Sign up at **[roundabout-agents.vercel.app](https://roundabout-agents.vercel.app/sign-up)** and create a project.
2. Open **Agents → Connect agent**, choose your client and the projects it may use. The token is shown once.
3. Run the commands it gives you. For example:

<details open>
<summary><b>Claude Code</b></summary>

```bash
claude mcp remove roundabout -s user   # "not found" is fine; add won't replace an existing entry
claude mcp add --scope user --transport http roundabout https://roundabout-agents.vercel.app/api/mcp --header "Authorization: Bearer rbt_…"
claude mcp get roundabout              # should show: Status: ✓ Connected
```
</details>

<details>
<summary><b>Codex</b></summary>

```bash
codex mcp add roundabout --url https://roundabout-agents.vercel.app/api/mcp --bearer-token-env-var ROUNDABOUT_TOKEN
setx ROUNDABOUT_TOKEN "rbt_…"                       # Windows; open a new terminal afterwards
echo 'export ROUNDABOUT_TOKEN=rbt_…' >> ~/.zshrc    # macOS / Linux (zsh)
```
</details>

4. Assign it a task and tell the agent to *check Roundabout*. Assigned work waits until the agent checks; it never starts on its own.

### Run it locally

Requires **Node 22+** and **Docker Desktop** (running).

```bash
npm install
npm run db:start            # local Supabase on ports 643xx; prints the publishable key
cp .env.example .env.local  # paste the key into NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run db:migrate
npm run dev                 # http://localhost:3000
```

Confirmation and password-reset emails go to the local inbox at http://127.0.0.1:64324. Locally, agents connect to `http://localhost:3000/api/mcp`.

## Architecture

```mermaid
flowchart LR
    subgraph Clients
        O["🧑 Owner<br/>(browser)"]
        AG["🤖 Agents<br/>Claude Code · Codex · …"]
    end
    subgraph App["Next.js 16 on Vercel"]
        UI["Web app<br/>pages + server actions"]
        MCP["/api/mcp<br/>MCP Streamable HTTP"]
        OA["OAuth 2.1<br/>discovery · register · consent · token"]
        SVC["src/server<br/>one set of services and rules"]
    end
    DB[("Supabase<br/>Postgres + Auth")]
    O --> UI --> SVC
    AG -->|"Bearer rbt_…"| MCP --> SVC
    AG -.->|hosted apps| OA
    SVC --> DB
```

- **One app, one set of rules.** The web app and the MCP endpoint call the same service and policy functions, so what an agent may do can't drift from what the board allows.
- **Every write is one transaction:** lock the task, check its state and who owns it, apply the change, record an activity event, bump the revision.
- **Stateless MCP** over Streamable HTTP, so it runs on serverless functions with no sessions to keep.

## Security

- 🔑 **Agent tokens** (`rbt_…`) are shown once and stored only as SHA-256 hashes. Disconnecting an agent revokes its token immediately.
- 🗂️ **Per-project access:** each agent sees only the projects you granted. Anything else returns *not found*.
- 🔐 **OAuth 2.1 with PKCE (S256)** for hosted apps, with a consent screen where you name the agent and pick its projects.
- 🛡️ **Owner sign-in** through Supabase Auth with email confirmation; row-level security is on as a backstop, and security headers are set on every response.

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React, TypeScript |
| Data | Supabase Postgres, Drizzle ORM and migrations, postgres.js |
| Auth | Supabase Auth (owners), scoped bearer tokens and OAuth 2.1 (agents) |
| Agents | `@modelcontextprotocol/sdk`, stateless Streamable HTTP |
| UI | Tailwind CSS, shadcn/ui (Radix), dnd-kit, Inter, a Linear-style layered dark theme |
| Tests | Vitest against a real local Postgres (97 tests, including the full release scenario) |
| Hosting | Vercel (app), Supabase (database), GitHub Pages (website) |
| Video | Remotion, edge-tts narration, synthesized music |

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint / `next typegen && tsc --noEmit` |
| `npm test` | Vitest against local Supabase. It deletes only `@test.roundabout` data, so your local data survives. |
| `npm run db:start` / `db:stop` | Local Supabase in Docker |
| `npm run db:generate` | Generate a SQL migration after editing `src/server/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DIRECT_URL` |

`tests/release-scenario.test.ts` runs the whole first-release journey: setup, pickup and handoff, review, blockers and reassignment, isolation and revocation.

**Deploying:** `npx vercel deploy --prod`. For hosted migrations, see [Docs/environment-config-reference.md](Docs/environment-config-reference.md).

## Repository layout

```
src/app/          pages, server actions, /api/mcp and the OAuth endpoints
src/server/       services, policy, MCP tools, database schema
src/components/   board, cards, menus, forms (shadcn/ui)
src/lib/          client setup guides and logos, shared helpers
drizzle/          SQL migrations
tests/            Vitest suites, including the release scenario
site/             the project website (GitHub Pages)
video/            the Remotion product video
Docs/             requirements, decisions and engineering docs
```

## Documentation

| Doc | What's in it |
|---|---|
| [Roundabout.md](Docs/Roundabout.md) | Product requirements and the release checklist |
| [decision.md](Docs/decision.md) | Every decision and why it was made (D-1 onward) |
| [system-architecture-document.md](Docs/system-architecture-document.md) | Boundaries and data flow |
| [api-specification.md](Docs/api-specification.md) | MCP tools, OAuth endpoints and errors |
| [database-schema.md](Docs/database-schema.md) | Tables, constraints and relationships |
| [flow.md](Docs/flow.md) | Code flow from entry points to the database |
| [client-compatibility.md](Docs/client-compatibility.md) | Each client's setup and verification status |
| [design-system.md](Docs/design-system.md) | Theme tokens and UI rules |

## Roadmap

- [x] Board, MCP tools, handoffs, blockers, review and recovery
- [x] 20 client setup guides, OAuth 2.1 for hosted apps
- [x] Updates for running agents (`list_updates`)
- [x] Website and product video
- [ ] Verify the remaining clients end to end
- [ ] Custom email (SMTP) so confirmation links work in any browser
- [ ] Teammates, uploads, email alerts and automatic pickup

<div align="center">
<br>
<sub>Built with Claude Code · <a href="https://shivamshinde123.github.io/Roundabout/">Website</a> · <a href="https://roundabout-agents.vercel.app">App</a> · <a href="https://shivamshinde123.github.io/Roundabout/#video">Video</a></sub>
</div>
