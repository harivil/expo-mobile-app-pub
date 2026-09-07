# Plan: PR screenshots, captured by CI

Spec: [`../specs/pr-screenshots.md`](../specs/pr-screenshots.md) · Branch: `pr-screenshots`

## Files that change

```
.github/workflows/screenshots.yml            (new)  capture + publish + the `evidence` check
.github/scripts/ui-touched.mjs               (new)  the path rule, one implementation
.github/scripts/shoot-web.mjs                (new)  serve the static export, shoot light + dark
.github/scripts/publish-evidence.mjs         (new)  push images to evidence/pr-<n>, rewrite the body
.github/scripts/check-evidence.mjs           (new)  the gate: decide pass/fail and write the summary
.github/scripts/evidence-body.mjs            (new)  compose the marker block (shared, unit-tested)
.github/scripts/evidence-body.test.mjs       (new)  node:test — markers, SHA, idempotence
.github/PULL_REQUEST_TEMPLATE.md                    drop the drag instruction and the Before column
docs/intent/pr-screenshots.md                (new)  written
docs/specs/pr-screenshots.md                 (new)  written, revision 2
docs/plans/pr-screenshots.md                 (new)  this file
```

Nothing under `.claude/`, `AGENTS.md` or `REVIEW.md`: those are governance-guarded and code-owner
owned, and the spec records the two reconciliations they need as follow-up. Scripts live under
`.github/scripts/` beside the only workflow that runs them, not in `.claude/scripts/`, for the same
reason.

## Order of work

Each step leaves the repo in a working state, and each is verifiable on its own.

1. **`ui-touched.mjs`** — read a list of changed paths on argv or stdin, print `true`/`false` plus
   the matched path. Verifiable immediately against this very branch's diff, which is docs-only and
   must print `false`, and against the `login-tagline` diff, which must print `true`.
2. **`evidence-body.mjs` + its test** — pure string work: compose a marker-delimited block from
   `{sha, images[], gaps[]}`, and replace an existing block in a body without touching the rest.
   `node --test` covers first insert, replace, foreign content preserved, and no-images case.
3. **`shoot-web.mjs`** — `expo export -p web`, serve `dist/` from node, Playwright `login-screen`
   readiness wait, shoot light and dark. Already proven on this machine at ~1.3s per shot; this step
   only moves the proven script into the repo.
4. **`check-evidence.mjs`** — the gate. Reads the PR (via `gh api`), the changed paths, and the
   captured file list; decides pass/fail/skip; writes `$GITHUB_STEP_SUMMARY`; exits non-zero only on
   a real failure. Draft, fork and non-UI cases are decided **inside** the script so the job always
   reports.
5. **`publish-evidence.mjs`** — create or reuse `evidence/pr-<n>`, upload each PNG through
   `gh api PUT /contents/pr/<n>/<sha>/<name>.png`, then `gh pr edit --body-file` with the composed
   block. Skips itself with a clear message when the token is read-only (fork).
6. **`screenshots.yml`** — wire it: `web`, `android`, `ios` capture jobs, then `publish`, then
   `evidence`. Web first so the workflow is useful before the slow legs are trusted.
7. **PR template** — remove what CI now does.

## The workflow shape, and why each part is that way

```
on: pull_request [opened, synchronize, reopened, ready_for_review]

detect     (ubuntu, contents:read)   → outputs.ui = true|false
web        (ubuntu, contents:read)   → artifact web-light.png, web-dark.png     needs: detect
android    (ubuntu, contents:read)   → artifact android-light.png              needs: detect
ios        (macos,  contents:read)   → artifact ios-light.png                  needs: detect
publish    (ubuntu, contents:write + pull-requests:write)  needs: [web, android, ios]  if: !cancelled()
evidence   (ubuntu, contents:read)   needs: [detect, publish]  if: always()     ← the reported check
```

- **`types:` includes `ready_for_review`**, because the default set does not, and without it a PR
  opened as a draft would never re-report the check after being marked ready.
- **`evidence` uses `if: always()` and decides internally.** A job skipped by an `if:` reports
  nothing, and a required context that never reports is pending forever — an unmergeable PR.
- **`publish` uses `if: !cancelled()`** so three surfaces still publish when one leg fails; the
  missing one becomes a named gap and `evidence` fails on it.
- **Own concurrency group**, `screenshots-pr-<n>`, without `cancel-in-progress`. `ci.yml` cancels in
  progress on `ci-${{ github.ref }}`; sharing that would let a cancel land between "images pushed"
  and "body rewritten", leaving the body pointing at a SHA that is no longer head.
