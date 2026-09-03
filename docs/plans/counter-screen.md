# Plan: counter screen, and the app shell it needs

Spec: [`../specs/counter-screen.md`](../specs/counter-screen.md) · Branch: `counter-screen`

`src/` does not exist in this repo. The skills already reference `src/theme.ts`, `useTheme`,
`useColorScheme`, `ThemedText`, `ThemedView`, `Screen` and `Button` as though they were present —
they are not, so this change creates them. That is not scope creep: the counter cannot read a colour
without a theme, and ESLint fails the build on a hex literal outside `src/theme.ts`.

## Files that change

```
src/theme.ts                          (new)  Colors.light/.dark, Spacing, Radius, Typography, ContentMaxWidth
src/theme.test.ts                     (new)  asserts the two palettes carry identical keys
src/hooks/use-color-scheme.ts         (new)  narrows RN's scheme to "light" | "dark"
src/hooks/use-color-scheme.test.ts    (new)  the narrowing, including the null case
src/hooks/use-theme.ts                (new)  returns the active palette
src/hooks/use-theme.test.ts           (new)  light and dark selection
src/components/themed-text.tsx        (new)  typography scale + colour roles
src/components/themed-view.tsx        (new)  background/surface roles
src/components/screen.tsx             (new)  safe area, centred max-width column, testID passthrough
src/components/button.tsx             (new)  variant, size, disabled, 44x44 minimum
src/components/button.test.tsx        (new)  press, disabled-does-not-fire, accessibility state
src/app/_layout.tsx                   (new)  root Stack, themed header and status bar
src/app/index.tsx                     (new)  route at "/", thin — renders <Counter />
src/screens/counter/index.tsx         (new)  screen body, useState, the three actions
src/screens/counter/index.test.tsx    (new)  functional: increase, decrease past zero, reset, disabled reset
.maestro/counter.yaml                 (new)  native flow for the counter journey
.maestro/smoke-launch.yaml            (edit) retarget onto the app that now exists
CHANGELOG.md                          (edit) correct "tabbed home and explore screens"
.../references/route-and-navigation.md (edit) correct the "(tabs)/_layout.tsx is a working example" line
e2e/web/counter.spec.ts               (new)  Playwright: same journey, plus reload and a desktop width
```

`.maestro/smoke-launch.yaml` is the only existing file edited. It currently asserts on
`home-screen`, `tab-explore` and `explore-screen` from a `src/app/(tabs)/_layout.tsx` that was never
written, so it cannot pass against any app. It is retargeted rather than deleted — the spec names
this as a decision for the reviewer to confirm.

## Order of work

Each step leaves the repo in a state where `npm run verify` is meaningful.

1. **Tokens.** `src/theme.ts` plus `src/theme.test.ts`. Nothing else can be written first, because
   every component below reads from it.
2. **Hooks.** `use-color-scheme` (narrowing), then `use-theme` (palette selection), each with its
   test. `use-color-scheme` is the seam the tests mock, so it exists before any component.
3. **Primitives.** `ThemedText`, `ThemedView`, `Screen`, `Button`, plus `button.test.tsx`. These are
   the four the skills promise; no fifth.
4. **The counter, test first.** Write `src/screens/counter/index.test.tsx` and watch it fail against
   a missing module, then write `src/screens/counter/index.tsx` until it passes.
5. **Make it reachable.** `src/app/_layout.tsx` and `src/app/index.tsx`. After this step the app
   boots and the counter is on screen — the first point at which anything is observable.
6. **Flows.** `e2e/web/counter.spec.ts`, `.maestro/counter.yaml`, and retarget
   `.maestro/smoke-launch.yaml`. Every selector is a `testID`, never visible copy.
7. **Verify.** `npm run verify`, then the app on web in both appearance modes, then the `verifier`
   agent.

## Design — stage 3.5

**Surfaces:** all three. **Primary action:** Increase — it is the largest control and sits first.

**States.** Nothing here is async, so there is no loading, empty, error, offline or permission state
to design, and saying so explicitly is the point of the stage. The states that do exist:

