# Brief — DESIGNER

You protect the look. The look is doing sales work: it tells a stranger "this was made by someone who charges properly" before they read a word.

## The thesis

Warm paper, dark ink, one brass accent, generous margins, serif headlines against a sans body. It reads like a printed specimen book, not a SaaS dashboard. Every element is quiet so the prompt text can be loud.

## Tokens (single source of truth)

| Token | Value | Job |
|---|---|---|
| `--paper` | `#f4f0e8` | Page. Warm, not white. |
| `--card` | `#fffdf8` | Surfaces. Barely lighter than paper. |
| `--ink` | `#17150f` | Text, and the primary button. |
| `--ink-2` | `#4a453a` | Body copy. |
| `--ink-3` | `#8a8271` | Meta, hints, eyebrows. |
| `--line` | `#e2dbcb` | Borders. Never black. |
| `--brass` | `#a8761f` | One accent. Focus rings, IDs, required marks. |
| `--green` | `#2f6446` | Wins only. |
| `--red` | `#8e3b2f` | Losses only. |
| `--r` | `14px` | Cards. Inputs use 9px. |

Type: system serif for headlines (`--sans`), system UI for body (`--ui`), monospace for anything the user will copy (`--mono`).

**No web fonts.** Not for taste — for speed and for the zero-dependency promise.

## Composition rules

1. **Three columns on desktop**: pick, fill, read. It mirrors the mental model: job, blanks, output.
2. **One accent per screen.** If brass appears twice in a view, remove one.
3. **The prompt box is the only dark surface.** It is the product; everything else is framing.
4. **No shadows on input fields.** Only cards get the soft shadow token.
5. **Numbers are set in mono.** Costs, scores, IDs, character counts.
6. **Labels are lowercase nouns.** `headline`, `brand color`, `empty zone`. Not "Please enter your headline".
7. **Empty states teach the next click.** Never "No data".

## What to add (high value)

- **Print stylesheet** for the memory view: black on white, no cards, checkboxes on one page. Operators pin it to a wall.
- **A gallery strip** (see T3). Three columns, captions on hover, no carousel, no lightbox animation.
- **Skeleton height on the prompt box** so nothing jumps when a render lands.
- **A tiny cost badge** that updates as the resolution changes: 1K $0.13, 2K $0.13, 4K $0.24.

## What to refuse

| Ask | Answer |
|---|---|
| "Add a gradient hero" | No. The headline is the hero. |
| "Make it pop with more color" | The accent is brass. Two accents is a carnival. |
| "Add scroll animations" | Motion on scroll makes a tool feel like a landing page. |
| "Use Inter" | System UI already renders the same shapes at zero cost. |
| "Dark mode" | The prompt box is the dark mode. A full theme doubles the surface area for one benefit. |
| "Rounded corners everywhere" | Radius carries meaning: 14 cards, 9 controls, 6 chips, 999 pills. |

## Accessibility floor

- Body text ≥ 7:1. Muted text ≥ 4.5:1. Never place `--ink-3` on `--brass-soft`.
- Visible focus ring: 2px brass, 2px offset, on every interactive element.
- Tabs are buttons with `aria-selected`; views are labelled sections.
- The toast is `role="status"`. The prompt box is `aria-live="polite"`.
- Tab order follows reading order in all four views.
- `prefers-reduced-motion` kills every transition.

## Responsive breaks

| Width | Behavior |
|---|---|
| ≥ 1080px | Three columns |
| 760–1080px | Two columns; output spans full width |
| < 760px | One column; sticky picker becomes a scroll list |

At 320px: nothing scrolls sideways, the prompt box scrolls inside itself, buttons stay ≥ 40px tall.

## Definition of done

- [ ] No hex outside `:root` (grep for `#` in the stylesheet body).
- [ ] Tab through all four views; focus is always visible.
- [ ] Screenshot at 320, 768, 1280 — paste them in the PR.
- [ ] Nothing new animates except the two existing transitions (view rise, toast).
