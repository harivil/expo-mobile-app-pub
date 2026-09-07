# Plan: one capture script, and a Windows web capture that works

Spec: none — sized **standard**, the request is the intent · Branch: `harness-sync`

Two near-identical capture scripts exist. The one that runs is the one with the bug, and the one with
the fix never executes. This collapses them to one and fixes the Windows web path, then proves the
result with a deliberately visible login-screen change.

## The problem, stated precisely

`.claude/scripts/capture.mjs` and `.claude/skills/open-pr/scripts/capture-screens.mjs` are the same
script. Differences, in full:

|                                        | `scripts/capture.mjs`                                                 | `open-pr/scripts/capture-screens.mjs`                    |
| -------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| android / ios / web capture            | identical                                                             | identical                                                |
| `--record` (video)                     | yes — `adb screenrecord`, `simctl recordVideo`, `RECORD_SECONDS = 12` | no                                                       |
| `--url` for the web target             | no                                                                    | yes                                                      |
| Windows `npx` spawn                    | **broken**                                                            | worked around with `shell: process.platform === "win32"` |
| Inside the copy-pasteable skill folder | no                                                                    | yes                                                      |

`capture-screens.mjs:41-51` delegates to `capture.mjs` whenever that file exists. So in this repo the
buggy copy is what runs — including through `open-pr.mjs --capture` — and the fixed copy is dead
code. **The Windows fix lives in the only file that never executes here.** That is how
`.evidence/login-signin-copy/manifest.json` came to carry a hand-written
`"captured by hand: capture.mjs cannot spawn npx on Windows (ENOENT)"`.

Verified on this machine, Node v24.7.0, Windows 11:

```
spawnSync('npx',     ['--no-install','playwright','--version'])  ->  ENOENT
spawnSync('npx.cmd', ['--no-install','playwright','--version'])  ->  EINVAL
node node_modules/playwright/cli.js --version                    ->  Version 1.62.1
```

`npx.cmd` fails because Node 20.12+ refuses to spawn `.cmd`/`.bat` without a shell. And
`shell: true` is not available as a fix: `.claude/check-skills.mjs:283` fails the build on it, for the
good reason that it reintroduces per-OS quoting. The route that works on both OSes without a shell is
to run Playwright's own CLI entrypoint through `process.execPath`.

## Files that change

```
.claude/skills/open-pr/scripts/capture-screens.mjs   the single capture implementation:
                                                     port --record from capture.mjs, fix the web
                                                     path, drop the delegation-to-self case
.claude/scripts/capture.mjs                  (del)   delete — it is the shadowing duplicate
.claude/skills/capture-evidence/SKILL.md             repoint lines 18 and 24
.claude/skills/feature-loop/SKILL.md                 repoint lines 113 and 152
.claude/skills/verify-app/SKILL.md                   repoint line 69
.claude/skills/open-pr/SKILL.md                      repoint line 95; rewrite the delegation
                                                     paragraph at line 131
.claude/skills/open-pr/references/porting.md         rewrite the delegation seam at line 53
AGENTS.md                                            repoint line 308
README.md                                            prose mention of `capture.mjs` at line 182
src/app/login.tsx                                    the visible change that proves the pipeline
```

Every path under `.claude/` and `AGENTS.md` is refused by `guard-write`. This work needs a session
started as `ALLOW_GOVERNANCE_EDIT=1 claude`; that is why it is a plan and not a diff.

## Order of work

Each step leaves the repo working.

1. **Port `--record` into `capture-screens.mjs`.** Lift `androidVideo()`, `iosVideo()`,
   `webVideo()` and `RECORD_SECONDS` from `capture.mjs` unchanged. Keep the richer status icon map
   from `capture.mjs`'s reporter — it distinguishes `manual` from `unavailable`, which the terse one
   does not. Verify: `--record` against the booted emulator produces `android.mp4`.
2. **Fix the web path.** Resolve Playwright from the host project and invoke its CLI through
   `process.execPath`, no shell:

   ```js
   // playwright/index.js is CommonJS; a dynamic import lands it under .default
   const req = createRequire(join(process.cwd(), "package.json"));
   let cli = null;
   for (const p of [
     "playwright/cli.js",
     "@playwright/test/cli.js",
     "playwright-core/cli.js",
   ]) {
     try {
       cli = req.resolve(p);
       break;
     } catch {
       /* try the next one */
     }
   }
   // then: run(process.execPath, [cli, "screenshot", ...])
   ```

   Keep the existing "playwright is not installed here" gap message for when none resolve. Verify:
   web capture succeeds on Windows with no hand-editing of the manifest.

3. **Hide the dev-server banner.** `#error-toast` is injected into `<body>` beside `#root` by the
   Expo dev server — dev chrome, not app UI, and absent from a production export. It covers the
   Login button, so every web screenshot taken against a dev server is partly obscured. Inject
   `#error-toast{display:none!important}` before shooting. Verify: the Login button is visible in
   `web-light.png`.
