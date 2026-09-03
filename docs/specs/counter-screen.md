# Counter screen

Slug: `counter-screen` · Size: **standard** (a screen, plus the app shell it needs)

Revised once after `spec-reviewer`. Two questions it raised were escalated rather than settled
here, and the originator answered both: the count **clamps at zero**, and the app is a **single
counter route** rather than the tabbed shell the repo's own `CHANGELOG.md` describes. Both answers
are reflected below, and the stale claims they contradict are corrected as part of this change.

## Outcome

A user opens the app and lands on a counter showing `0`. They can raise it, lower it back down —
never below zero — and reset it, and the number changes on tap.

Today the app has no screens at all: `src/` does not exist. So this change also creates the shell
every later screen builds on. That shell is **forced dependency scope, not part of "a counter"** —
the counter cannot read a colour without `src/theme.ts`, because ESLint fails the build on a hex
literal anywhere else. It is listed separately in the criteria for exactly that reason.

## Surfaces touched

- [x] iOS
- [x] Android
- [x] web

## Element ids

Fixed here so the flows, the screen and the verifier all address the same things. A React Native
`testID` becomes `accessibilityIdentifier` on iOS, `resource-id` on Android and `data-testid` on
web, so one prop serves Maestro and Playwright alike.

| id                 | Element                                                             |
| ------------------ | ------------------------------------------------------------------- |
| `counter-screen`   | the screen root                                                     |
| `counter-value`    | the number                                                          |
| `counter-actions`  | the button block — the element a web flow measures for column width |
| `counter-increase` | Increase button                                                     |
| `counter-decrease` | Decrease button                                                     |
| `counter-reset`    | Reset button                                                        |

## Acceptance criteria

### The counter

- [ ] Launching the app shows a screen headed **Counter** with the value **0** below it.
- [ ] Tapping **Increase** raises the value by one; three taps from `0` shows `3`.
- [ ] Tapping **Decrease** lowers the value by one; from `3` one tap shows `2`.
- [ ] **The value never goes below zero.** At `0`, Decrease is disabled and tapping it leaves the
      value at `0`.
- [ ] Tapping **Reset** returns the value to `0` from any value above zero.
- [ ] At `0`, **both Decrease and Reset are disabled**; both become enabled as soon as the value is
      at least `1`. Disabled means rendered at reduced opacity **and** carrying
      `accessibilityState.disabled` — so a screen reader announces it, not only a sighted user.
- [ ] Tapping Increase ten times in rapid succession shows exactly `10` — no tap is dropped or
      coalesced.
- [ ] The value stays on **one line** inside the content column, shrinking rather than clipping or
      wrapping, up to at least seven digits.
- [ ] A browser **reload** shows `0` again, as does relaunching the native app. The count is
      deliberately not persisted.

### Accessibility and appearance

- [ ] A screen reader announces each control as its label plus its role: **"Increase, button"**,
      **"Decrease, button"**, **"Reset, button"**, and the value as **"Count: N"**.
- [ ] Text remains readable at a **200% system font size** — the numeral may shrink, but no control
      label is clipped and no button loses its label.
- [ ] In **both light and dark mode**: body and heading text clears **4.5:1** against its
      background, control outlines clear **3:1**, and the primary button's label clears 4.5:1
      against its fill. Checked per palette, not once.
- [ ] At a **1440px** browser viewport the content is constrained to `ContentMaxWidth` (520) and
      horizontally centred, not stretched edge to edge.

### The shell (dependency scope)

- [ ] `src/theme.ts` exports `Colors.light` and `Colors.dark` with **identical keys**, plus
      `Spacing`, `Radius`, `Typography` and `ContentMaxWidth`.
- [ ] The colour scheme is read through `@/hooks/use-color-scheme`, which never returns anything
      but `"light"` or `"dark"`.
- [ ] `Button` enforces a **44×44 minimum** tap target, so no call site has to remember it. This is
      a code-review and unit-test item rather than something checkable by tapping.
- [ ] `Screen`, `ThemedText`, `ThemedView` and `Button` exist as `design-system` already claims they
      do — no fifth primitive.

## States

Named explicitly, including the ones that do not apply, so their absence reads as a decision:

| State                               | Behaviour                                                                |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Value `0`                           | Decrease and Reset disabled; Increase is the only live control.          |
| Value `1` or more                   | All three controls enabled.                                              |
| Value many digits wide              | One line, centred, shrinks to fit, stays inside the column.              |
| 200% font size                      | Labels wrap or shrink but stay legible; nothing clipped.                 |
| Loading, error, offline, permission | **Not applicable.** Nothing here is async and nothing leaves the device. |

