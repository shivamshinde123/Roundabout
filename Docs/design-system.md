# Design system

Roundabout's look follows **Campsite**: a warm paper workspace, quiet, cream and product-forward (decision D-30, which replaces D-29's Linear dark theme). The style comes from the Campsite entry in the Refero Styles library (styles.refero.design). This file is our own adaptation for an app UI. Tokens live in `src/app/globals.css`, and everything else reads them through shadcn/Tailwind tokens. **Don't hard-code colours in components.**

## Principles

- **Paper, not screen.** The page is a warm off-white. Cards and panels are pure white and sit on it with hairline borders and barely any shadow.
- **Almost no colour.** Ink-black text and ink-black filled buttons. Colour appears only where it means something: red for destructive actions and alerts.
- **Quiet and compact.** One typeface, small radii, a 4px grid, and the product content as the only texture.

## Colour tokens

| Token | Value | Use |
|---|---|---|
| `--background` / `--sidebar` | `#fffdf9` Warm canvas | Page and sidebar. Never pure white for the page. |
| `--card` / `--popover` | `#ffffff` | Cards, task panel, dialogs, menus, toasts |
| `--muted`, `--secondary` | `#f5f5f5` Ash mist | Board columns, muted chips, active tab |
| `--accent` | `#f0f0f0` Soft fog | Hover wash |
| `--border` / `--input` | `#ebebeb` / `#e5e5e5` | Hairline borders, input outlines |
| `--foreground` | `#171717` Ink | Text and headings (never pure black) |
| `--muted-foreground` | `#737373` Steel | Metadata and timestamps (≈4.7:1 on white) |
| `--primary` | `#171717`, with white text | Filled primary buttons |
| `--ring` | `#a3a3a3` | Focus ring |
| `--destructive` | `#ef4444` | Delete buttons, Blocked and no-access badges, alerts |

Status is always a **text** label (Blocked, Waiting for pickup, …); colour only supports it.

## Type

- **Inter** (via `next/font`) for everything, at weights 400 (body), 500 (labels) and 600 (headings). `font-bold` maps to 600, so nothing renders heavy.
- **JetBrains Mono** for tokens, commands and IDs.
- Headings get slight negative tracking (-0.018em).

## Shape and density

- `--radius: 8px` for buttons and inputs. Cards and dialogs use `radius-xl` (≈11px), and badges are pills.
- Compact spacing on a 4px grid, with 8px between elements and 16px card padding.
- Dialog overlays are `black/20` with a light blur.
- No gradients, no heavy or coloured shadows, no glassmorphism.
