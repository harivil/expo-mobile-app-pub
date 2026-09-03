# Intent: a basic profile page

Author: originator (repo owner) · Status: accepted

## Problem

The app has one screen. There is nowhere to show anything about the person using it, and no
navigation structure to put a second screen into — [`counter-screen`](counter-screen.md) settled on a
single route deliberately, because a second screen had not been asked for yet. Now it has been.

The request, verbatim and in full:

> update the app by adding a basic profile page

## Proposed outcome

Someone can move between the counter and a profile page from a tab bar at the bottom of the app, and
the profile page shows who they are: a name, a handle, an avatar, and a couple of account rows.

## Decisions taken by the originator

Both were asked before any file was written, because either answer led to materially different work.

1. **Read-only, with placeholder data.** The page displays a fictional profile from hardcoded
   values. No editing, no device storage, no network call. The two alternatives offered — editable
   in memory, and editable with persistence — were declined.

2. **Bottom tabs, Counter and Profile.** Primary navigation is a tab bar, which is the native
   convention on both platforms, rather than pushing the profile onto the stack behind a link from
   the counter.

The second answer **supersedes the single-route decision** recorded in
[`counter-screen`](counter-screen.md). That decision was correct when it was made — an Explore tab
nobody had asked for is not a reason to build a tab bar — and it is superseded now for the right
reason: a second screen was actually requested. Three claims corrected in that change describe a
single-route app and are corrected again here, which is the honest cost of having kept them accurate
the first time.

## Affected users and systems

Anyone opening the app, on iOS, Android and web. It restructures the routes: the counter's file moves
into a tab group. A `(tabs)` group is **omitted from the URL**, so the counter stays at `/` and no
existing deep link breaks — worth stating because "restructuring the routes" sounds like it should
break one. It adds no service, no storage and no network dependency.

## Constraints

- **No real personal data, of anyone.** The profile is fictional placeholder content. No real name,
  email address, date of birth, account number, payment detail or health information goes into this
  repo, and none is collected, stored, logged or sent anywhere. This is a layout, not a data feature.
- **The counter must keep working exactly as it does today**, including its zero floor and its
  accessibility behaviour. Moving it into a tab group must not change it.
- **The count is still not persisted**, and switching tabs is not a promise that it survives.
- **iOS and Android still cannot be observed** from the machine building this — Windows, no
  simulator, no configured emulator.

## Open questions

- When a real profile eventually replaces the placeholder, it becomes a genuine personal-data
  feature: it will need a privacy review, a decision between `expo-secure-store` and plain storage,
  and the `.semgrep.yml` rules about personal data reaching logs and URLs will start to matter. This
  change deliberately does not pre-empt any of that.
- Does the count survive a tab switch? Stated as an acceptance criterion here so the answer is
  deliberate rather than incidental to how the navigator remounts.