4. **Delete `.claude/scripts/capture.mjs`.** Keep the delegation branch in `capture-screens.mjs` —
   it still serves a _host_ project with a genuinely different capture script. This repo just stops
   shipping a stale copy of the same one.
5. **Repoint the eight references** listed above. `grep -rn "scripts/capture\.mjs"` must come back
   empty except for the delegation branch's own comment.
6. **Assert the before/after pair is comparable.** Borrowed from
   [`github/awesome-copilot`'s `pr-screenshots`](https://github.com/github/awesome-copilot/blob/main/skills/pr-screenshots/SKILL.md):
   _"Before/after pairs must use the same viewport width and crop — otherwise the comparison is
   meaningless."_ Read each PNG's IHDR (`buf.readUInt32BE(16)`, `buf.readUInt32BE(20)`) and record a
   dimension mismatch in the manifest so `open-pr.mjs` surfaces it beside the gap notes. Existing
   evidence passes this today — captures come off one device — so it is a guard against
   hand-captured pairs, not a fix for a live break.
7. **The login change**, and the `after` capture. See below.
8. **`node .claude/scripts/ci-local.mjs`**, then `open-pr.mjs`.

## The login change

`src/app/login.tsx` `styles.wordmark`: `fontSize` 22 → 28, `lineHeight` 28 → 34.

Its purpose is to exercise the evidence pipeline end to end with something a reviewer can actually
see, and it should be read that way rather than as a design decision — whoever owns the login screen
should confirm they want the larger wordmark. It is one property pair, reverts in one line, and the
baseline screenshots show why the brand mark is the safe thing to touch: the wordmark sits alone at
the top of the screen with nothing to reflow against.

The same screenshots show a real problem this change does **not** address — roughly 60% of the login
screen is empty, because `styles.safeArea` uses `justifyContent: "space-between"` with only two
children. That is a layout decision with a design owner, so it is noted and left alone.

## Risks

- **The riskiest step is 5, not 2.** A missed reference is a command in a skill that no longer
  exists, and the agent that follows it fails at the moment it is trying to capture evidence. The
  grep in step 5 is the check that matters.
- Deleting `capture.mjs` while `capture-screens.mjs` still prefers it would leave no working capture
  at all. Steps 1-3 must land before step 4.
- `--record` is the least-tested surface. `adb screenrecord` behaves differently across emulator
  images, which is why `capture.mjs` already treats its failure as a gap rather than an error; keep
  that.
- The Playwright CLI path is resolved from `process.cwd()`, so running the script from outside the
  project root will not find it. Acceptable — every documented invocation is from the root.

## Alternatives not taken

- **Keep both scripts, fix only `capture.mjs`.** Rejected: it leaves two definitions of what a
  capture is, and the next divergence is silent again. The duplication is the bug.
- **Keep `capture.mjs` as the survivor instead.** Rejected: it sits outside
  `.claude/skills/open-pr/`, and the point of that folder is that it copy-pastes into another Expo
  app whole. A copy-paste target that gets the degraded capturer defeats the exercise.
- **`shell: true` for the `npx` call.** Rejected: `check-skills.mjs:283` fails the build on it, and
  it is the right rule.
- **Capture web against a production export** (`npx expo export -p web` and serve `dist/`) instead of
  hiding `#error-toast`. Genuinely better evidence — no dev chrome at all — but it adds an export
  step to every capture. Worth revisiting if dev-server chrome shows up again.
- **`github/awesome-copilot`'s `pr-screenshots` skill wholesale.** It is a prose convention guide
  with no capture driver, its upload half is PowerShell (banned by `check-skills.mjs:141`) and
  Azure DevOps-specific, and its GitHub route is marked "work in progress" — the orphan-branch
  workaround this repo already evaluated and demoted to opt-in `--host branch`. Its two rules worth
  having are taken in step 6 and already satisfied elsewhere (`open-pr.mjs` emits
  `<img width="320">` and never wraps evidence in `<details>`).

## Proof

- `node .claude/skills/open-pr/scripts/capture-screens.mjs before <slug> --surfaces android,web`
  on **Windows**, with no hand-edited manifest entry and no `unavailable` for web. This is the
  specific thing that did not work before.
- `--record` produces `android.mp4` against the booted emulator; `ios` records `impossible-here` on
  Windows rather than failing.
- `grep -rn "scripts/capture\.mjs"` returns only the delegation comment.
- `node .claude/scripts/ci-local.mjs` green, including `check-skills.mjs` (no `shell: true`, no
  hardcoded drive letters) and `hooks.test.mjs`.
- The login change visible in the PR body on **Android, web light and web dark**; iOS named as
  `impossible-here` with an owner, since there is no iOS simulator on Windows.
