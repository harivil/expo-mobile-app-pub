#!/usr/bin/env node
// The `evidence` gate. Decides whether this PR is allowed to be merged without screenshots.
//
//   node .github/scripts/check-evidence.mjs --pr 12 --sha <head> --shots <dir> [--published true]
//
// Exit 0 = allowed. Exit 1 = the check is red.
//
// Every branch of this decision is taken HERE rather than by a job-level `if:`, and that is
// deliberate: a job skipped by `if:` reports no status at all, and a required check that never
// reports leaves a PR permanently pending — unmergeable, with nothing to click. So the job
// always runs, always reports, and this script decides what the report says.

import { existsSync, readdirSync, appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { classify } from "./ui-touched.mjs";

const rest = process.argv.slice(2);
const val = (name, fallback = "") => {
  const i = rest.indexOf(name);
  return i !== -1 && rest[i + 1] ? rest[i + 1] : fallback;
};

const pr = val("--pr");
const sha = val("--sha");
const shotsDir = val("--shots", "shots");
const published = val("--published", "false") === "true";

const REQUIRED = ["ios-light.png", "android-light.png", "web-light.png", "web-dark.png"];

const gh = (...args) => {
  const r = spawnSync("gh", args, { encoding: "utf8", timeout: 120000, windowsHide: true });
  return { ok: r.status === 0 && !r.error, out: (r.stdout ?? "").trim() };
};

// ---------------------------------------------------------------- what the PR is

if (!pr) {
  console.error("--pr is required");
  process.exit(1);
}

const meta = gh(
  "pr",
  "view",
  pr,
  "--json",
  "isDraft,headRepositoryOwner,headRefName,baseRefName",
);
let isDraft = false;
let isFork = false;
if (meta.ok) {
  try {
    const j = JSON.parse(meta.out);
    isDraft = Boolean(j.isDraft);
    const repo = gh("repo", "view", "--json", "owner");
    const owner = repo.ok ? JSON.parse(repo.out).owner?.login : "";
    isFork = Boolean(j.headRepositoryOwner?.login && j.headRepositoryOwner.login !== owner);
  } catch {
    /* fall through with the safe defaults above */
  }
}

const filesResult = gh(
  "api",
  `repos/{owner}/{repo}/pulls/${pr}/files`,
  "--paginate",
  "--jq",
  ".[].filename",
);
const changed = filesResult.ok ? filesResult.out.split(/\r?\n/).filter(Boolean) : [];
const { ui, matched, guarded, flows } = classify(changed);

// A capture flow already in the repo counts, not only one added by this PR — a screen covered
// last month does not need covering again.
const repoFlows = gh(
  "api",
  "repos/{owner}/{repo}/git/trees/HEAD?recursive=1",
  "--jq",
  ".tree[].path",
);
const existingFlows = repoFlows.ok
  ? classify(repoFlows.out.split(/\r?\n/).filter(Boolean)).flows
  : [];
const anyFlow = flows.length > 0 || existingFlows.length > 0;

// ---------------------------------------------------------------- what was captured

const present = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((f) => f.toLowerCase().endsWith(".png"))
  : [];
const missing = REQUIRED.filter((r) => !present.includes(r));

// ---------------------------------------------------------------- the decision

const reasons = [];
let ok = true;
let verdict = "";

if (isDraft) {
  verdict = "skipped — draft";
  reasons.push(
    "This PR is a draft, so screenshots are not required yet. The check still reports so that a",
    "required status is never left pending; marking it ready re-runs the capture.",
  );
} else if (!ui) {
  verdict = "not required — no UI paths touched";
  reasons.push(
    "Nothing in this diff matches the UI path rule (`src/**`, `app.json`), so no screenshots are",
    "expected. Changed files considered: " + (changed.length || 0) + ".",
  );
} else if (isFork) {
  verdict = "passed with a gap — fork PR";
  reasons.push(
    "This PR comes from a fork, where the workflow token is read-only: CI cannot write to a",
    "branch or edit the PR body. The screenshots were still captured and are attached to this",
    "run as artifacts. A maintainer can view them there.",
    "",
    `Captured: ${present.length ? present.join(", ") : "none"}.`,
  );
} else if (missing.length) {
  ok = false;
  verdict = `failed — ${missing.length} of ${REQUIRED.length} surfaces missing`;
  reasons.push("These surfaces produced no screenshot for this commit:", "");
  for (const m of missing) {
    reasons.push(
      `- \`${m}\` — its capture job failed, timed out waiting for the app's first`,
    );
    reasons.push("  screen, or was cancelled. Open that job's log in this run.");
  }
  reasons.push(
    "",
    "Re-run the failed job, or attach the images by hand if the runner cannot produce them.",
  );
} else if (guarded.length && !anyFlow) {
  ok = false;
  verdict = "failed — an authenticated screen has no capture flow";
  reasons.push(
    "This PR changes screens that sit behind the login guard:",
    "",
    ...guarded.map((g) => `- \`${g}\``),
    "",
    "CI has no session, so the four screenshots above show the login screen and prove nothing",
    "about this change. Add a capture flow that reaches the screen — `.maestro/<name>.yaml` for",
    "native or `e2e/web/<name>.capture.spec.ts` for web — and CI will publish what it reaches.",
    "See the `write-e2e` skill.",
  );
} else if (!published) {
  ok = false;
  verdict = "failed — captured but not published";
  reasons.push(
    "All four surfaces were captured, but the images were not written to the PR body. The",
    "publish step's log has the reason; a 403 there means the repository's default workflow",
    "permission does not allow `contents: write`.",
  );
} else {
  verdict = "passed";
  reasons.push(
    `All ${REQUIRED.length} surfaces captured from \`${sha.slice(0, 7)}\` and published to the PR body.`,
    "",
    ...matched.slice(0, 10).map((m) => `- UI change: \`${m.path}\` (${m.why})`),
  );
  if (guarded.length && anyFlow) {
    reasons.push(
      "",
      "Authenticated screens changed, and a capture flow exists to reach them.",
    );
  }
}

// ---------------------------------------------------------------- report

const summary = [
  `## evidence — ${verdict}`,
  "",
  ...reasons,
  "",
  "<sub>The rule and its reasoning: `docs/specs/pr-screenshots.md`.</sub>",
].join("\n");

console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}

process.exit(ok ? 0 : 1);
