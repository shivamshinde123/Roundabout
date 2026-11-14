# UI/UX wireframes

Low-fidelity layouts for the first release. Diagram numbers refer to the workflow atlas, and O1–O5 to the Crosswalk review.

## Global rules

- **One shell:** a left sidebar (project switcher, the selected project's boards, Overview, Needs your input with a count, Activity, Agents, Settings) and the content area on the right.
- **Status is always a text label**, with colour as a supplement. Badges: `Waiting for pickup` · `Handoff → Codex` · `Blocked` · `Stalled` · `Agent can't access` · `Needs review`.
- **Keyboard:** every action has a focusable control. Cards have a "Move…" menu as an alternative to dragging. Esc closes the task panel and returns focus to the card.
- **Every list has empty, loading and error states** (shown at the end of this document).

## Sign in (diagram 01)

```
┌──────────────────────────────┐
│          Roundabout          │
│  [ Continue with Google   ]  │
│  ───────── or ─────────      │
│  Email    [______________]   │
│  Password [______________]   │
│  [ Sign in ]                 │
│  Forgot password? · Create account │
└──────────────────────────────┘
```
The Google button and divider are shown only when Supabase reports the Google provider is enabled. The email stays filled after a failed attempt. Error states: invalid credentials, unverified email ("Check your inbox" with a Resend link), Google cancelled (back here with a retry).

## Project overview (O1, diagram 04)

```
┌ Sidebar ──────┐┌ Website redesign ──────────────────────────────────────────┐
│ ▾ Website     ││ Backlog 3 · To Do 4 · In Progress 2 · Review 1 · Done 12     │
│   Overview    ││──────────────────────────────────────────────────────────────│
│   Design      ││ NEEDS YOUR INPUT (3)                              View all → │
│   Development ││ ● Blocked   "Need write access to acme/api"   Codex   [Open] │
│ Needs input 3 ││ ● Review    "Hero section build"         Claude Code [Review]│
│ Activity      ││ ● Stalled   "Fix footer links" waiting 26h           [Open]  │
│ Agents        ││──────────────────────────────────────────────────────────────│
│ Settings      ││ AGENTS                                                      │
│               ││ Claude Code  Active · last check 4m ago · 1 in progress      │
│               ││ Codex        Active · last check 2h ago · 1 waiting          │
│               ││──────────────────────────────────────────────────────────────│
│               ││ RECENT RESULTS & HANDOFFS                                   │
│               ││ 10:42 Claude Code → Codex  "API wiring" (accepted)          │
│               ││ 10:15 Codex submitted "Nav component" → Done                │
└───────────────┘└──────────────────────────────────────────────────────────────┘
```

## Kanban board (O2/O3, diagram 08)

```
Development ▾   [+ New task]                                     ↻ updated 6s ago
┌ Backlog ─────┐┌ To Do ───────┐┌ In Progress ─┐┌ Review ──────┐┌ Done ────────┐
│┌────────────┐││┌────────────┐││┌────────────┐││┌────────────┐││┌────────────┐│
││Footer links│││Fix login bug│││API wiring   │││Hero section │││Nav component││
││Unassigned  │││Codex        │││Codex  ⦿     │││Claude Code  │││Codex        ││
││            │││⏳ Waiting for│││Next: add    │││Result: PR   │││Approved by  ││
││            │││   pickup    │││ auth header │││ #14 opened  │││ you         ││
││        [⋯] │││        [⋯] │││🛑 Blocked   │││ Needs review│││        [⋯] ││
│└────────────┘││└────────────┘│││        [⋯] │││   [Review]  ││└────────────┘│
└──────────────┘└──────────────┘└──────────────┘└──────────────┘└──────────────┘
```

**Card anatomy (O3):** a grip handle (⋮⋮) is the drag source, so Enter on the title opens the task rather than starting a drag; title · owning or assigned agent · `Next:` line (in progress) or `Result:` line (review and done) · badges · a ⦿ icon when review is required · the `[⋯]` menu with Move to…, Assign, Reassign and Open. Long titles wrap to two lines and are then truncated, with the full title in the panel.

## Task panel (diagrams 04, 10–14)

Opens on the right with the board still visible. The URL becomes `?task=<id>`.

```
┌ API wiring ──────────────────────────────── [×] ┐
│ In Progress · Codex · Review required ⦿         │
│ [Reassign] [Request…] [Move board ▾]            │
│─────────────────────────────────────────────────│
│ Instructions                                    │
│   Wire the frontend to /api/orders …            │
│ Expected result  PR against main with tests     │
│ Repo  acme/web · branch feat/orders             │
│ Links  Figma spec ↗ · Ticket ↗                  │
│─────────────────────────────────────────────────│
│ 🛑 BLOCKER (open)  raised by Codex · 09:58      │
│   Need write access to acme/api                 │
│   Q: Can you add Codex as a collaborator?       │
│   [Answer]  [Mark resolved]                     │
│─────────────────────────────────────────────────│
│ HANDOFFS                                        │
│   Claude Code → Codex · accepted 09:40          │
│   Done: scaffolded client · Next: add auth hdr  │
│─────────────────────────────────────────────────│
│ RESULTS                                         │
│   (none yet)                                    │
│─────────────────────────────────────────────────│
│ DISCUSSION                                      │
│   Claude Code → you · 09:35 · read              │
│   [ Write a message…            ] [Send]        │
│─────────────────────────────────────────────────│
│ HISTORY ▸ (expand)                              │
└─────────────────────────────────────────────────┘
```

**Review state:** the results section shows the pending submission with `[Approve]` and `[Request changes]`. Request changes opens a required comment field. Earlier submissions stay listed with their decisions.

## Needs your input (O5, diagram 16)

```
Needs your input · Website redesign                 Filter: [All ▾]
┌─────────────────────────────────────────────────────────────────┐
│ REVIEW   Hero section — Claude Code submitted 10:20             │
│          "PR #14 opened"            [Approve] [Request changes] │
│ BLOCKED  API wiring — Codex · "Need write access to acme/api"  │
│          [Answer] [Open task]                                   │
│ QUESTION Footer links — Claude Code asks "Keep old URLs?"       │
│          [Reply] [Open task]                                    │
│ STALLED  Fix login bug — waiting for Codex pickup 26h           │
│          [Reassign] [Open task]                                 │
│ NO ACCESS  Search page — "Old Codex" was disconnected           │
│          [Reassign]                                             │
└─────────────────────────────────────────────────────────────────┘
```
Inline actions: Approve (review), Reply (question), Mark resolved (blocker), and Open task or Reassign… for the rest. Resolved items leave the list after the action succeeds. In-app alerts are the per-project count, shown in the sidebar and on the "Needs your input (n)" tab. A failed save keeps the item and shows a retry.

## Activity (diagram 15)

```
Activity · Website redesign     Agent: [All ▾]  [☐ Handoffs only]  [Reset]
10:42  Codex        accepted handoff from Claude Code   API wiring →
10:40  Claude Code  proposed handoff to Codex           API wiring →
10:20  Claude Code  submitted result                    Hero section →
```

## Agents and Connect agent (diagrams 05–06)

```
Agents                                           [+ Connect agent]
Claude Code   Active   Projects: Website, Docs   Last check 4m ago   [Manage]
Codex         Error    "Token rejected 2h ago"   Last check 2h ago   [Reconnect]
```

```
Connect agent — step 1 of 2
Client   (•) Claude Code  ( ) Codex  ( ) Other
Name     [Claude Code – laptop]
Projects [☑ Website] [☐ Docs]
[Create connection]

Connect agent — step 2 of 2
Copy this token now. It won't be shown again.
[rbt_X9f…………………………………] [Copy]
Claude Code:  claude mcp add --scope user --transport http roundabout <url> --header "Authorization: Bearer …" [Copy]
Waiting for first contact… ⟳   (becomes "Connected ✓" once the agent calls whoami)
```

**Agent profile:** status, granted projects (editable), last successful check, waiting assignments, in-progress tasks, recent events, and the actions `[Update access]`, `[Reconnect]` (rotates the token) and `[Disconnect]`, which requires confirmation. After a disconnect, the page lists the affected tasks with Reassign buttons.

## Shared states

| State | Pattern |
|---|---|
| Empty workspace | "Create your first project" plus a name field |
| Empty board | Columns visible, with "No tasks yet" and [+ New task] in Backlog |
| No agents | Agents page: "Connect Claude Code or Codex to start assigning work" plus a button |
| Needs your input empty | "Nothing needs you right now" |
| Loading | Skeleton cards. No spinners on refresh, because it happens silently in the background |
| Load error | Inline banner: "Couldn't load. [Retry]" |
| Conflict | Toast: "This task changed since you opened it. Showing the latest." The board refreshes |
| No access / missing | "Not found or you don't have access" with a link back to the overview (`src/app/not-found.tsx`; malformed ids are treated the same) |
