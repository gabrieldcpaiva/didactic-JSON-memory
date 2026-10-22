# didactic-JSON-memory

**A zero-dependency system for writing image prompts as JSON — with a memory that learns which rules actually work.**

Built for Nano Banana Pro (`gemini-3-pro-image`). Written for people who are not programmers.

Two ways in: a **web app** for people who never want to touch a terminal, and a **CLI** for people who do.

No installs. No accounts. No build step. Node.js and a text editor.

---

## The three problems this fixes

1. **Good prompts die in chat history.** You write a perfect prompt on Tuesday and cannot find it on Friday.
2. **Bad habits repeat.** You forget the same four fixes every time. Nothing records what worked.
3. **Prompt files rot.** They grow into 3,000-word blobs where the important rule is buried in line 40.

This repo answers all three with one idea: **store the prompt as data, not as prose.** Then a 200-line script renders it, and a scored memory file adds only the lessons that earned their place.

---

## Quickstart — the app

```bash
node app/server.mjs        # → http://localhost:5173
```

Pick a job. Fill nine blanks. Press **Render prompt**. Copy. Paste into Nano Banana Pro.

The app shows the settings to use, the token count, the cost of one image, and the exact lessons that went into the prompt — each with a ✓ / ✕ so you can score it on the spot. What you score changes what the next prompt contains.

Three views: **Build** (the form), **Memory** (what it has learned, and your human checklist), **How it works** (the loop, the limits, the CLI).

## Quickstart — the CLI

```bash
node tools/nbjson.mjs validate
node tools/nbjson.mjs render product-hero-shot --vars examples/candle.vars.json
node tools/nbjson.mjs score L006 win
npm test
```

Same engine, same files. Use whichever fits the moment.

---

## What is in the box

```
app/         Zero-dependency web app: server.mjs + plain HTML/CSS/JS.
templates/   7 ready packages. Fill the blanks, render, run.
memory/      core.memory.json — 18 lessons, all shipping at 0/0, unproven.
lib/         validate.mjs, render.mjs, memory.mjs. Plain JS, no deps.
tools/       nbjson.mjs — one CLI for validate / render / add / score.
schemas/     JSON Schema files for editors and other tools.
examples/    Real values files, including a 3-item batch.
tests/       24 checks: 14 engine, 10 server. `npm test`.
docs/        GUIDE.md, PROMPTING.md, MEMORY.md, PLAYBOOK.md.
agents/      Handoff coordinates: a task graph and four role briefs.
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

## Handoff: passing this to another agent

`agents/handoff.json` is a machine-readable task graph (T1–T6) with owners, steps, acceptance checks and explicit do-nots. Four briefs carry the judgment that does not fit in JSON:

| Brief | Owns |
|---|---|
| `brief-BUILDER.md` | API adapter, per-client forks, gallery. With a list of temptations to refuse. |
| `brief-DESIGNER.md` | The tokens, the composition rules, the accessibility floor. |
| `brief-OPERATOR.md` | The 3-day delivery SOP, pricing postures, the QA gate. |
| `brief-REVIEWER.md` | The five-minute gate, the "beggar" test, the claims audit. |

Start with `agents/README.md`. It takes four minutes and tells you which brief is yours.

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

**The file you receive has no results in it.** All 18 lessons ship at 0 wins, 0 losses, status `trial`, marked `provenance: "prior"`. That is not modesty, it is the design: a score you did not observe is a decoration. The first honest number in this repo will be the one you add.

`prune` respects that. It will not delete a prior for being untested — only for failing.

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
| Fake authority | Nothing claims a win it did not earn |

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

## Design notes

Warm paper, dark ink, one brass accent. Serif headlines, system UI body, mono for anything you will copy. No web fonts, no framework, no animation beyond two transitions — because the product is the prompt text, and everything else should get out of its way.

The prompt box is the only dark surface on the page: it is the thing you came for.

## Design notes

- **A rendered prompt is not a guarantee.** The model still varies. Run two or three and pick.
- **Small text still breaks.** Below ~12px in the final image, expect errors in any language.
- **This does not call the API.** It prepares the prompt. You paste it into Gemini, AI Studio, or your own code. (T1 in the handoff adds an adapter.)
- **The app has no auth.** It is a local tool. Do not put it on a public URL as-is.
- **Every shipped lesson is an untested prior.** Scores, statuses and evidence all start empty. The memory is built to be filled by your results, not mine.
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