- **Permissions are job-scoped**, least-privilege: only `publish` can write. `pull_request_target`
  is not used anywhere — it would check out fork code with a write token, which is the escalation
  the spec forbids.
- **Every capture job waits on the `login-screen` testID**, never a sleep, because
  `animated-icon.tsx` holds a 600ms splash overlay and a fixed wait would photograph it.

Per surface:

- **web** — `npx expo export -p web`, serve `dist/` from a 30-line node server, Playwright Chromium
  at 390×844 dpr 2, `colorScheme` light then dark. No dev server: the Metro dev server never fires
  `load`, which is exactly why the local Playwright suite times out today.
- **android** — `npx expo prebuild -p android`, `./gradlew assembleDebug`,
  `reactivecircus/android-emulator-runner` (API 34, `google_apis`), install the APK, launch, poll
  `adb exec-out uiautomator dump` for `login-screen` as the readiness signal, then
  `adb exec-out screencap -p`.
- **ios** — `macos-latest`, `npx expo prebuild -p ios`, `xcodebuild` for a simulator destination,
  `xcrun simctl boot` + `install` + `launch`, poll for readiness via
  `xcrun simctl ui`-independent means (accessibility dump is not available, so poll the Metro-free
  bundle's rendered view by screenshotting and comparing against the splash — see Risks), then
  `xcrun simctl io booted screenshot`.

## Risks

- **iOS readiness is the weakest link and the riskiest step (6).** There is no `simctl` equivalent
  of `uiautomator dump`, so "is `login-screen` visible" is not directly observable. Mitigation:
  drive the iOS leg with **Maestro** (`maestro test` with `assertVisible: id: "login-screen"` then
  `takeScreenshot`), which speaks the accessibility tree on both platforms and is already this
  repo's native E2E tool. If Maestro on a GitHub macOS runner proves unreliable, the honest fallback
  is to report iOS as a gap rather than ship a splash-screen photograph.
- **Cold native builds may exceed sensible PR latency** (~20-25 min for iOS). If so, the fallback is
  to run the two native legs only on `ready_for_review` and on pushes to a PR labelled `ui`, keeping
  web on every push — a change to the trigger, not to the design.
- **The evidence branch grows forever.** One commit per push per image. Mitigated by capturing only
  UI-touching PRs and by deleting the branch on PR close, which is itself a trade the spec names.
- **`publish` needs `contents: write`.** If the repository's default workflow permission is
  read-only _and_ set to disallow elevation, the push 403s. The failure is loud and the fix is a
  repo setting, not a code change.
- **A fork PR cannot publish at all.** Handled as a pass with an explanation, so an outside
  contributor is never blocked — but it means the guarantee is weaker for forks, by necessity.

## Alternatives not taken

- **Reusing `.eas/workflows/e2e.yml` and EAS Build for the native legs.** EAS already builds and
  runs Maestro on real devices, and would be more reliable than emulators in Actions. Rejected
  because the intent constrains this to free runner minutes and EAS Build is a paid service; the EAS
  path stays available if the runner legs prove too fragile.
- **Seeding a fake session so CI can shoot authenticated screens.** Rejected in the spec: an
  auth-bypass path in a health app is a bigger risk than a less useful screenshot.
- **Committing images to the PR branch itself.** Pollutes the diff under review with binaries and
  changes the SHA the check just validated.
- **Workflow artifacts only.** They cannot render inline in a body — a reviewer would be back to
  downloading a zip, which is the paths-instead-of-pictures failure this work exists to fix.
- **A browser-driven upload to `user-attachments`** (what `upload-images.mjs` does locally).
  Needs an interactive GitHub session; there is none in Actions.

## Proof

- `node --test .github/scripts/evidence-body.test.mjs` — marker insert, replace, foreign-content
  preservation, empty case.
- `node .github/scripts/ui-touched.mjs docs/specs/x.md` → `false`; `... src/app/login.tsx` → `true`.
- `node .github/scripts/shoot-web.mjs` run **here**, producing `web-light.png` and `web-dark.png`
  that show the login screen with no splash overlay — already demonstrated at ~1.3s per shot.
- `node .claude/scripts/ci-local.mjs` green, including `check-skills.mjs`'s portability sweep over
  the new `.mjs` files.
- The workflow itself proven only by **this PR's own run**: the three capture jobs and the body
  rewrite cannot execute on a Windows laptop. That run is the acceptance test, and the PR is opened
  as a draft until it is green — the first push is expected to be the debugging round.
- Acceptance criteria 5 and 7 checked against this PR directly: it touches no `src/**` path, so
  `evidence` must pass with no images, and it starts as a draft.
