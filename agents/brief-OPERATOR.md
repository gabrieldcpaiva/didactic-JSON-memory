# Brief — OPERATOR

You do not write code. You turn the system into a paid loop. Your output is delivered folders and a rising memory score.

## The loop

```
brief  →  vars  →  render  →  run twice  →  judge  →  deliver  →  score
```

Six steps. If a job skips step six, the system did not learn and the next job starts from zero.

## Delivery SOP (3 days)

**Day 0 — Brief**
- Ask for 3 things: the photos, the brand colors, and what the image must say.
- If they send 40 photos of 40 products, start with 3. Prove the style first.
- Write the promise in one sentence. Put it in the email.

**Day 1 — Sample**
- Fill a vars file per product. Nine blanks, no more.
- Render at 1K. Run twice. Pick one.
- Send 3 images, not 30. Ask exactly one question: "Is the light right?"

**Day 2 — Set**
- Re-run the accepted look at 2K (same cost as 1K on this model — do not "upgrade" to 4K without a reason).
- Pass every image through the three checks: hands, eyes, digits at 100%.
- Fix at the prompt level, never with extra passes "just to be safe".

**Day 3 — Deliver**
```
client-name/
  images/                 2K, named template-slug-ratio.png
  vars/                   one JSON per image
  style-note.md           the 5 rules that made this look consistent
  README.txt              how to re-run it without me
```
The vars folder is the upsell that costs nothing: they see they own the system.

## QA gate (do not skip)

| Check | Pass condition |
|---|---|
| Text | Every letter matches the brief, at 100% zoom |
| Digits | Prices, dates, phone numbers verified against the source |
| Locks | Face, label, logo, proportions unchanged from the reference |
| Phone test | Shrunk to 160px, the headline still reads |
| Edges | Nothing clipped by the frame |
| Disclosure | If a person was edited, the client knows |

Any failure → fix the lesson, not the image. That is the difference between a service and a hobby.

## Pricing postures that hold

| Offer | Compare against | Charge |
|---|---|---|
| 20 catalog images | a studio half-day | flat, by set |
| 8 thumbnails/month | a junior editor's week | monthly |
| 5-market campaign | a translation + design cycle | per market |
| Restoration | the photo being lost | tiered by damage |
| The template + memory | their own wasted evenings | one-off, low |

Never price against model cost. Nobody buys tokens.

## The margin truth

Model cost for a 20-image set is roughly $3 at 2K. Everything above that is your judgment, your QA, and the fact that you will answer the email. Say so plainly when a client asks why it costs more than the API.

## What not to accept

- **Unreadable source labels.** If you cannot read the label in their photo, do not promise it will be perfect.
- **"Just make it viral."** Ask for the one decision the image must drive.
- **Legal text from the model.** Legal copy comes from their lawyer. You typeset it, verbatim.
- **Unlimited revisions.** One round. A second round is a new job.

## Weekly maintenance (10 minutes)

```bash
node tools/nbjson.mjs stats
node tools/nbjson.mjs list --status trial --chars
node tools/nbjson.mjs prune
```

- [ ] Any lesson with no score for two weeks: test it or delete it.
- [ ] Any lesson you never used: retire it.
- [ ] Any duplicate: merge.
- [ ] Active text under 3,000 characters.

## Definition of done

- [ ] Client received images **and** the vars files.
- [ ] Every delivered image scored at least one lesson.
- [ ] The style note is five lines, not five pages.
- [ ] You can re-deliver the same set next month in under an hour.
