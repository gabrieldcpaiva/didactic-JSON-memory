# didactic-JSON-memory

**A tiny, zero-dependency system for writing image prompts as JSON — with a memory that learns which rules actually work.**

Built for Nano Banana Pro (`gemini-3-pro-image`). Written for people who are not programmers.

No installs. No API keys. No accounts. Node.js and a text editor.

---

## The three problems this fixes

1. **Good prompts die in chat history.** You write a perfect prompt on Tuesday and cannot find it on Friday.
2. **Bad habits repeat.** You forget the same four fixes every time. Nothing records what worked.
3. **Prompt files rot.** They grow into 3,000-word blobs where the important rule is buried in line 40.

This repo answers all three with one idea: **store the prompt as data, not as prose.** Then a 200-line script renders it, and a scored memory file adds only the lessons that earned their place.

---

## Quickstart

```bash
# 1. Check that everything is healthy (no install needed)
node tools/nbjson.mjs validate

# 2. Render a finished prompt from a template
node tools/nbjson.mjs render product-hero-shot --vars examples/candle.vars.json

# 3. Paste the output into Nano Banana Pro. Attach your reference photo.
```

That is the whole loop. Everything else is optional.

---

## What is in the box

```
templates/   7 ready packages. Fill the blanks, render, run.
memory/      core.memory.json — 18 scored lessons, 15 active.
lib/         validate.mjs, render.mjs, memory.mjs. Plain JS, no deps.
tools/       nbjson.mjs — one CLI for validate / render / add / score.
schemas/     JSON Schema files for editors and other tools.
examples/    Real values files, including a 3-item batch.
tests/       14 smoke tests. `npm test`. No test framework needed.
docs/        GUIDE.md, PROMPTING.md, MEMORY.md, PLAYBOOK.md.
```

| Template | Use it for |
|---|---|
| `product-hero-shot` | One phone photo → clean catalog hero |
| `youtube-thumbnail` | Readable thumbnail, one face, three words |
| `notes-to-infographic` | Bullet notes → one-page graphic |
| `brand-mascot-scene` | Same character, new scene, no drift |
| `photo-repair-and-light` | Dark or damaged photos, people unchanged |
| `localized-ad-set` | One ad per language, identical layout |
| `brand-style-lock` | Build the reusable style plate the others borrow |

---

## The loop that makes it learn

```
render  →  run  →  judge  →  score  →  render better
```

```bash
node tools/nbjson.mjs render youtube-thumbnail --vars my.json
# Look at the image. Did the headline survive the phone test?
node tools/nbjson.mjs score L005 win      # the lesson that helped
node tools/nbjson.mjs score L017 loss     # the one that did not
node tools/nbjson.mjs add --title "Name the light" \
  --instruction "Say the light direction in words: soft key from the top left." --tags light,product
```

Two wins promote a lesson. A score of −2 retires it. Nothing else is allowed in.

---

## Why JSON instead of a text file

| Plain text prompt | JSON prompt package |
|---|---|
| Free-form, drifts every edit | Fixed fields, same shape every time |
| No idea what to fill in | `input_schema` tells you, with examples and defaults |
| Cannot be checked | `validate` catches bad ratios, long text, missing locks |
| One prompt per file | One package renders unlimited variants from a list |
| Reuse means copy-paste | Reuse means change two values |
| No record of what worked | Scored memory injects proven lessons only |

The last row is the real reason. Everything else is housekeeping.

---

## The rules this system encodes

These come from the model's documented behavior and from testing. Full detail in [`docs/PROMPTING.md`](docs/PROMPTING.md).

1. One job per image. Three changes in one pass gives you mush.
2. Put on-image text in its own quoted block. Never inside a sentence.
3. Keep each string under ~32 characters. Hard ceiling 80.
4. Reserve empty space by name: "the left third".
5. Lock what must not change, one line per feature.
6. Say what you want, not only what you hate.
7. Test at 1K, deliver at 2K. 1K and 2K bill the same; 4K costs about double.
8. Never paste raw JSON into the model. Read it, then write sentences.
9. One language per image. Use the first language as the layout master.
10. Check hands, eyes and digits at 100% before you save.

---

## Model facts (checked 2026-10)

| Item | Value |
|---|---|
| Model id | `gemini-3-pro-image` |
| Resolutions | 1K, 2K, 4K (4K ≈ 4096px long side) |
| Aspect ratios | 15, from 1:8 to 8:1, plus `auto` for edits |
| Reference images | up to 14 per prompt |
| Consistent characters | up to 5 per workflow |
| Input limit | 65,536 tokens |
| Cost | ~$0.134 at 1K/2K, ~$0.24 at 4K |
| Watermark | SynthID in every output |

Sources: [Google DeepMind model page](https://deepmind.google/models/gemini-image/pro/), [Google Cloud model card](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-pro-image), [Google Cloud prompting guide](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana). Prices and limits change — re-check before you quote a client.

---

## Honest limits

- **A rendered prompt is not a guarantee.** The model still varies. Run two or three and pick.
- **Small text still breaks.** Below ~12px in the final image, expect errors in any language.
- **This does not call the API.** It prepares the prompt. You paste it into Gemini, AI Studio, or your own code.
- **The seed scores are my starting priors, not lab results.** Score them yourself; the memory is designed to overwrite my opinion with your evidence.
- **SynthID is embedded in every output.** Do not present generated images as untouched photographs.

---

## How this works (short version)

1. A **template** holds fixed craft knowledge: composition, locks, failure list.
2. A **vars file** holds the parts that change: product name, headline, colors.
3. `render` merges them, pulls the best few **memory lessons**, and writes labeled sentences.
4. You run it, judge the result, and **score** the lessons.
5. The memory stays small because weak lessons retire automatically.

Leverage: one template × N vars files × M lessons = you never write a prompt from scratch again.

---

## License

MIT. Use it, sell what you make with it, keep your own lessons private.
