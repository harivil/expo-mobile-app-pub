# PR screenshots, captured by CI

Intent: [`../intent/pr-screenshots.md`](../intent/pr-screenshots.md) · Revision 2, after
`spec-reviewer`

Revision 1 promised something GitHub cannot do and something this app cannot reach. Both are
corrected below, and the corrections are the interesting part of this spec.

## Outcome

A reviewer opening a pull request that changes the app finds screenshots of iOS, Android and web in
the PR body, put there by CI rather than by the author, whatever OS the author runs. A UI-touching
PR whose screenshots are missing has a red `evidence` check and **cannot be merged** once that check
is required in branch protection.

Two limits are stated here rather than discovered later:

- **The "Ready for review" click cannot be gated.** GitHub has no hook on the draft → ready
  transition; a status check gates _merge_. So the guarantee is "cannot be merged", not "cannot be
  reviewed". A Claude Code session is additionally held by `guard-pr` once `harness-sync` lands —
  that covers agents, not a human in a browser, and it is a nudge rather than the guarantee.
- **`evidence` guarantees the app's unauthenticated launch state**, plus whatever a capture flow
  reaches. It is not a promise that the PR's own change is visible in a picture — see "The auth
  gate" below, which is why that distinction exists.

## Surfaces touched

- [x] iOS — `macos` runner, simulator, light appearance
- [x] Android — `ubuntu` runner, emulator, light appearance
- [x] web — `ubuntu` runner, Chromium, light **and** dark

The app itself is unchanged by this work.

**Exactly four images** make a compliant body, named on the evidence branch and labelled in the body
as: `ios-light.png`, `android-light.png`, `web-light.png`, `web-dark.png`. Native dark is
deliberately excluded from revision 2 — it doubles the emulator and simulator legs, which are
already the slow half — and `userInterfaceStyle: "automatic"` means it is a real surface, so it is
named in "Out of scope" rather than forgotten. A capture flow may add further images; they are
extra, never substitutes.

## The auth gate, and what it does to the guarantee

`src/app/_layout.tsx` wraps `(tabs)` in `<Stack.Protected guard={!!user}>`, and `user` comes from a
SecureStore session. No CI runner has one, so **an unaided capture reaches the login screen on every
surface, on every PR**. On web it cannot even in principle: `expo-secure-store`'s web build is a
no-op stub, so the restore throws — this is the "Failed to restore session" toast visible in
existing PR evidence.

Therefore:

- The four guaranteed images show the login screen. That is worth having — it proves the app boots,
  renders and themes correctly on three surfaces — and it is all it proves.
- A PR touching a screen **behind** the guard must supply a capture flow, and `evidence` enforces
  that. This is the decision taken over seeding a fake session: no auth-bypass path enters a health
  app's codebase for the sake of a screenshot.

## Acceptance criteria

- [ ] **1.** A non-draft PR whose diff touches a UI path (see "The path rule") ends up with a body
      containing four rendered images — pictures, not paths — for `ios-light`, `android-light`,
      `web-light` and `web-dark`, with no action by the author.
- [ ] **2.** Each image is captured only after the app is **ready**: the element with testID
      `login-screen` is visible. A capture that times out waiting for it counts as that surface
      missing, and never produces a splash-screen image. (`src/components/animated-icon.tsx` holds
      an animated overlay for 600ms after launch, so a fixed sleep is not a readiness signal.)
- [ ] **3.** The bot's block in the body is delimited by markers, records the head SHA it was
      captured from, and labels every image with surface and appearance. Nothing the author wrote
      outside those markers is modified.
- [ ] **4.** A second push replaces the block with images from the new SHA. The body never shows two
      sets, and never shows a SHA other than the current head.
- [ ] **5.** A PR that touches no UI path passes `evidence` with no images and no complaint.
- [ ] **6.** A UI-touching PR that reaches the end of the run without four images has a **failing**
      `evidence` check whose summary names each missing surface and why.
- [ ] **7.** A draft PR never fails `evidence`. The check still **reports** on a draft (it is skipped
      internally, not by a job-level `if:`), so a required context is never left pending forever, and
      marking a PR ready re-runs it — `types:` includes `ready_for_review`.
- [ ] **8.** A PR touching `src/app/(tabs)/**` additionally requires at least one capture flow
      (`.maestro/*.yaml` tagged `capture`, or `e2e/web/*.capture.spec.ts`) in the diff or already
      present for that screen; without one, `evidence` fails and says which screen is uncovered. Any
      screenshots such a flow produces are published alongside the four.
