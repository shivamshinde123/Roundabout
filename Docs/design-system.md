# Design system

Roundabout's look follows **Linear**: a midnight precision instrument (decision D-29). The owner picked it from the Linear entry in the Refero Styles library (styles.refero.design). This file is our own adaptation for an app UI, not a copy of that DESIGN.md. Tokens live in `src/app/globals.css`, and everything else reads them through shadcn/Tailwind tokens. **Don't hard-code colours in components.**

## Principles

- **Darkness is the substrate.** The app is dark-only (`<html class="dark">`, `color-scheme: dark`). Surfaces step up a few shades instead of floating on shadows.
- **One action colour.** Acid lime is used for the single primary action in a view (filled buttons) and for the focus ring, nothing decorative. Everything else is grey.
- **Geometry over ornament.** Hairline borders separate things, radii are small, density is compact, and there are no gradients.

## Colour tokens

| Token | Value | Use |
|---|---|---|
| `--background` | `#08090a` Void | Page canvas |
| `--card` / `--sidebar` | `#0f1011` Carbon | Board columns, cards, task panel, sidebar |
| `--popover`, `--muted`, `--secondary` | `#161718` Obsidian | Menus, dialogs, toasts, muted chips |
| `--accent` | `#1c1e21` | Hover wash |
| `--border` / `--input` | `#23252a` / `#2c2e33` | Hairline borders, input outlines |
| `--foreground` | `#e5e5e6` Bone | Body text. Headings (h1–h3) are pure white. |
| `--muted-foreground` | `#8a8f98` Fog | Metadata and timestamps (≈5.9:1 on cards) |
| `--primary` / `--ring` | `#e4f222` Acid lime, with `#08090a` text on it | Primary buttons, focus ring, text selection (35%) |
| `--destructive` | `#eb5757` Coral | Delete buttons, Blocked and no-access badges, alerts |

Status is always a **text** label (Blocked, Waiting for pickup, …); colour only supports it.

## Type

- **Inter** (via `next/font`) for all UI, with `cv01` and `ss03` glyph alternates. **JetBrains Mono** for tokens, commands and IDs, standing in for Linear's Berkeley Mono.
- Weights stay between 400 and 590: Tailwind's `font-semibold` and `font-bold` both map to **590**, so nothing renders heavy.
- Headings get slight negative tracking (-0.012em).

## Shape and density

- `--radius: 6px` for buttons and inputs. Cards and dialogs use `radius-xl` (≈8px), staying under Linear's 12px maximum. Badges and pills stay pill-shaped.
- Compact spacing on a 4px grid, with 8px between elements.
- Dialog overlays are `black/60` with a light blur, so a dialog stands clearly above the dark page.
- No shadows for separation (borders do that), and no gradients.
