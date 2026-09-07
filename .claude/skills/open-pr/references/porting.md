# Copying this skill into another project

Copy the whole folder:

```
.claude/skills/open-pr/
├── SKILL.md
├── scripts/
│   ├── open-pr.mjs          orchestrator — preflight, push, PR, upload, rewrite
│   ├── upload-images.mjs    the three hosting routes, and the one-time login
│   └── capture-screens.mjs  portable screenshots, or delegation to the project's own
└── references/
    ├── image-hosting.md
    └── porting.md
```

Nothing outside that folder is required, and nothing in it imports from this repository. It is not
Expo-specific: the PR half works on any GitHub project, and the capture half degrades to "no surfaces
reachable" rather than failing on a project that has no app to screenshot.

## What it needs on the machine

| Needed                | For                                          | Absent means                                                 |
| --------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| `git`                 | branch, push                                 | nothing works                                                |
| `gh`, signed in       | the PR itself                                | preflight refuses, with the command to fix it                |
| Node 18+              | all of it                                    | nothing works                                                |
| Playwright + Chromium | the browser upload route and web screenshots | falls back to manual hosting, and names why                  |
| `adb`                 | Android screenshots                          | recorded as a gap                                            |
| macOS + Xcode         | iOS screenshots                              | recorded as `impossible-here` — the honest answer on Windows |

Playwright is resolved at run time from `playwright`, `@playwright/test`, or `playwright-core`,
whichever the host project already has, so a project with Playwright as a test dependency needs
nothing extra. A project with none:

```bash
npm i -D @playwright/test
```

```bash
npx playwright install chromium
```

## What it adapts to on its own

- **The PR template.** If the project has `.github/PULL_REQUEST_TEMPLATE.md`, that becomes the body
  and the evidence table is filled in place — the script looks for a markdown table whose header row
  starts with `Surface`, and appends an `## Evidence` section when there is none. A team's checklist
  is not ours to replace. Without a template it writes a minimal body of its own.
- **The base branch.** Taken from the repository's default branch unless `--base` says otherwise.
- **Occurrences of `<slug>` in the template** are replaced with the real slug, so artifact pointers
  come out pointing somewhere.
- **An existing capture script.** If `.claude/scripts/capture.mjs` exists, `capture-screens.mjs`
  delegates to it rather than keeping a second definition of what a capture is. That is the seam to
  use if the host project captures differently — write your capture script there and this keeps
  working.

## What to change deliberately

| Thing                           | Where                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------- |
| The surfaces that exist         | `--surfaces`, and the `label` map in `evidenceTable()` if you rename them     |
| The image width in the body     | `cell()` in `open-pr.mjs` — 320px suits a phone screenshot, not a desktop one |
| Where the browser profile lives | `PR_UPLOAD_PROFILE`, if a shared machine needs its own                        |
| The default hosting route       | `--host`; leave `auto` unless the project is public and CI needs to do this   |

## Two things not to change

- **The profile directory stays outside the repository.** It holds a live GitHub session cookie.
- **The upload never submits the comment.** The comment box is an upload endpoint here; posting it
  would notify every subscriber of a PR that is not ready.

## In CI

The browser route needs an interactive login, so it is not a CI route. On a **public** repository CI
can use `--host branch` with a `GH_TOKEN` that has `contents: write`, accepting that the screenshots
land in the object store permanently. On a private one, capture in CI, upload the files as build
artifacts, and let a human attach them — or run this skill locally, which is what it is for.
