# Getting an image into a GitHub PR body

The one fact everything else follows from: **GitHub has no public API for attaching a file to a
comment, an issue, or a PR body.** The REST and GraphQL APIs will happily create a PR and rewrite its
markdown; neither will host a PNG. Markdown can only reference a URL that already exists.

So there are exactly three places a screenshot can live, and each costs something.

## 1 · `github.com/user-attachments` — what the web UI uses

Dropping a file into a comment box uploads it immediately, to a signed URL that renders for anyone
who can read the repository — **public or private**. Two properties make it the right default:

- The asset is **persisted the moment it uploads**, independent of whether the comment is ever
  posted. So the comment box can be used purely as an upload endpoint and then cleared. Nothing is
  submitted; no notification is sent.
- The URL is stable and needs no extra branch, release, or bucket.

The cost is that this upload is a browser flow — an authenticity token plus a multipart POST the
page performs — so reaching it means driving a real browser. `upload-images.mjs` does that with
Playwright against a saved Chromium profile.

**This is the fragile part of the skill, and it is fragile in a specific way.** It depends on finding
the comment textarea and its file input on the PR page. When GitHub reworks that page the selector
list in `commentBox()` goes stale, and the failure is loud on purpose: the script screenshots what it
actually saw into the temp directory and names the function to fix. It does not silently open a PR
with no images.

## 2 · An evidence branch and `raw.githubusercontent.com`

`gh api` can create a branch and PUT file contents onto it without touching the working tree, and a
`raw.githubusercontent.com` URL pinned to the resulting commit SHA is immutable. No browser needed,
which makes it the only route that works unattended in CI.

Two real costs, which is why it is never automatic:

- **A raw URL does not render in a PR body on a private repository.** The reader's browser has no
  credential for it, so the image silently breaks. The script refuses rather than producing a body
  full of broken images.
- **The bytes are in the repository forever.** The branch is never merged and must never be deleted,
  or every URL in the PR dies. Deleting it later does not reclaim the objects either.

## 3 · A human drags the files in

Always works, costs a human thirty seconds, and is the honest fallback. `--host auto` lands here when
the browser route is unavailable, and prints the exact paths to drag.

## Prior art, and what this skill took from it

| Project                                                                                             | What it solves                                                               | Verdict here                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`tonkotsuboy/github-upload-image-to-pr`](https://github.com/tonkotsuboy/github-upload-image-to-pr) | uploads a local image to a PR by browser automation, then `gh pr edit`       | **Adopted, reimplemented.** The mechanism is right and is the core of route 1. It is not vendored because it depends on whichever browser MCP server the agent happens to have, and it starts from an image that already exists — capture and the PR body are ours.  |
| [`conorluddy/ios-simulator-skill`](https://github.com/conorluddy/ios-simulator-skill)               | 27 Python scripts driving `xcodebuild`, `simctl`, `idb` — build, test, drive | **Not adopted.** Its build half assumes a committed Xcode project; this repo generates `ios/` on demand and blocks writes to it. macOS-only, and Python where this repo is Node. `capture-screens.mjs` already gets the one line we need — `simctl io … screenshot`. |
| [`lackeyjb/playwright-skill`](https://github.com/lackeyjb/playwright-skill)                         | a generic executor for agent-written Playwright scripts                      | **Not adopted.** Playwright is already a dev dependency here, with `e2e/web/` and the `write-e2e` skill owning how it is used. A third way to drive a browser is a maintenance cost, not a capability.                                                               |

The pattern worth naming: adopt a **mechanism** you have verified, not a dependency you have not.
Route 1 exists because that project proved the upload works this way; the code is ours because the
surrounding decisions — where captures come from, which surfaces are gaps, what the body says — are
ours.

## What to check when this breaks

| Symptom                                     | Look at                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| "could not find the comment box"            | the screenshot it saved in the temp directory, then `commentBox()` in `upload-images.mjs`  |
| "the saved GitHub session has expired"      | run `upload-images.mjs --login` again                                                      |
| "timed out waiting for GitHub to accept …"  | file size — GitHub caps images at 10 MB and video at 10 MB per file                        |
| images broken in the body of a private repo | the `branch` route was used; re-run with `--host browser`                                  |
| PR opened but body has local paths in it    | the route fell back to manual — the reason is printed, and the files just need dragging in |
