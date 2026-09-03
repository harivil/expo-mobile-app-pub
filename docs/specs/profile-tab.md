# Profile tab

Slug: `profile-tab` · Size: **large** · Intent: [`../intent/profile-tab.md`](../intent/profile-tab.md)

Revised once after `spec-reviewer`. Stacked on `counter-screen` (PR #3), because the theme and the
four primitives this screen composes exist only there. It targets that branch and merges after it.

**Why large.** Not because a real profile will one day live here — sizing a change for a future
change is ceremony, and the personal-data trigger is explicitly ruled out below. It is large because
it restructures the route tree of an **already-reviewed, already-passing screen**, adds the app's
**first navigator** (new chrome that nothing themes for you), and edits the one Maestro flow that
carries the whole team's iOS coverage. That is "new surface area" under `feature-loop`'s own table.
For the record: `counter-screen`, which created `src/` from nothing, was sized standard — the two
sizings are not consistent, and this one is the better-argued of the pair.

## Outcome

Someone can move between two tabs at the bottom of the app — Counter and Profile — and the Profile
tab shows a sample profile: a name, a handle, an avatar and two account rows. The counter keeps
behaving exactly as it does today.

## Surfaces touched

- [x] iOS
- [x] Android
- [x] web

## Implementation choices this spec fixes

Named here because each one decides other criteria, and leaving them to the builder makes those
criteria unfalsifiable.

- **JS tabs**, `import { Tabs } from "expo-router/js-tabs"`. Verified present in the installed
  `expo-router@57.0.18`, and the plain `expo-router` re-export carries
  `@deprecated Use import { Tabs } from 'expo-router/js-tabs' instead`. This is also what makes
  `tabBarButtonTestID` available, which the ids below depend on.
- **Labels only, no icons** — and this requires `tabBarIcon: () => null`. Observed: without it,
  react-navigation draws its "missing icon" placeholder, a 25px triangle above every label. No icon
  package is installed and this change does not add one.
- **The browser tab title comes from `Head` (`expo-router/head`), not from `Tabs.Screen`'s
  `title`.** Observed: the `title` option sets the tab label but left `document.title` empty on
  every route, including a cold entry. `Head` is focus-aware, which is what makes it correct under
  tabs.
- **The tab bar is themed from existing tokens**, no new palette role:

  | Tab bar part           | Token        |
  | ---------------------- | ------------ |
  | bar background         | `background` |
  | hairline above the bar | `border`     |
  | active label           | `tint`       |
  | inactive label         | `textMuted`  |

- **Layouts are not unit-tested**, consistent with existing practice: `jest.config.js` already
  excludes `src/app/**` from coverage, and `jest.setup.js` stubs `Tabs` as `() => null` with no
  `.Screen`. So **`jest.setup.js` is not edited by this change** — the tab criteria belong to the
  E2E layers, which is where routing is testable at all.

## The placeholder copy, fixed

Pinned here so "nothing claims to be real" is something a person can check by looking, rather than a
judgement call. These exact strings:

| Element            | String                                |
| ------------------ | ------------------------------------- |
| Sample-data marker | `Sample profile`                      |
| Display name       | `Alex Jordan`                         |
| Handle             | `@alexjordan`                         |
| Avatar initials    | `AJ`                                  |
| Row 1              | `Member since` / `March 2026`         |
| Row 2              | `Plan` / `Standard`                   |
| Sign-out caption   | `Sign-in isn't part of this app yet.` |

**No real personal data of anyone** — no real name, email, date of birth, account number, payment
detail or health information — is added to this repo, collected, stored, logged or sent anywhere.
There is no network call and no device storage, which is why a change that would otherwise need a
privacy review does not. The later change that replaces this with a real profile **will** need one,
plus a storage decision and the `.semgrep.yml` personal-data rules.

## Element ids

| id                               | Element                                                        |
| -------------------------------- | -------------------------------------------------------------- |
| `tab-counter`                    | Counter tab button                                             |
| `tab-profile`                    | Profile tab button                                             |
| `profile-screen`                 | Profile screen root                                            |
| `profile-details`                | the rows block — the measurable block for the column criterion |
| `profile-avatar`                 | initials circle                                                |
| `profile-name`                   | display name                                                   |
| `profile-handle`                 | handle                                                         |
| `profile-row-value-member-since` | the "Member since" value                                       |
| `profile-row-value-plan`         | the "Plan" value                                               |
| `profile-signout`                | the disabled Sign out control                                  |

`counter-screen`'s ids are unchanged.

## Acceptance criteria

### Tabs

- [ ] Launching the app shows a **tab bar with two tabs, Counter and Profile**, Counter selected,
      counter on screen.
- [ ] Tapping **Profile** shows the profile page; tapping **Counter** returns to the counter.
- [ ] **The tab bar is themed in both palettes** per the token table above — bar background,
      hairline, and active/inactive labels. Specifically: no light-coloured bar under a dark screen.
- [ ] **No content on either tab is obscured by, or double-inset from, the tab bar.** `Screen`
      applies `paddingBottom: insets.bottom` and a tab bar consumes the bottom inset itself, so the
      two can stack into dead space above the bar, or push a control underneath it.
      **Observed clean on web** — 58px of clearance between the sign-out control and the bar at
      390×844, nothing obscured — but **web cannot answer this criterion**: a desktop browser
      reports a bottom safe-area inset of 0, so the two values that would stack never both exist
      there. **This is a typed gap on iOS and Android**, where the inset is non-zero and is exactly
      where the double-padding would show. No change was made to `Screen` on the strength of a web
      observation that cannot see the problem.
- [ ] The browser tab title reads **Counter** at `/` and **Profile** at `/profile`. The root
      layout's existing `<Stack.Screen name="index">` becomes stale when `index` moves into the
      group, so this must be moved deliberately rather than left to fall back to the app name.

### URLs and back

- [ ] The counter is still at **`/`** and the profile at **`/profile`**. A `(tabs)` group is
      omitted from the URL — the repo's own `route-and-navigation.md` documents this, so it is a
      fact to confirm rather than an assumption.
- [ ] **Loading `/profile` directly** on web shows the profile with the tab bar present and the
      Counter tab still reachable. `web.output: "static"` pre-renders each route separately, which
      is exactly where a route inside a group can break.
- [ ] On web, **browser Back from `/profile` returns to `/`** with Counter selected.
- [ ] On **Android, system back from Profile returns to the Counter tab** rather than backgrounding
      the app. Typed gap: unobservable here, see concerns.

### The counter is unchanged

- [ ] **Every acceptance criterion in [`counter-screen.md`](counter-screen.md) still holds**, in
      particular the zero floor and Decrease/Reset disabled at `0`.
- [ ] **The count survives switching to Profile and back** — count to 3, switch, switch back, still
      `3`. **Observed to hold**, so the fallback this criterion was written with (amend rather than
      hoist state into a provider) was not needed. Hoisting remains out of scope regardless.
- [ ] A browser reload still returns the count to `0`.

### The profile page

- [ ] Shows the **avatar circle containing `AJ`**, the initials of the placeholder name.
- [ ] Shows **`Alex Jordan`** and **`@alexjordan`**, the handle visibly secondary to the name.
- [ ] Shows two labelled rows: **`Member since` / `March 2026`** and **`Plan` / `Standard`**, each
      label and value both visible.
- [ ] Shows a **`Sign out` control that is visibly disabled**, carries `accessibilityState.disabled`,
      does nothing when tapped, and sits beside the caption **`Sign-in isn't part of this app yet.`**
      (Included at the originator's selection, which showed it as an inert placeholder. A control
      that silently does nothing would be worse than no control; this one says what it is.)
- [ ] A visible **`Sample profile`** marker appears on the page, so nothing on it reads as real data
      about a real person.
- [ ] The page title is a real **heading** in the accessibility tree.

### Appearance and accessibility

- [ ] Legible in **both light and dark**. The two colour pairs this screen introduces are
      **`textMuted` on `surface`** (row labels) and **`tintText` on `tint`** (avatar initials).
      `textMuted`-on-`surface` is **not currently in `src/theme.test.ts`'s `REQUIRED` list and is
      added by this change**; `tintText`-on-`tint` is already asserted.
- [ ] At a **1440px** viewport the profile content is capped to `ContentMaxWidth` and centred,
      measured on `profile-details` the way the counter's is measured on `counter-actions`.
- [ ] Every control is at least 44×44.
- [ ] **On web**, each tab exposes its accessible name and its selected state (`aria-selected`), and
      the page holds up when the browser font size is doubled — labels and values may wrap, nothing
      clipped. **On iOS and Android this is a typed gap**: no screen reader and no OS font-scale
      setting can be driven from this machine, so native announcement and native Dynamic Type are
      unobserved rather than claimed. This mirrors how `counter-screen.md` scoped the same pair.

## States

| State                                      | Behaviour                                                        |
| ------------------------------------------ | ---------------------------------------------------------------- |
| Profile, normal                            | The only state — the data is a constant, so it cannot be absent. |
| Sign out                                   | Permanently disabled, with the caption explaining why.           |
| Long name or handle                        | Wraps rather than clipping; the avatar keeps its size.           |
| Doubled font size                          | Rows wrap; nothing clipped.                                      |
| Loading, empty, error, offline, permission | **Not applicable.** No async work, no network, no storage.       |

## Test layers

- **Functional** — `src/screens/profile/index.test.tsx`: every pinned string renders, the sample
  marker is present, Sign out is disabled and fires nothing, and the title is a heading.
- **Unit** — the new `textMuted`-on-`surface` contrast pair in `src/theme.test.ts`; the initials
  helper if one is extracted.
- **Web E2E** — `e2e/web/profile.spec.ts`: tab switching, the count surviving a switch, `/profile`
  as a direct entry, browser back, the 1440px column on `profile-details`, and `aria-selected`.
  **Owns every tab criterion**, because `expo-router` is stubbed under Jest and routing is not
  testable there at all.
- **Native E2E** — a **new `.maestro/profile.yaml`** for the tab journey. `smoke-launch.yaml` gains
  **at most one** assertion (`tab-profile` visible) and keeps its existing counter steps: it runs in
  both `test_android` and `test_ios` and is the team's only native coverage, so the deep journey goes
  in its own flow rather than being loaded onto the smoke test.

## Out of scope

- **Editing anything.** Read-only, settled by the originator.
- **Persistence, storage, or any network call.**
- **Authentication.** There is none, which is why Sign out is disabled rather than wired up.
- **Hoisting counter state** into a provider or store, even if the count turns out not to survive a
  tab switch.
- An avatar **image** — initials only, so no asset and no image loading state.
- Tab **icons**, a settings screen, an account screen, or a third tab.
- Any real personal data, now or as a sample.

## Claims this change corrects — again

Three were corrected in `counter-screen` to describe a single-route app; the tabs decision makes them
wrong again. A fourth is created by that same correction:

- `CHANGELOG.md` — "a single counter screen" becomes a tabbed app with a counter and a profile.
- `.claude/skills/scaffold-feature/references/route-and-navigation.md` — "This app has **no tab
  group yet**" goes back to pointing at a real `(tabs)/_layout.tsx`, which is what it originally
  claimed and can now honestly claim again.
- `.maestro/smoke-launch.yaml` — its assertions gain the tab, **and** its header paragraph
  explaining that it once asserted tab ids "from a `src/app/(tabs)/_layout.tsx` that was never
  written" stops being true the moment that file exists. Both the steps and that paragraph are
  updated.

## Concerns to name rather than bury

- **The riskiest part is the counter, not the profile.** Moving `index.tsx` into `(tabs)/` is a
  route restructure of a screen that is already reviewed and passing, and its unit tests cannot see
  it: `expo-router` is stubbed under Jest, so nothing in that layer would catch the counter becoming
  unreachable. Only the E2E layers and running the app can.
- **Tab-bar theming is new chrome, and nothing themes it for you.** react-navigation ships its own
  default palette; the root layout already has to hand `Stack` an explicit `contentStyle`
  background for the same reason. This is the single most likely thing to ship broken in dark mode.
- **The count-survives-a-switch criterion depends on navigator behaviour**, not on this app's code.
  It is written with an explicit fallback above so a failed observation cannot become unnamed scope.
- **iOS and Android remain unobserved** — Windows, no simulator, no emulator, no Maestro. This
  matters more here than it did for the counter: a tab bar is a platform-native surface, and Android
  system back is a criterion above that cannot be checked from this machine.
- **`.maestro/counter.yaml` is still unrun**, carried over from PR #3, and now so is
  `.maestro/profile.yaml`.
