# Diagrams

Two pictures of how this repo works, each a self-contained HTML page — open it in a browser, no
server and no network. Both carry light and dark themes, pan and zoom, search, relationship tracing,
and three guided views that walk one story at a time.

| Diagram                                    | Answers                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| [`delivery-loop.html`](delivery-loop.html) | How a change moves from a request to a shipped build, and who checks it        |
| [`standards.html`](standards.html)         | Which standards are advisory, which are blocked, and what actually enforces it |

## What each one says

**`delivery-loop.html`** — the [`feature-loop`](../.claude/skills/feature-loop/SKILL.md) stages as
three lanes: the delivery stages, the evidence captured alongside them, and the three independent
agents. The load-bearing details are the ones easy to lose in prose: the baseline capture sits
_before_ the build because afterwards it cannot be reconstructed, all three agents are terminals
because they report and none of them approves, and the return edge closes the loop back to intent.

**`standards.html`** — the enforcement escalation, left to right, from advisory to unbypassable, with
what each layer owns hanging beneath it. Each node's second line is how escapable that layer is,
which is the whole point: `nothing enforces it` → `--no-verify escapes both` → `no local state
needed` → `cannot be bypassed`. Hover a node for the mechanism behind it.

## Regenerating

The sources are the `.json` files beside the HTML; they are the truth, and the HTML is built from
them by the **archify** skill. Edit the JSON, then validate and deliver:

```bash
node <archify>/bin/archify.mjs validate workflow .archify/delivery-loop.workflow.json --quality showcase --json
```

```bash
node <archify>/bin/archify.mjs deliver workflow .archify/delivery-loop.workflow.json .archify/delivery-loop.html --quality showcase --json
```

…and the same two commands with `architecture` and `standards.architecture.json`. `<archify>` is
wherever the skill is installed on your machine — ask the agent, or run `/archify` and let it drive.

`deliver` refuses anything that fails its nine composition checks, and records a sha256 over the
exact specification bytes. That is why `.archify/` is in `.prettierignore`: a reformat would
invalidate the receipt without changing a single fact.

Browser evidence — screenshots at four viewport sizes in both themes, plus a contact sheet — comes
from a third command:

```bash
node <archify>/bin/archify.mjs visual-check .archify/standards.html --json
```

Those outputs are gitignored. They prove containment and legibility at a real desktop size on the
machine that ran them; they are not something to commit.

## Keeping them honest

A diagram that has drifted from the repo is worse than no diagram, because it is believed. Both of
these are drawn from [`AGENTS.md`](../AGENTS.md), the skills, and the hooks as they actually are —
so when a guard, a stage, or a testing layer changes, the diagram is part of that change. If you find
one of them wrong, the fix belongs in the same PR as whatever made it wrong.
