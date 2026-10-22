# Coordinates for the next agent

Four briefs, one manifest. Pick up work without reading the whole repo.

```
agents/
  handoff.json          machine-readable task graph (T1–T6)
  brief-BUILDER.md      engineering moves
  brief-DESIGNER.md     the look, and why it must not drift
  brief-OPERATOR.md     turning it into paid delivery
  brief-REVIEWER.md     the gate before merging
```

## Read order (4 minutes)

1. `git log --oneline -3` — what exists now.
2. `npm test && node tools/nbjson.mjs validate` — is the ground solid?
3. `agents/handoff.json` → `invariants`, then the task you were handed.
4. The one brief for your role.

## Pick a task

| Task | Owner | One-line job | Unlocks |
|---|---|---|---|
| T1 | builder | Gemini API adapter | No copy-paste; real images |
| T2 | builder | Per-client folders | Agency work, separate memories |
| T3 | builder | Gallery of real outputs | Trust at first glance |
| T4 | designer | Token hardening + a11y | Look survives edits |
| T5 | operator | First paid SOP | Revenue this week |
| T6 | reviewer | Pre-merge gate | Nothing embarrassing ships |

## Rules of engagement

- **Stay on the branch.** `arena/0d2d2a91-didactic-json-memory`. Do not create branches.
- **Zero dependencies.** If a task seems to need one, the task is wrong.
- **Small commits, plain messages.** One idea per commit.
- **Never claim tested what you did not run.** Paste the command output in the PR body.
- **Leave the repo better than the brief.** If the brief is wrong, fix the brief in the same PR.
- **Do not touch `memory/core.memory.json` scores** unless you actually looked at an image.

## Where the leverage is

1. **T1 + T3 together** turn this from a prompt library into a product: generate, then show what was generated.
2. **T2** is what makes it sellable to agencies. One shared memory is a hobby; one memory per client is a service.
3. **T5** needs no code at all, and it can start today. Code tends to win the attention it does not deserve.

## Known sharp edges

- `app/server.mjs` reads the memory file on every request. Fine at this scale, wrong at 100 users. Cache by mtime when that day comes.
- The renderer budgets lessons by characters, not tokens. `estimateTokens` is a rough 4-chars-per-token guess.
- `templates/*.json` values files are git-ignored (`*.vars.json`) except `examples/`. Do not commit client data.
- The app has no auth. It is a local tool. Do not deploy it publicly as-is.
