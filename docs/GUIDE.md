# Guide: from zero to a finished image

This is the beginner path. Follow it in order. Every command is copy-paste ready.

---

## Step 0 — What you need

- Node.js 18 or newer. Check with `node --version`.
- A text editor. Any editor. Notepad is fine.
- Access to Nano Banana Pro (Gemini app, AI Studio, or your own API key).

You do **not** need to install anything. This repo has no dependencies.

---

## Step 1 — Check the repo is healthy

```bash
cd didactic-JSON-memory
node tools/nbjson.mjs validate
```

You should see `✓` next to every template and the memory file.

If you see `✗`, the message tells you the exact file, the exact field, and what to do. Example:

```
✗ poster.nano_banana_prompt.settings.aspect_ratio: "4x5" is not supported.
  Use one of: auto, 1:1, 3:2, ...
```

Fix the file, run `validate` again.

---

## Step 2 — Render your first prompt

```bash
node tools/nbjson.mjs render product-hero-shot --vars examples/candle.vars.json
```

You get a block of labeled sentences between two lines. That block is your prompt.

Read it once. You should be able to understand every line. If a line confuses you, delete it — you own the file.

---

## Step 3 — Run it in Nano Banana Pro

1. Open Nano Banana Pro.
2. Attach your reference photo (for the product template, the photo of the real product).
3. Paste the rendered prompt.
4. Set the aspect ratio and resolution shown at the bottom of the output.
5. Generate.

**Beginner tip:** run it twice. Same prompt, two results. Pick the better one. The model varies more than you expect.

---

## Step 4 — Judge the result honestly

Use three questions only:

1. Is the text spelled exactly right? (If there is text.)
2. Is the thing you locked still correct? (Face, label, logo, proportions.)
3. Would it survive being small on a phone?

If any answer is no, note **which line** of the prompt failed. That line is the lesson.

---

## Step 5 — Feed the memory

```bash
# The lesson helped. Promote it.
node tools/nbjson.mjs score L006 win

# The lesson hurt. Push it down.
node tools/nbjson.mjs score L017 loss

# You learned something new.
node tools/nbjson.mjs add --title "Name the light" \
  --instruction "Say the light direction in words: soft key from the top left." --tags light,product
```

Rules for a good lesson:

- One sentence.
- It must be an instruction, not a story.
- It must fit in one prompt line (under 240 characters).
- It must be checkable: either the image follows it or it does not.

Bad lesson: *"I noticed that when I used a 100mm lens it sometimes looked nicer."*
Good lesson: *"Name the lens feel in words: 100mm macro look, product fills 70% of the frame."*

---

## Step 6 — Make your own template

Copy the closest template and change it:

```bash
cp templates/product-hero-shot.json templates/my-poster.json
```

Then edit these fields in order. Do not skip ahead.

1. `id` — short name, lowercase, dashes.
2. `tags` — 2–4 words. These pick the memory lessons.
3. `goal_summary` — one sentence.
4. `nano_banana_prompt.settings` — aspect ratio, resolution, reference count.
5. `blocks.task` — the single job, starting with a verb.
6. `blocks.subject`, `scene`, `style`, `camera`, `light` — describe, do not decorate.
7. `blocks.text_in_image` — one entry per string, exact characters.
8. `blocks.locks` — three lines maximum. The things that must not change.
9. `blocks.avoid` — five lines maximum. Short.
10. `input_schema` — every `{{name}}` in the prompt needs a field here with a real example.
11. `examples` — one filled example. This is your documentation.

**Optional fields.** If a placeholder is nice-to-have, mark the field `"required": false` and give it a `"default"`. The default fills itself, so the template still runs when you leave it blank. If an optional field has no default and is used in the prompt, `validate` warns you — because that render will stop.

Then:

```bash
node tools/nbjson.mjs validate my-poster
node tools/nbjson.mjs render my-poster
```

The renderer prints every value you must fill, pre-filled with the example values. Edit, save, render again.

---

## Placeholders

Anything in double braces is a slot: `{{product_name}}`.

- Slots work anywhere in the prompt blocks.
- A value file is a flat JSON object.
- Missing values stop the render and print a starter file for you.
- A value file can also be a **list** of objects. Then you get one prompt per item. That is batch mode.

```json
[
  { "headline": "SLEEP FIXED", "text_color": "warm cream" },
  { "headline": "FIVE FOR $10", "text_color": "mustard yellow" }
]
```

```bash
node tools/nbjson.mjs render youtube-thumbnail --vars my-batch.json --out ./prompts/
```

---

## Common mistakes

| Symptom | Cause | Fix |
|---|---|---|
| Words you never asked for | Model inventing filler | Add "Render only these strings" + list them |
| Text cut off at the edge | No margin instruction | Add "inside the margin" to placement |
| Product looks redesigned | No locks | Add one lock per feature that matters |
| Face looks like a different person | Beautify default | Add the anti-beautify line |
| Image is a photo of a poster | No flat-page instruction | Add "no perspective, no shadows, no mockup" |
| Prompt feels ignored at the end | Prompt too long | Cut to 30 lines. Move the important rule to the top |
| Accents missing | Mixed languages | One language per image |
| Numbers wrong | Model estimating | List digits exactly, then check at 100% |

---

## Daily routine (5 minutes)

- [ ] Render one prompt.
- [ ] Run it twice.
- [ ] Score one lesson.
- [ ] Add one lesson if you learned something.
- [ ] Run `node tools/nbjson.mjs stats` once a week to keep the memory lean.

That is the whole discipline. Small, daily, compounding.