- [ ] **9.** A PR **from a fork** — where the token is read-only and cannot write a branch or the
      body — still captures, attaches the images as workflow artifacts, **passes** `evidence`, and
      states in the check summary that the body could not be written and where the images are. A
      contributor is never blocked by a permission they cannot be given.
- [ ] **10.** Verifiable in the diff rather than by inspection: the capture jobs reference no
      `secrets.*` and run with `permissions: contents: read`; only the publish job holds
      `contents: write` and `pull-requests: write`; no workflow added here uses `pull_request_target`;
      the images are scanned for secrets before the evidence commit.
- [ ] **11.** `.github/PULL_REQUEST_TEMPLATE.md` no longer asks the author to drag files that CI now
      provides, and no longer shows a Before column CI does not produce.

## The path rule

One rule, stated once, default-exempt:

> A PR is **UI-touching** when its diff includes any of `src/**` or `app.json`. Everything else —
> `docs/**`, `.github/**`, `.claude/**`, `e2e/**`, `.maestro/**`, `eas.json`, `tsconfig.json`,
> `package.json`, `package-lock.json`, `*.md` — is exempt.

Revision 1 listed `assets/**`; there is no such directory. The images live under `src/assets/`, which
`src/**` already covers.

`package.json` is deliberately **not** a trigger: a Prettier bump would otherwise pay for a
three-surface capture. An Expo SDK bump is a UI change in effect, and it is expected to touch `src/**`
or `app.json` in the same PR; when it does not, the author asks for a re-run.

## Out of scope

- **Native dark appearance.** Doubles the two slow legs; revisit when the runners are proven.
- **`before` images.** CI captures the PR's own commit. Reconstructing a baseline means building the
  base commit too, roughly doubling every run. `capture.mjs before` still serves anyone who wants a
  comparison locally.
- **Driving journeys automatically.** Beyond launch readiness, depth comes from a capture flow the PR
  supplies (criterion 8).
- **Seeding or faking a session in the app.** Explicitly rejected, see "The auth gate".
- **Fixing `expo-secure-store` on web.** A real pre-existing defect surfaced by this work, and its own
  intent.
- **Making `evidence` a required status.** The workflow reports the check; turning it into a merge
  block is a repo-settings change through `protect-main.mjs`, and the repo owner's call. Until that
  happens this is advisory — a red check nobody is forced to respect.
- **Reconciling `AGENTS.md`, `feature-loop` and `capture-evidence`**, which all still say "before
  **and** after". They are `guard-write`-protected and code-owner-owned, so they need a governance
  session; criterion 11 covers only the PR template, which is not protected. Tracked as follow-up.
- **A line in `ci-local.mjs`.** `evidence` cannot run locally (it needs a PR number and runners), and
  `ci-local.mjs` lives under the governance-guarded `.claude/`. It stays absent, which means
  `npm run verify` green does not imply `evidence` green — stated here so the receipt is not misread.

## Preconditions, verified before planning

- **The repository is public** (`gh repo view` → `"isPrivate": false`). Both the free macOS minutes
  and the `raw.githubusercontent.com` URLs depend on it. If it ever goes private, the images stop
  rendering and this design needs revisiting.
- **The default workflow token permission must allow `contents: write` to be granted.** `ci.yml`
  declares no `permissions:` block today, and repos default to read-only; the publish job therefore
  requests its permissions explicitly, and a 403 on push is the expected symptom if the repo-level
  setting forbids it.
- **A branch pushed with `GITHUB_TOKEN` does not trigger further workflow runs**, which is what keeps
  this from looping. Nobody should "fix" that with a PAT.

## Cost, stated so it can be objected to

Per UI-touching PR, roughly: web ~3 min, Android ~12-18 min (prebuild, `assembleDebug`, emulator
boot), iOS ~18-25 min (`prebuild` and `xcodebuild` cold, no Pods cache). Free on a public repo, and
the macOS leg is the one to drop first if that changes.

## Hosting, and the decision it reverses

`.gitignore` says of `.evidence/`: _"These attach to the pull request; they are never committed.
Binaries in git are forever."_ This spec **reverses that for CI output**, because GitHub has no API
for comment attachments and a workflow cannot drive a browser upload. Images go to an unmerged
`evidence/pr-<n>` branch at path `pr/<n>/<sha>/<name>.png` — outside any ignored prefix, so no
`git add -f` is needed.

Decider: the repo owner, who accepted the same trade-off manually for PR #11. The volume is higher
here (every UI push, not one PR), so: one branch per PR, and the branch is deleted when the PR closes
— which breaks the images in closed PRs, and is the reason that choice is written down here rather
than assumed.
