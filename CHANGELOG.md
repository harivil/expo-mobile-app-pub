# Changelog

What changed for a **user**, not a list of commit subjects. `versioning` step 4 is what keeps
this current, and the Conventional Commit log is what decides the version above each block.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
semver as [`versioning`](.claude/skills/versioning/SKILL.md) section 3 defines it.

## [Unreleased]

### Added

- The delivery harness: agent skills, guard hooks, three review agents, and the intent → spec
  → plan → build → verify → review → ship loop.
- Expo SDK 57 app on iOS, Android and web — a single counter screen whose count clamps at zero,
  built on design tokens with light and dark palettes and four themed primitives (`Screen`,
  `ThemedText`, `ThemedView`, `Button`).
- Release path: `eas.json` with remote build numbers and the `fingerprint` runtime policy,
  plus EAS workflows for the production release and OTA updates.
- Test layers: Jest unit and functional tests, and Playwright web coverage of the counter, browser
  reload and the desktop content column. Two Maestro native flows are committed — launch smoke and
  the counter journey — but **neither has run on a device yet**, and only the smoke flow is wired
  into `.eas/workflows/e2e.yml`.

<!-- Nothing has shipped to a store yet, so there is no released version below this line. -->
