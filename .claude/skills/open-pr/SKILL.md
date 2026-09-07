---
name: open-pr
description: Push the current branch and open a GitHub pull request whose body renders screenshots of the app on iOS, Android and web. Use when a change is ready to review, when a PR needs its screenshots embedded rather than described, or when asked to raise a PR for work already pushed.
---

# Open a PR with screenshots in it

A reviewer who has to check out the branch and boot a simulator to see what changed will not do it.
Screenshots in the body are what make a mobile PR reviewable in the two minutes someone actually has,
which is why this exists as a procedure rather than a suggestion.

One command, from the branch you built on:

```bash
node .claude/skills/open-pr/scripts/open-pr.mjs <slug> --capture --what "one sentence"
```

It does five things in an order that cannot be rearranged:

1. **Preflight** — `gh` present and signed in, you are not standing on the base branch, no
   uncommitted work. It refuses rather than opening a half-PR.
2. **Push** the current branch, and only ever that branch.
3. **Open the PR** with the repository's own template as the body.
4. **Upload the screenshots**, which needs a PR page to upload them through.
5. **Rewrite the body** with the hosted URLs, so the images render inline.

Steps 3 to 5 are separate because **GitHub has no public API for attaching an image to a comment or
a PR body.** The REST API can create the PR and edit its text; it cannot host a PNG. That single fact
shapes this whole skill — [`references/image-hosting.md`](references/image-hosting.md) has the detail,
including which prior art solves which part.

## One-time setup per machine

The upload route drives a real browser against github.com, so it needs a GitHub session saved on
this machine:

```bash
node .claude/skills/open-pr/scripts/upload-images.mjs --login
```

A browser window opens on the GitHub login page and **you** sign in — password and 2FA included.
Nothing you type passes through the script or the agent; it polls for the session to appear and then
saves the profile outside the repository, under `~/.cache/github-pr-uploads/`. Never inside it: a
browser profile holds live session cookies, and a repository is the last place those belong.

Check what is usable here without uploading anything:

```bash
node .claude/skills/open-pr/scripts/upload-images.mjs --check
```

## Where the images go

| Route                                       | Works on         | Cost                                                                                       |
| ------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| **browser** — `github.com/user-attachments` | public + private | needs a saved session and a Chromium; breaks if GitHub reworks the comment box             |
| **branch** — `raw.githubusercontent.com`    | **public only**  | commits the binaries; the repository carries them forever, and the branch can never be cut |
| **manual**                                  | always           | a human drags the files in                                                                 |

`--host auto` — the default — tries the browser and falls back to **manual**, printing the paths to
drag. It never falls back to `branch`: putting screenshots into git history is a decision, not a
retry. Ask for it explicitly with `--host branch`, and know that it refuses on a private repository
because a `raw.githubusercontent.com` URL does not render there for anyone.

**This repository is private**, so the browser route is the only one that renders here.

## Windows and macOS

| Surface | Captured with                | Windows                 | macOS |
| ------- | ---------------------------- | ----------------------- | ----- |
| Android | `adb exec-out screencap`     | yes                     | yes   |
| iOS     | `xcrun simctl io screenshot` | **no simulator exists** | yes   |
| Web     | Playwright                   | yes                     | yes   |

Everything else — the upload, the PR, the body — is identical on both. The iOS gap is structural, not
a setup problem, and it is **named in the PR body** rather than left blank:

> **Unverified surfaces** — iOS: not possible on this machine (the iOS simulator only exists on macOS)

That line is the point of the whole skill. A gap someone can read gets picked up by whoever has the
right machine; an implied one ships broken. If you want that gap closed from Windows, a cloud
simulator is the only self-service option — see [`release-app`](../release-app/SKILL.md) and the
`eas-simulator` skill, which is a paid EAS feature and therefore a cost decision.

## Capturing

`--capture` shoots the surfaces that are reachable right now and files them as the **after** phase.
The **before** phase cannot be captured here, because by the time a PR exists the old behaviour is
gone — that is [`capture-evidence`](../capture-evidence/SKILL.md)'s job at the start of the build, and
this skill picks up whatever it left in `.evidence/<slug>/`.

So the useful sequence across a change is:

```bash
node .claude/scripts/capture.mjs before <slug> --surfaces ios,android,web --record
```

…build…

```bash
node .claude/skills/open-pr/scripts/open-pr.mjs <slug> --capture --what "..."
```

Anything already in `.evidence/<slug>/before/` and `after/` is included without being re-shot, and
`--images <dir>` takes files from somewhere else entirely — a teammate's iOS screenshots dropped into
a folder, say.

## What it will not do

- **It never pushes to the base branch.** It pushes the branch you are on and refuses if that is the
  base. `main` moves by merging a reviewed PR, which is enforced by hooks and by branch protection —
  see [`../../../AGENTS.md`](../../../AGENTS.md).
- **It never posts a comment.** The upload uses the comment box because that is where GitHub's
  upload lives, then clears it. Nothing is ever submitted.
- **It never handles a credential.** Sign-in happens in your browser, in front of you.
- **It never force-pushes**, and it updates an existing PR for the branch rather than opening a
  second one.

## Before you ask for a review

The body starts as the repository's template, so it still carries the template's own prompts. `--what`
fills the summary; the checklists are yours. A PR whose description reads "One paragraph." has not
been written yet, and the script says so on the way out.

## Copying this into another project

The skill folder is self-contained — copy `.claude/skills/open-pr/` and it works, on any Git and
GitHub project, Expo or not. What changes and what to check is in
[`references/porting.md`](references/porting.md). The short version: it needs `git`, `gh`, and Node,
it prefers a `.github/PULL_REQUEST_TEMPLATE.md` if the project has one, and it uses the project's own
capture script when there is one at `.claude/scripts/capture.mjs` rather than keeping a second,
quietly different definition of what a capture is.