| State                     | Design                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Value is zero             | Decrease **and** Reset disabled — reduced opacity plus `accessibilityState.disabled`. |
| Value is one or more      | All three controls enabled.                                                           |
| Value is many digits wide | One line, centred, allowed to shrink rather than clip or wrap.                        |
| 200% system font size     | Labels wrap or shrink but stay legible; nothing clipped.                              |

Negative values are unreachable, so they are not a state. At zero, Increase is the only live
control — which also makes the primary action unmistakable on first launch.

**Tokens.** Every value traces to `src/theme.ts`; the file is new, so these are the tokens it starts
with rather than additions to an existing set:

- `Colors.light` / `Colors.dark` — `background`, `surface`, `text`, `textMuted`, `border`, `tint`,
  `tintText`, `danger`. Named by role, identical keys in both, `tint` differs between palettes so it
  holds contrast on near-black as well as on white.
- `Spacing` — four-point scale, `xs` 4 through `xxl` 40.
- `Radius`, `Typography` (size with its line height and weight together, never a bare `fontSize`),
  `ContentMaxWidth` 520.

**Contrast.** Body text against its background clears 4.5:1 in both palettes; the tint button's
label against its fill clears 4.5:1; the border clears 3:1. Checked per palette, not once.

**No new primitive.** The counter composes `Screen`, `ThemedText` and `Button`. The three action
buttons are three call sites of one component, differing only by `variant` and `onPress`.

## Risks

- **Riskiest step is 5, not 4.** No `src/` has ever existed here, so nothing in this repo proves its
  Expo config actually boots an app — `typedRoutes`, the metro web bundler and the `@/*` alias are
  all unexercised. A green `jest` run would not catch a broken boot. Mitigation: step 5 is followed
  immediately by actually loading the app, before any flow is written.
- `experiments.typedRoutes` generates route types into `.expo/types`, which does not exist until the
  dev server has run once. `tsc --noEmit` may fail on a route type until then; the fix is to start
  the server, not to loosen a type.
- Reanimated is a dependency but goes unused here, so the worklets babel plugin stays off the
  critical path. Worth knowing, since it is the usual first-boot failure in an Expo app.
- `Screen` uses safe-area insets, so every test rendering it needs the safe-area mock —
  `jest.setup.js` already provides it globally.

## Alternatives not taken

- **Two tabs, home and explore,** to satisfy the shipped `smoke-launch.yaml` as written. Rejected by
  the originator after `spec-reviewer` surfaced that `CHANGELOG.md` describes a tabbed app: an
  explore tab is a screen nobody asked for, and a flow should describe the app rather than the app
  being built to match a stale flow. The stale claims are corrected instead.
- **Persisting the count** via `expo-secure-store` or `AsyncStorage`. Rejected: not asked for, and it
  turns a pure in-memory screen into one with an async load, an error state and a storage review.
- **Letting the count go negative.** Rejected by the originator. `CHANGELOG.md` already described "a
  clamped counter", and clamping collapses two rules into one: at zero, Decrease and Reset are both
  disabled for the same reason. An unclamped counter was the original draft and would have silently
  reversed the only written statement of this behaviour in the repo.
- **A `useCounter` hook.** Rejected: three `useState` updaters used by exactly one screen. A hook
  built for one call site encodes that call site and earns its own test file for no gain.

## Proof

- `src/screens/counter/index.test.tsx` covers every behaviour from the spec: increase, decrease,
  the zero floor holding when Decrease is tapped at `0`, Decrease and Reset both disabled at `0`,
  reset from a non-zero value, and ten rapid taps landing on exactly `10`. `button.test.tsx`,
  `use-color-scheme.test.ts`, `use-theme.test.ts` and `theme.test.ts` cover the shell.
- `npm run verify` green — format, types, lint, jest with coverage, version gate, hook and skill
  tests, expo-doctor — with its output read, not just its exit code.
- The app loaded on **web** at a phone width and a desktop width, in **light and dark**, showing the
  counter at `0`, at `3`, at `-1`, and reset; screenshots captured as the `after` evidence.
- `npx playwright test` green for `e2e/web/counter.spec.ts`.
- **iOS and Android are not observed on this machine** — Windows has no iOS simulator and no Android
  emulator is configured here. `.maestro/counter.yaml` is written and committed but unrun; the PR
  states this gap rather than implying the native surfaces were checked.