Negative values are **unreachable by design** and so are not a state.

The splash screen is **not touched** — `app.json`'s existing `expo-splash-screen` config, including
its separate light and dark backgrounds, is left exactly as it is.

## Test layers

- **Functional** — `src/screens/counter/index.test.tsx`: increase, decrease, the zero floor,
  disabled Decrease and Reset at zero, and reset from a non-zero value.
- **Unit** — the theme's palette-key parity, the colour-scheme narrowing, palette selection, and
  `Button`'s press / disabled / accessibility behaviour.
- **Web E2E** — `e2e/web/counter.spec.ts`. **`e2e/` does not exist yet**, while
  `playwright.config.ts` already points `testDir` at `./e2e/web` and `ci-local.mjs` runs
  `playwright test` under `--full`. So `npm run verify -- --full` cannot pass today, and this change
  is what makes it able to. This suite owns the 1440px column criterion.
- **Native E2E** — `.maestro/counter.yaml`, plus the rewrite of `.maestro/smoke-launch.yaml`.

## Out of scope

- **Persistence.** The count lives in memory and resets on relaunch or reload.
- Configurable step size, or a maximum bound. Only the zero floor exists.
- More than one counter, a history, or undo.
- Tabs, or any second screen — settled by the originator above.
- Any personal, health, or account data. The screen holds one integer, reads nothing and writes
  nothing off-device. That is also why there is no error, offline or permission state to design.

## Stale repo claims this change corrects

These describe an app that was never written. Each is edited in this change rather than left to
mislead the next agent:

- `CHANGELOG.md` `[Unreleased]` — claims "tabbed home and explore screens, a clamped counter".
  Clamping is now accurate; the tabs are not, and the line is corrected.
- `.maestro/smoke-launch.yaml` — asserts on `home-screen`, `tab-explore` and `explore-screen` from a
  `src/app/(tabs)/_layout.tsx` that does not exist, and its header comment claims "the web
  counterpart in `e2e/web/` passes" when `e2e/` is absent. Both the flow and the false comment are
  rewritten.
- `.claude/skills/scaffold-feature/references/route-and-navigation.md` — "`src/app/(tabs)/_layout.tsx`
  in this repo is a working example". The single-route decision makes this permanently false, so the
  line is corrected to point at what does exist.

One claim the reviewer raised is **not** a problem: `node .claude/check-skills.mjs` passes today
(`OK — 11 skills, 92 files swept; links and pointers resolve`), so the shell is not needed to make
`verify` green over broken `src/` links. It is needed because of the ESLint colour rule.

## Concerns to name rather than bury

- **Rewriting `.maestro/smoke-launch.yaml` touches the whole team's iOS coverage, not just this
  feature.** `.eas/workflows/e2e.yml` runs it in both `test_android` and `test_ios`, and comments
  that `test_ios` "is what covers iOS for teammates on Windows, who have no local simulator". A
  wrong rewrite silently removes that coverage for everyone. The reviewer should read the new flow
  with that in mind.
- **On web, a tap in the first second after paint is silently lost.** Found by `verifier`,
  reproduced 3/3. `app.json` sets `web.output: "static"`, so Expo Router pre-renders the markup
  and hydrates afterwards; until hydration attaches handlers the button is painted, correct and
  completely inert, and the lost tap is never replayed. **Accepted, not fixed**, for two reasons:
  it is a property of this repo's existing `web.output: "static"` setting rather than of anything
  this change introduced — every interactive screen added here will inherit it — and the fix is
  either a rendering-mode change or a hydration-gated loading state, both of which are wider than
  a counter. It is written down here so the team decides deliberately. `waitUntilInteractive()` in
  `e2e/web/counter.spec.ts` documents the same behaviour for the test layer.
- **`counter-value` carries its `aria-label` on an element with `role=generic`.** ARIA does not
  support naming a generic role, so while Chrome's accessibility tree does expose "Count: N",
  NVDA, JAWS and VoiceOver may not announce it. **Accepted with this reason**: no real screen
  reader can be driven on this machine, so replacing a working Chrome-verified label with an
  untested alternative would trade a known-partial result for an unknown one. The visible number
  is readable regardless. Worth re-testing by anyone with a screen reader to hand.
- **iOS and Android are not observed on the machine building this.** Windows has no iOS simulator
  and no Android emulator is configured here, so the native halves of the appearance and
  accessibility criteria rest on the shared implementation and on `.eas/workflows/e2e.yml`, not on
  an observed run. The PR states this gap rather than implying otherwise.
