# Memory: how it learns, and why it stays small

Most "prompt libraries" are archives. This one is a **filter**.

A lesson is not a note. A lesson is a bet: *this sentence changes the result*. It earns its place or it leaves.

---

## The file

```
memory/core.memory.json
```

Three parts:

```json
{
  "rules":   { "max_active_lessons": 24, "max_chars_per_lesson": 240,
               "promote_at": 2, "retire_below": -2 },
  "lessons": [ ... ]
}
```

## The lesson

```json
{
  "id": "L006",
  "title": "Lock the thing that must not change",
  "trigger": "editing a real photo or product",
  "instruction": "Write one line per locked feature: face, label spelling, logo shape, proportions. Unlocked features drift first.",
  "scope": "prompt",
  "tags": ["edit", "product", "character", "photo"],
  "score": 5,
  "wins": 5,
  "losses": 0,
  "status": "active",
  "evidence": "Explicit locks stopped label redesign in product tests."
}
```

Six fields do the work:

| Field | Job |
|---|---|
| `instruction` | The exact sentence injected into a prompt. Written as an order. |
| `scope` | `prompt` = model reads it. `workflow` = human reads it. |
| `tags` | Matched against the package's tags. |
| `score` | `wins − losses`. The ordering key. |
| `status` | `trial` → `active` → `retired`. |
| `evidence` | One line. If you cannot write it, the lesson is a guess. |

---

## The lifecycle

```
        add
         ↓
      [trial] ──2 wins──→ [active] ──score ≤ −2──→ [retired]
         │                    ↑                        │
         └──score ≤ −2────────┘                        │
                                                      │
                              score > −2 ─────────────┘
                                 (back to trial)
```

- **trial** — new, unproven. Still used, at lower priority.
- **active** — earned its place. Used first.
- **retired** — kept as a warning. Never injected.

Retired lessons are not deleted. They are the record of what you already tried. `prune` only removes trial lessons that were never scored at all.

---

## Prompt scope vs workflow scope

This is the part most systems get wrong.

| Scope | Example | Goes into the image prompt? |
|---|---|---|
| `prompt` | "Add a soft contact shadow under the base." | Yes |
| `workflow` | "Check every digit at full zoom before sending." | No |

Mixing them wastes tokens and confuses the model. Telling an image model to "check at 100% zoom" is meaningless — the model has no zoom. Telling a human to "add a contact shadow" is a step they will skip.

The renderer injects only `scope: "prompt"`. The `checklist` command prints only `scope: "workflow"`.

```bash
node tools/nbjson.mjs checklist --tags text,quality
```

---

## Selection: how a lesson gets chosen

1. Filter by `scope: "prompt"` and status `active` or `trial`.
2. Keep lessons whose tags overlap the package tags.
3. Sort by tag hits, then score, then wins, then id (deterministic, so output is reproducible).
4. Fill a character budget (default 1400 chars, about 350 tokens).
5. Stop. The rest wait.

Determinism matters: same inputs → same prompt. You can compare two runs and know the difference is the model, not the renderer.

---

## Why the cap is 24

Active lessons at ~120 characters each = ~2,900 characters ≈ 720 tokens.

That is fine once. It is wasteful when a project only needs five of them. The cap forces a decision: *which rules do we actually believe?*

If you hit the cap, retire something. Do not raise it. Raising the cap is how prompt libraries rot.

---

## Maintenance, once a week

```bash
node tools/nbjson.mjs stats        # counts + token weight
node tools/nbjson.mjs list --status trial --chars
node tools/nbjson.mjs prune        # dry run first
```

- [ ] Any trial lesson older than two weeks with zero scores? Delete it or test it.
- [ ] Any active lesson you have not used in a month? Retire it.
- [ ] Any two lessons saying the same thing? Merge them.
- [ ] Any lesson that only applies to one template? Tag it tighter.
- [ ] Is active text under 3,000 characters? If not, cut.

---

## Testing the engine

```bash
npm test
```

14 checks: templates valid, placeholders covered, defaults applied, determinism, the promote/retire lifecycle, workflow lessons kept out of prompts, budget respected, disk round-trip. If you change `lib/`, run this.

## Importing lessons from elsewhere

```json
{
  "lessons": [
    { "title": "Name the light", "instruction": "Say the light direction in words.", "tags": ["light"] }
  ]
}
```

```bash
node tools/nbjson.mjs learn my-lessons.json
```

Duplicates are merged by exact instruction text, not skipped. A repeated lesson gains a win — because you encountered the same truth twice.

---

## What this is not

- Not a chat log.
- Not a knowledge base.
- Not per-project memory.

One memory file, one shared truth. If you need per-client rules, copy the repo per client and keep the client's name in the file. A fork beats a schema explosion.

---

## Porting the idea elsewhere

The lifecycle is model-agnostic. To use it for video prompts (Veo), copy generation (any LLM), or ad copy:

1. Keep `instruction`, `tags`, `score`, `wins`, `losses`, `status`.
2. Change the selector's scoring weights.
3. Change the renderer's block labels.

The file format does not need to change. That is the point.
