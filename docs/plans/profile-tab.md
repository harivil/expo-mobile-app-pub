# Plan: profile tab

Spec: [`../specs/profile-tab.md`](../specs/profile-tab.md) · Intent:
[`../intent/profile-tab.md`](../intent/profile-tab.md) · Branch: `profile-tab`, off `counter-screen`

## Files that change

```
src/app/_layout.tsx                         (edit) drop the stale <Stack.Screen name="index">
src/app/index.tsx                           (move) -> src/app/(tabs)/index.tsx, plus a Head title
src/app/(tabs)/_layout.tsx                  (new)  Tabs from expo-router/js-tabs, themed, both testIDs
src/app/(tabs)/profile.tsx                  (new)  route, thin
src/screens/profile/index.tsx               (new)  screen body
src/screens/profile/index.test.tsx          (new)  functional: every pinned string, disabled sign out
src/screens/profile/placeholder-profile.ts  (new)  the fictional data, in one obviously-named module
src/screens/profile/placeholder-profile.test.ts (new) the initials helper, and the pinned copy
src/components/screen.tsx                   (edit) a bottomInset prop — the tab bar owns that inset
src/components/screen.test.tsx              (new)  covers both inset modes
e2e/web/app.ts                              (new)  shared ids + the hydration gate, lifted from counter.spec
e2e/web/counter.spec.ts                     (edit) imports the lifted helper; no assertion changed
src/theme.test.ts                           (edit) add the textMuted-on-surface REQUIRED pair
e2e/web/profile.spec.ts                     (new)  tabs, direct entry, back, column, aria-selected
.maestro/profile.yaml                       (new)  the tab journey
.maestro/smoke-launch.yaml                  (edit) one tab assertion, and fix the now-stale header
CHANGELOG.md                                (edit) single counter screen -> tabbed counter + profile
.claude/skills/scaffold-feature/references/route-and-navigation.md (edit) point at a real (tabs) layout
```

`src/screens/counter/**` is **not touched**. The counter's route file moves; its code does not
change. That is deliberate — it is already reviewed and passing, and a diff that also edits it would
make "the counter is unchanged" unreviewable.

## Order of work

