#!/usr/bin/env node
// Put the captured screenshots somewhere a PR body can render them, then rewrite the body.
//
//   node .github/scripts/publish-evidence.mjs --pr 12 --sha <head> --shots <dir> [--run-url <url>]
//
// Prints `published=true|false` on the last line for the workflow to read as a step output.
// Exits 0 even when it cannot publish: refusing to publish is a fact for the `evidence` gate to
// judge, not a workflow crash. Only a genuine bug here exits non-zero.
//
// Why a branch and not an attachment: GitHub has no public API for comment attachments — the
// bytes on github.com/user-attachments get there through the web UI's own upload, which needs an
// interactive session no workflow has. So the images are committed to an unmerged
// `evidence/pr-<n>` branch and linked by immutable raw URL. `.gitignore` says evidence is never
// committed; docs/specs/pr-screenshots.md records that this reverses it for CI output, and why.

import { existsSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";

import { composeBlock, spliceBlock } from "./evidence-body.mjs";

const rest = process.argv.slice(2);
const val = (name, fallback = "") => {
  const i = rest.indexOf(name);
  return i !== -1 && rest[i + 1] ? rest[i + 1] : fallback;
};

const pr = val("--pr");
const sha = val("--sha");
const shotsDir = val("--shots", "shots");
const runUrl = val("--run-url");

const ORDER = ["ios-light.png", "android-light.png", "web-light.png", "web-dark.png"];

const gh = (...args) => {
  const r = spawnSync("gh", args, { encoding: "utf8", timeout: 180000, windowsHide: true });
  return {
    ok: r.status === 0 && !r.error,
    out: (r.stdout ?? "").trim(),
    err: (r.stderr ?? "").trim() || String(r.error ?? ""),
  };
};

const done = (published, why = "") => {
  if (why) console.log(why);
  console.log(`published=${published}`);
  process.exit(0);
};

if (!pr || !sha) {
  console.error("--pr and --sha are both required");
  process.exit(1);
}

// ---------------------------------------------------------------- what we have to publish

const files = existsSync(shotsDir)
  ? readdirSync(shotsDir)
      .filter((f) => f.toLowerCase().endsWith(".png"))
      .sort((a, b) => {
        const ia = ORDER.indexOf(a);
        const ib = ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
      })
      .map((f) => join(shotsDir, f))
  : [];

if (!files.length) done(false, `no PNGs in '${shotsDir}' — nothing to publish`);

const repo = gh("repo", "view", "--json", "nameWithOwner,defaultBranchRef,visibility");
if (!repo.ok) done(false, `gh could not read the repository: ${repo.err}`);

let nameWithOwner = "";
let defaultBranch = "main";
let isPublic = false;
try {
  const j = JSON.parse(repo.out);
  nameWithOwner = j.nameWithOwner;
  defaultBranch = j.defaultBranchRef?.name ?? "main";
  isPublic = j.visibility === "PUBLIC";
} catch (error) {
  done(false, `could not parse gh repo view: ${error}`);
}

if (!isPublic) {
  done(
    false,
    "this repository is not public, and a raw.githubusercontent URL does not render in a PR " +
      "body on a private repo — see the hosting section of docs/specs/pr-screenshots.md",
  );
}

const [owner, repoName] = nameWithOwner.split("/");
const branch = `evidence/pr-${pr}`;

// ---------------------------------------------------------------- the evidence branch

const head = gh("api", `repos/${owner}/${repoName}/git/ref/heads/${branch}`);
if (!head.ok) {
  const baseRef = gh("api", `repos/${owner}/${repoName}/git/ref/heads/${defaultBranch}`);
  if (!baseRef.ok) done(false, `could not read ${defaultBranch}: ${baseRef.err}`);

  let baseSha = "";
  try {
    baseSha = JSON.parse(baseRef.out).object.sha;
  } catch (error) {
    done(false, `could not parse ${defaultBranch}'s ref: ${error}`);
  }

  const made = gh(
    "api",
    "--method",
    "POST",
    `repos/${owner}/${repoName}/git/refs`,
    "-f",
    `ref=refs/heads/${branch}`,
    "-f",
    `sha=${baseSha}`,
  );
  // A read-only token fails here, which is the fork case and is not an error.
  if (!made.ok) {
    done(
      false,
      `could not create ${branch} — a read-only token (a fork PR) cannot: ${made.err}`,
    );
  }
  console.log(`created ${branch}`);
}

// ---------------------------------------------------------------- upload

const images = [];
for (const file of files) {
  const name = basename(file);
  // The head SHA is in the path, so a re-run of the same commit overwrites its own files and a
  // new commit never collides with an older set.
  const path = `pr/${pr}/${sha}/${name}`;

  // An existing blob has to be named by its sha to be replaced, so look first.
  const existing = gh(
    "api",
    `repos/${owner}/${repoName}/contents/${path}?ref=${branch}`,
    "--jq",
    ".sha",
  );

  // Base64 through a temp file: a PNG is far longer than the command line Windows allows.
  const payload = join(tmpdir(), `evidence-${Date.now()}-${name}.json`);
  writeFileSync(
    payload,
    JSON.stringify({
      message: `chore(evidence): pr-${pr} ${name} @ ${sha.slice(0, 7)}`,
      content: readFileSync(file).toString("base64"),
      branch,
      ...(existing.ok && existing.out ? { sha: existing.out } : {}),
    }),
  );
  const put = gh(
    "api",
    "--method",
    "PUT",
    `repos/${owner}/${repoName}/contents/${path}`,
    "--input",
    payload,
  );
  rmSync(payload, { force: true });

  if (!put.ok) done(false, `could not upload ${name}: ${put.err}`);

  let commitSha = "";
  try {
    commitSha = JSON.parse(put.out).commit.sha;
  } catch (error) {
    done(false, `could not read the commit for ${name}: ${error}`);
  }

  // Pinned to the commit rather than the branch, so the URL keeps working even if the branch
  // moves on — and so a reviewer sees the images for the commit they are reviewing.
  images.push({
    name,
    url: `https://raw.githubusercontent.com/${owner}/${repoName}/${commitSha}/${path}`,
  });
  console.log(`uploaded ${name}`);
}

// ---------------------------------------------------------------- rewrite the body

const view = gh("pr", "view", pr, "--json", "body");
let body = "";
if (view.ok) {
  try {
    body = JSON.parse(view.out).body ?? "";
  } catch {
    body = "";
  }
}

const gaps = ORDER.filter((n) => !images.some((i) => i.name === n)).map((n) => ({
  surface: n.replace(/\.png$/, "").replace(/-/g, " · "),
  why: "its capture job did not produce an image for this commit",
}));

const bodyFile = join(tmpdir(), `pr-${pr}-body-${Date.now()}.md`);
writeFileSync(bodyFile, spliceBlock(body, composeBlock({ sha, images, gaps, runUrl })));
const edited = gh("pr", "edit", pr, "--body-file", bodyFile);
rmSync(bodyFile, { force: true });

if (!edited.ok) done(false, `could not edit the PR body: ${edited.err}`);

console.log(`rewrote the body of PR #${pr} with ${images.length} image(s)`);
done(true);
