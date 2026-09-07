# Intent: every PR carries mobile screenshots

Author: hariharanvilvanan, repo owner · Status: accepted

## Problem

A pull request in this repo is supposed to ship visual evidence, and today it does not happen
reliably. The rule lives in `AGENTS.md` and in the `capture-evidence` skill, which means it holds
only when whoever raised the PR remembers it, has the right machine, and chooses to run the script.

Two failures were seen in one session, on a one-line copy change to the login screen:

- The PR body ended up listing local file paths — `.evidence/login-tagline/before/android.png` and
  four more — with no images. The paths mean nothing to a reviewer, who cannot open them.
- iOS was never captured at all. There is no iOS simulator on Windows, and the machine that raised
  the PR runs Windows.

The originator's words: _"what i want is if a developer works in a branch and raise a PR, that PR
should always have mobile screenshots uploaded. this is my primary goal."_

The word that decides the design is **always**. A developer following instructions is not always.

## Proposed outcome

A reviewer opening any pull request that changes the app sees, in the body, what the app looks like
on iOS, Android and web — without the author having done anything to put them there, and without
depending on which OS the author runs.

A PR that changes the app and somehow has no screenshots cannot be moved to review.

## Affected users and systems

Everyone who raises or reviews a PR here — humans in a browser, and agents running Claude Code or
Codex. It touches GitHub Actions, the PR body, and the repository's branch list (hosted images need
somewhere to live). It does not touch the app.

## Constraints

- **The guarantee cannot depend on the author's machine or OS.** Windows cannot build iOS; that is
  the constraint that makes a local-only answer impossible.
- **Cannot depend on a developer running a script**, or on an agent following `AGENTS.md`. A rule
  that is merely written down is the thing that already failed.
- A docs-only or CI-only PR must not be blocked for lacking screenshots of an app it did not change.
- Free runner minutes only — no paid EAS service is assumed for this to work.
- No secret, credential, or personal data may reach a screenshot: these are published to a public
  repository and are readable by anyone.

## Open questions

- The screenshots show the app's launch state. Driving a deeper journey per PR needs a Maestro flow
  the PR itself supplies, and that is not solved here.
- Whether a `before` image is worth reconstructing in CI (it means building the base commit too,
  roughly doubling the run) or whether `after` on three surfaces is enough for review.