1. **Move the counter's route, add the tab layout.** `git mv src/app/index.tsx
src/app/(tabs)/index.tsx`, write `(tabs)/_layout.tsx`, strip the stale `Stack.Screen` from the
   root layout. Load the app: the counter must still be at `/` with a tab bar under it. This is the
   step that can break an already-working screen, so nothing else happens until it is observed.
2. **Theme the bar** and check it in dark mode immediately — it is the thing most likely to ship
   broken, and it is invisible in whichever mode you built in.
3. **Resolve the bottom inset.** Measure whether `Screen`'s `paddingBottom: insets.bottom` and the
   tab bar stack into dead space. Fix wherever observation says, and record which.
4. **The profile, test first.** `placeholder-profile.ts`, then the failing
   `src/screens/profile/index.test.tsx`, then the screen, then the route.
5. **The contrast pair.** Add `textMuted`-on-`surface` to `REQUIRED` in `src/theme.test.ts` and
   watch it pass or fail before relying on the colours.
6. **Flows.** `e2e/web/profile.spec.ts`, `.maestro/profile.yaml`, the one-line smoke addition.
7. **Docs.** The four stale claims.
8. **Verify.** `npm run verify`, Playwright cold, the app in both modes, then `verifier`.

## Design — stage 3.5

**Surfaces:** all three. **Primary action:** the profile page has none — it is a read-only page, and
the one control on it is deliberately disabled. Saying so is the answer to "exactly one primary
action per screen", not an omission.

**Layout**, top to bottom inside `Screen`: a `Sample profile` marker, the heading, the avatar circle
with initials, the name, the handle, then the `profile-details` card holding two rows, then the
disabled Sign out with its caption.

**No new component.** The two rows are the same thing twice, which `design-system` says to extract —
but they are the same thing twice _in one screen_, so they are defined as **data and rendered in a
map**, not lifted into a component. That gets the de-duplication without building a configuration
surface for a second caller that does not exist. If a third row or a second screen appears, extract
then.

**Every value traces to an existing token. No new palette role:**

| Piece           | Token                                                               |
| --------------- | ------------------------------------------------------------------- |
| avatar circle   | `tint` fill, `Radius.pill`, size `Spacing.xxl * 2` (80)             |
| avatar initials | `Typography.title` in `tintText`                                    |
| name            | `Typography.title` in `text`                                        |
| handle, marker  | `Typography.caption` in `textMuted`                                 |
| details card    | `surface` fill, `border` hairline, `Radius.md`                      |
| row label       | `Typography.body` in `textMuted` — **the new contrast pair**        |
| row value       | `Typography.body` in `text`                                         |
| tab bar         | `background` / `border` / `tint` / `textMuted` per the spec's table |

The avatar size is derived from the spacing scale rather than added as a token: one use site does not
justify a new name, and `Spacing.xxl * 2` stays traceable.

**States.** The spec's table is the design: there is only one real state, because the data is a
constant. The states that need drawing are the disabled Sign out, long text wrapping, and doubled
font size. No loading, empty, error, offline or permission state exists to draw — nothing here is
async.

**Both modes** get looked at, on the tab bar as well as the page.

## Departures from this plan, written back

Recorded here rather than discovered in review — `change-reviewer` judges the diff against this file.

- **`e2e/web/app.ts` was extracted** when the profile flow needed the same hydration gate
  `counter.spec.ts` already had. `id` and `waitUntilInteractive` moved verbatim; the budget, the
  timeouts and every assertion are unchanged, and the id keys were renamed at every call site
  (`id.value` → `id.counterValue` and so on). **No assertion was weakened, removed or retimed** —
  the alternative was a second copy of the gate that would drift from the first.
- **`src/components/screen.tsx` gained a `bottomInset` prop.** The plan assumed the double-inset
  question would be settled by observation; it was settled by reading the vendored navigator
  instead, which showed the tab bar's height already includes `insets.bottom` and that it pads
  itself, while screens still see the full inset. So the fix is in `Screen` after all, opted into
  per screen rather than auto-detected — `BottomTabBarHeightContext` is only reachable through an
  internal `expo-router/build/...` path, which is not worth depending on.
- **The profile body scrolls.** Nothing here scrolls in the plan; at a doubled system font size the
  content is taller than the tab-bar-reduced screen area and the tab view clips it, taking the
  Sign out control with it.

## Risks

- **Riskiest step is 1**, and the risk is to the counter rather than to anything new. Its unit tests
  cannot see routing (`expo-router` is stubbed), so a green `jest` proves nothing about whether `/`
  still resolves. Mitigation: load the app before writing anything else.
- **Tab-bar theming.** react-navigation supplies its own default palette. Built in light mode, a
  broken dark bar is invisible; step 2 exists to force looking.
- **Double bottom inset** — `Screen` already pads by `insets.bottom` and the bar consumes the same
  inset. Unknown until measured, which is why it is its own step rather than a guess.
- **`web.output: "static"`** pre-renders each route separately, so `/profile` as a cold entry is a
  genuinely separate thing from navigating to it. Covered by its own criterion.
- **The hydration defect from PR #3 still applies** — the first tap after paint is dropped, so any
  new web flow must gate on interactivity, not paint. `e2e/web/counter.spec.ts`'s
  `waitUntilInteractive` is the pattern to reuse; a tab tap is exactly the kind of first interaction
  that would be swallowed.
- **`smoke-launch.yaml` is the team's only native coverage.** It gains one assertion, not a journey.

## Alternatives not taken

- **Native tabs** (`expo-router`'s native tabs) instead of JS tabs. Rejected: `tabBarButtonTestID`
  is a JS-tabs option and the ids depend on it, and the repo's own reference mandates
  `expo-router/js-tabs`. A native tab bar would also be harder to theme from these tokens.
- **A link from the counter pushing `/profile`** onto the stack. Rejected by the originator in favour
  of tabs.
- **Extracting a `DetailRow` component.** Rejected as premature — see Design.
- **Adding an `AvatarSize` token.** Rejected: one use site.
- **Hoisting counter state** so the count certainly survives a tab switch. Rejected as out of scope;
  the spec instead records whatever the navigator actually does.
- **Loading the tab journey onto `smoke-launch.yaml`.** Rejected: it runs on both native platforms
  as the team's only coverage, and a smoke test should stay the cheapest thing that catches a dead
  launch.

## Proof

- `src/screens/profile/index.test.tsx` asserts every pinned string from the spec's copy table, the
  `Sample profile` marker, the heading role, and that Sign out is disabled and fires nothing.
- `src/theme.test.ts` gains the `textMuted`-on-`surface` pair and stays green across both palettes.
- `e2e/web/profile.spec.ts` green on chromium and mobile-web, from a **cold** start: tab switching
  both ways, the count surviving a switch, `/profile` as a direct entry, browser back, the
  `profile-details` column measuring exactly `ContentMaxWidth` at 1440px, and `aria-selected` on
  both tabs.
- `npm run verify` GREEN, output read.
- The app **looked at** on web in light and dark, at phone and desktop widths, on both tabs, with
  the tab bar checked in both modes; `after` screenshots captured against the `before` baseline
  already taken in `.evidence/profile-tab/before/`.
- **iOS and Android unobserved** — no simulator, no emulator, no Maestro. `.maestro/profile.yaml`
  committed unrun; the Android back criterion is a typed gap.
