# Design system

Roundabout's look follows the **Linear app**: three dark layers, visible hairlines, and a few colourful icons to keep it lively (decision D-31, which replaces D-30's Campsite light theme). The owner chose it from a screenshot of Linear's issue view. Tokens live in `src/app/globals.css`; per-project icons, status icons and agent avatars live in `src/lib/visual.tsx`. **Don't hard-code colours in components.**

## Layers

| Layer | Token | Value | Where |
|---|---|---|---|
| Shell | `--background`, `--sidebar` | `#0f0f11` | Page and sidebar, the darkest plane |
| Panel | `--panel` (`bg-panel`) | `#17171a` | The inset content area: `m-2`, `rounded-xl`, bordered |
| Card | `--card` | `#1d1d21` | Task cards, task panel, stage counters, agent rows |
| Column | `--muted` | `#1b1b1e` | Board columns, chips |
| Popover | `--popover` | `#222226` | Menus, dialogs, toasts |
| Hover | `--accent` | `#26262b` | Hover wash, active tab |
| Lines | `--border` / `--input` | `#2a2a2f` / `#303036` | Hairlines, which are visible on purpose |

## Colour

- **Text:** `#e6e6e8`. Metadata uses `#8d8d95` (≈5.6:1 on the panel). Headings are white.
- **One action colour, Linear indigo `#5e6ad2`:** primary buttons, focus ring, and the Done status.
- **Destructive, coral `#eb5757`:** Delete buttons, Blocked and no-access badges, alerts.
- **Status icons** (`StatusIcon`): Backlog is a dashed grey circle, To Do a light circle, In Progress a yellow half-filled circle (`#f2c94c`), Review a green ring with a dot (`#4cb782`), Done an indigo check.
- **Project icons** (`ProjectIcon`): one of 12 lucide icons in one of 8 accent colours, chosen from a hash of the project id. A project always keeps its icon, and nothing is stored.
- **Agent avatars** (`AgentAvatar`): the agent's initial on a circle coloured by client. Claude Code is `#d97757`, Codex `#10a37f`, other agents indigo.
- Status is always a **text** label too; colour only supports it.

## Type and shape

- **Inter** for the UI and **JetBrains Mono** for tokens and commands. `font-semibold` and `font-bold` both map to **590**. Headings use -0.012em tracking.
- `--radius: 6px` for controls; panels, cards and dialogs use `rounded-xl` or `rounded-lg`. Dialogs sit on a `black/50` overlay.
- Lucide icons at 14–16px: in the sidebar (projects, Agents, Settings, Sign out) and on project tabs (Overview, Needs your input, Boards, Activity).

## Activity feed

`src/components/activity-feed.tsx` renders both the overview's "Recent results and handoffs" and the Activity page as a Linear-style timeline:
- an `EventIcon` (a coloured lucide icon per event type) on a thin rail
- the actor in bold, with an `AgentAvatar` for agents, and the action in muted text, naming the target agent for assignments and handoffs
- the task as a small bordered chip that links to it
- the time on the right, with the full date on hover
- result summaries and decline reasons in a boxed second line
