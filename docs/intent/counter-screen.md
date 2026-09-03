# Intent: an Expo mobile app with a counter

Author: originator (repo owner) · Status: accepted

Written **after** the spec rather than before it, which is worth stating plainly. Stage 1 was
skipped at first because the request was direct enough to serve as its own intent — the standard
sizing rule in [`feature-loop`](../../.claude/skills/feature-loop/SKILL.md). Two decisions then had
to go back to the originator mid-flight, and `change-reviewer` was right that those answers were
being cited by the spec, the plan and a commit message while living in no artifact of their own.
This file is that artifact. Anything resuming this work reads it here rather than reconstructing it
from a conversation that has scrolled away.

## Problem

The repository had the full delivery harness — skills, guard hooks, review agents, CI, release
workflows — and no application at all. There was no `src/`, no route, no screen, nothing to run. So
nothing in it had ever been exercised end to end: not the Expo config, not the `@/*` alias, not the
web bundler, and not the Maestro or Playwright layers.

The request, verbatim and in full:

> create a expo mobile app with a counter

## Proposed outcome

Someone can open the app on iOS, Android or the web and see a counter they can raise, lower and
reset. It is a small, honest first screen whose real job is to make the harness true: to be the
first thing that actually boots, renders in both appearance modes, and is covered at every test
layer the repo claims to have.

## Decisions taken by the originator

Both were escalated during the loop rather than settled by whoever was building, because the repo
already contained a written claim that contradicted the reading being built.

1. **The count clamps at zero.** `CHANGELOG.md` already described "a clamped counter". The first
   draft of the spec had it going negative — simpler logic, but a silent reversal of the only
   written statement of this behaviour anywhere in the repo. Asked, and the answer was to clamp:
   Decrease and Reset are both unavailable at zero.

2. **The app is a single counter screen, not a tabbed one.** `CHANGELOG.md` and a skill reference
   both described "tabbed home and explore screens", and the shipped Maestro smoke flow asserted on
   those tabs. Building them would have satisfied the flow but added an Explore screen nobody asked
   for. The answer was to keep one route and correct the stale claims instead.

The pattern in both: a stale document describing an app that was never written, and a choice between
matching the document or matching the request. The request won each time, and the documents were
corrected in the same change rather than left to mislead the next reader.

## Affected users and systems

Anyone opening the app, on all three surfaces. It touches nothing else — no service, no storage, no
network. It does add the shell every later screen will build on (`src/theme.ts`, the colour-scheme
hooks, and the four themed primitives), so later work inherits those decisions.

## Constraints

- **No personal, health, or payment data.** The screen holds a single integer in memory. It reads
  nothing and writes nothing off-device, which is why no storage or privacy review applies.
- **The count is not persisted.** A relaunch or a browser reload starts at zero, deliberately.
- **All three surfaces stay working**, light and dark.
- **iOS and Android cannot be observed** from the machine this was built on — Windows, no iOS
  simulator, no configured emulator. That gap had to be named rather than implied.

## Open questions

- Should the counter flow (`.maestro/counter.yaml`) be wired into `.eas/workflows/e2e.yml`? It is
  committed unrun, and one device run should confirm its assertions before CI depends on them.
- On web, a tap in the first second after paint is lost to hydration, a property of this repo's
  existing `web.output: "static"` setting rather than of the counter. Whether to change the
  rendering mode or add a hydration-gated loading state is a decision wider than this screen.
