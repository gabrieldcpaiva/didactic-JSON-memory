# Prompting rules for Nano Banana Pro

Model: `gemini-3-pro-image` (Google DeepMind). Everything below is written for this model. Some rules transfer; not all.

---

## What the model is good at

- Long, accurate text inside images, including non-Latin scripts.
- Following structured briefs with many constraints, because it plans before it draws.
- Holding up to 5 characters and up to 14 reference objects consistent.
- Localized edits: change one thing, keep the rest.

## What it still gets wrong

- Very small text (roughly under 12px in the final image).
- Exact digit strings, especially prices and dates.
- Counting more than a handful of repeated items.
- Hands, thin straps, and transparent materials.
- Keeping a layout identical across languages without a layout master.

Design around these. Do not fight them.

---

## The block order

The renderer writes blocks in this order. The order is deliberate: the first line sets the job, the last line sets the quality bar.

| Block | What it answers | Length |
|---|---|---|
| `task` | What is the one job? | 1–2 sentences |
| `canvas` | Shape, resolution, reference count | auto-generated |
| `subject` | Who or what, and its exact state | 1–3 sentences |
| `scene` | Where it sits, what is empty | 2–4 sentences |
| `style` | What visual language | 2–4 words |
| `camera` | Framing, angle, fill | 1 sentence |
| `light` | Direction, softness, shadow | 1 sentence |
| `text_in_image` | Exact strings, quoted, placed | 1 line each |
| `locks` | What must not change | 1 line each |
| `avoid` | Known failure modes | 1 line each |
| `lessons` | Proven rules from memory | budget-limited |
| `check` | Final self-check | auto-generated |

**Why this order:** the model weighs early lines more than late ones. The task and the subject are non-negotiable. Style words are cheap to move. Lessons sit near the end because they are refinements, not the brief. If a lesson must beat everything, promote it into `locks` instead.

---

## The ten rules

### 1. One job per image

"Make it brighter, change the background, and add a headline" produces a compromise on all three. Run three passes.

### 2. Text is data, not prose

Wrong: *Add a headline saying your morning starts here in big letters.*
Right: `"YOUR MORNING STARTS HERE" — top third, bold condensed, cream`.

The quotes are the signal. Everything else is placement.

### 3. Keep strings short

Under 32 characters is reliable. Under 80 is the hard limit in this repo's validator. Two lines maximum per text item.

### 4. Name empty space

"Leave room for text" → centered subject, no room.
"The left third stays empty" → the model builds the composition around it.

### 5. Lock one feature per line

```
- Label text and spelling stay exactly as in the reference.
- Proportions stay the same. No reshaping.
- Material finish stays frosted amber glass.
```

Three specific lines beat one line saying "keep it the same".

### 6. Positive beats negative

"Empty background" works better than "no clutter".
Keep `avoid` for the failures you have actually seen. Five lines maximum.

### 7. Aspect ratio is a composition decision

| Ratio | Use |
|---|---|
| 4:5 | Marketplace, Instagram feed |
| 1:1 | Multi-purpose, catalog grid |
| 16:9 | YouTube, slides, web banner |
| 9:16 | Stories, Reels, TikTok |
| 21:9 | Site hero, wide banner |
| `auto` | Edits — keeps the source shape |

### 8. Resolution: test cheap, deliver sharp

1K and 2K cost the same on this model; 4K is roughly double. So:

1. Sketch ideas at 1K.
2. Re-run the winner at 2K for delivery.
3. Use 4K only when the image will be printed or cropped hard.

### 9. Reference images are signal, not volume

One reference for identity, one for outfit or product, one for style. Feeding five makes the model average them.

State what each reference is for:

```
Use reference 1 for the face. Use reference 2 for the outfit. Use reference 3 for the drawing style.
```

### 10. Close with a check

One final line asking the model to verify text spelling and to avoid unrequested labels, watermarks and UI elements. Cheap, and it measurably reduces stray text.

---

## Language and localization

- One language per image. Mixed scripts leak glyphs.
- Make the first language the **layout master** and attach it as a reference for the others.
- Never ask the model to translate. Supply native copy.
- Some languages need more vertical space: Japanese, Thai, German compounds. Write shorter headlines, not smaller type.
- Diacritics are the most common defect. Check at 100%.

---

## Editing real photos

- Use `aspect_ratio: "auto"` so framing does not change.
- One repair per run: light, or damage, or background — not all three.
- Ban beautification explicitly. The default direction smooths skin and slims faces.
- Ask to keep grain on scans and old prints.
- Never overwrite the original file.

---

## What NOT to put in a prompt

| Do not write | Why |
|---|---|
| Raw JSON | Braces and quotes get painted into the image |
| "Make it viral" | Not measurable; changes nothing |
| Long lists of camera gear | Noise; the model does not need a lens catalog |
| More than 30 lines | Late rules get dropped |
| Three languages in one image | Guaranteed glyph errors |
| Your brand story | The model cannot use narrative; give it visual decisions |

---

## Cost math

At ~$0.134 per 1K/2K image and ~$0.24 at 4K:

- 3 drafts at 1K + 1 delivery at 2K ≈ **$0.54** per accepted image.
- Same job with 3 drafts at 4K ≈ **$0.96**.
- A 20-image client set with this method ≈ **$10–12** in model cost.

That gap is the entire margin argument for a service business. Full numbers and offer structures: [`PLAYBOOK.md`](PLAYBOOK.md).

*Prices are from public sources in October 2026 and will change. Re-check before quoting.*
