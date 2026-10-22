# Brief — REVIEWER

You are the last person before a stranger sees this. Your job is not to find faults; it is to make sure nothing on the page needs an apology.

## The five-minute gate

```bash
npm test                      # 24 checks, must be all green
node tools/nbjson.mjs validate # every template + memory, zero errors
node tools/nbjson.mjs help     # flags must match the docs, character for character
node app/server.mjs            # then click every control once
```

Then read the diff. Not the summary. The diff.

## The "beggar" test

A thing looks cheap when it apologises for existing. Check for these, in order:

| Tell | What it looks like | Fix |
|---|---|---|
| Fake precision | "10× faster!" with no baseline | Delete, or state the baseline |
| Placeholder copy | "Lorem", "Coming soon", "TBD" | Remove the feature or finish it |
| Orphan numerals | A price with no unit or date | Add unit and date, or cut it |
| Two accents | Brass button **and** brass chip **and** brass link on one screen | Keep one |
| Uneven rhythm | Spacing steps of 18, 20, 22, 24 px | Snap to 4/8/12/16/24/32 |
| Hover-only meaning | Content that appears only on hover | Put it in the markup |
| Broken promise | Docs claim a flag the code lacks | Fix one of the two, in this PR |
| Silent failure | A button that does nothing when a field is empty | Disable it, or explain in place |
| Inconsistent naming | `aspect_ratio` in code, `aspect ratio` in docs, `ratio` in UI | Pick one per layer and stick to it |
| Unjustified number | "94% accuracy" with no source | Source it or label it as an estimate |
| Borrowed authority | A lesson with `wins: 5` and no evidence | Zero it, or write how you know |

## Claims audit

Every number in the docs must be one of:

1. **Runnable** — you can produce it with a command. Paste the command.
2. **Sourced** — a link, with a date.
3. **Labelled** — "my priors", "estimated", "as of October 2026".

If a claim is none of the three, delete it. An unsourced number is the cheapest way to look expensive and be poor.

## Code review specifics

- **Rendering changes**: re-run `render` on two templates. Paste both outputs. A silent extra line changes every image the user makes.
- **Memory changes**: confirm `workflow` lessons still cannot reach a prompt. There is a test for it; do not weaken the test to pass it.
- **Path handling**: any new file path must resolve inside the repo. Try `../`.
- **Error copy**: every `throw` a user can reach must read as an instruction, not a stack trace.
- **Dependencies**: `package.json` `dependencies` must stay absent. `devDependencies` too.

## PR body template

```
What changed
- one line per idea

Proof
- npm test → 24 passing
- validate → 7 templates, 0 errors
- render <template> output below (2 lines of it)

Claims touched
- "…" is now runnable via `npm run …` / sourced at <link> / labelled as estimate

Not done
- what you deliberately left out, and why
```

## Refusal list

- Refuse a PR that adds a dependency without a paragraph defending it.
- Refuse a PR that adds a feature to `app/` but no test for its failure path.
- Refuse a PR that improves the look by hiding a broken state.
- Refuse a PR that claims "fully tested" when only the happy path ran.

## Definition of done

- [ ] Five-minute gate is green.
- [ ] Every control clicked at 320px and 1280px.
- [ ] Every number on the page is runnable, sourced, or labelled.
- [ ] PR body pasted, with real output.
- [ ] Nothing in the diff makes you want to write "minor issue, can fix later" — fix it now or cut it.
