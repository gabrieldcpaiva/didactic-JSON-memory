# Brief — BUILDER

You write the code. The constraint that matters: **zero dependencies, and the browser trusts the server.**

## Ground truth

```bash
npm test                                  # 24 checks
node tools/nbjson.mjs validate            # every template + memory
node app/server.mjs                       # http://localhost:5173
node tools/nbjson.mjs render product-hero-shot --vars examples/candle.vars.json
```

Files that matter, in order:

| File | Why |
|---|---|
| `lib/render.mjs` | The only place JSON becomes words. Change nothing casually. |
| `lib/memory.mjs` | Scoring, promotion, selection. The "learning" claim lives here. |
| `lib/validate.mjs` | The rules, in readable form. Errors are user-facing copy. |
| `app/server.mjs` | Six API routes and static files. Read it in one sitting. |
| `app/public/app.js` | Vanilla client. No framework, no build. |
| `templates/*.json` | Data, not code. New capability usually belongs here. |

## Your tasks

### T1 — Gemini API adapter

Goal: a rendered prompt becomes an image, with a spend ceiling that actually stops.

```js
// app/generate.mjs (sketch)
export async function generate({ prompt, settings, apiKey = process.env.GEMINI_API_KEY }) {
  if (!apiKey) {
    const e = new Error('No API key. Set GEMINI_API_KEY. Nothing was generated and nothing was charged.');
    e.code = 'NO_KEY';
    throw e;
  }
  // POST → parse image bytes → return { bytes, mime, cost, model }
}
```

Rules:
- **Fail closed.** No key, no output, no fake placeholder image.
- **Dry run first.** `--dry-run` prints prompt, settings and estimated cost.
- **Ceiling.** `MAX_SPEND_USD` per process. Before each call, add the projected cost. Refuse past the line.
- **Report the real number.** Cost comes from the response, not from a hardcoded table.
- **Never log the key.** Redact anything longer than 20 chars that looks like a key.

Acceptance: a stub HTTP server test proves the request shape, the refusal path, and the ceiling.

### T2 — Per-client forks

One shared memory is a demo. One memory per client is a business.

```bash
node tools/fork.mjs --client acme        # → clients/acme/{templates,memory}
node tools/nbjson.mjs render product-hero-shot --client acme --vars acme.vars.json
```

Resolve paths from a single function:

```js
const projectDir = (client) => client ? join(ROOT, 'clients', client) : ROOT;
```

Never merge lessons across clients automatically. A client's failure list is their advantage.

### T3 — Gallery

The fastest trust builder is a strip of accepted images with the prompt that made them.

```
gallery/youtube-thumbnail/sleep-fixed.json
{
  "image": "sleep-fixed-16x9-2k.png",
  "vars":  { "headline": "SLEEP FIXED", "..." : "..." },
  "prompt_sha": "…",
  "verdict": "accepted",
  "lessons": ["L002", "L004", "L005"]
}
```

Keep each image at 1K, under 400 KB. Show the lessons used — that is the story.

## What will tempt you, and why to refuse

| Temptation | Why it breaks the product |
|---|---|
| React + Vite | Adds 300 MB and a build step to a 120-line server. |
| A JSON Schema library | The hand-written validator's messages *are* the UX. |
| Auto-retry on 429 | Spend happens silently. Never. |
| Storing prompts in a DB | Files are the feature. They diff in Git. |
| Growing memory to 100 lessons | The prompt gets slower and the model ignores the tail. |

## Definition of done

- [ ] `npm test` green, `validate` clean.
- [ ] New flags appear in `nbjson.mjs help` **and** in the docs, with the same spelling.
- [ ] No new dependency.
- [ ] One test per new failure path.
- [ ] If you changed rendering, re-run `render` on two templates and paste both outputs in the PR.
