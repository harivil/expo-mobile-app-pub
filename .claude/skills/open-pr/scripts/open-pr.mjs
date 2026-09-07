#!/usr/bin/env node
// Push the current branch and open a pull request whose body renders the app's screenshots.
//
//   node open-pr.mjs <slug> [--title "..."] [--base main] [--surfaces ios,android,web]
//                           [--capture] [--images <dir>] [--host auto|browser|branch|manual]
//                           [--draft] [--allow-dirty] [--dry-run]
//
// The order matters and is the whole point:
//
//   preflight → push branch → create the PR → upload the images → rewrite the body
//
// The images can only be uploaded once a PR page exists to upload them through, and the body
// can only reference them once they have URLs. See ../references/image-hosting.md.
//
// Nothing here can touch the default branch: it pushes the branch you are standing on, and
// refuses outright when that is the base.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { host as hostImages, routes } from "./upload-images.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- arguments

const [, , slugArg, ...rest] = process.argv;

const flag = (n) => rest.includes(n);
const val = (n, d) => {
  const i = rest.indexOf(n);
  return i !== -1 && rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[i + 1] : d;
};

if (!slugArg || slugArg.startsWith("--")) {
  console.error(
    'usage: node open-pr.mjs <slug> [--title "..."] [--base main] [--surfaces ios,android,web]\n' +
      "                              [--capture] [--images <dir>] [--host auto|browser|branch|manual]\n" +
      "                              [--draft] [--allow-dirty] [--dry-run]\n" +
      "\n" +
      "  <slug>       the change's kebab-case slug — names the evidence folder and the artifacts\n" +
      "  --capture    screenshot the running app now, as the 'after' phase\n" +
      "  --images     take the files from this folder instead of .evidence/<slug>/\n" +
      "  --what       the 'What changed' paragraph; without it the template's prompt is left for you\n" +
      "  --host       where the images are hosted; 'branch' commits them, so it is never automatic\n" +
      "  --force      with --host branch, host on a private repo anyway (the URLs will not render)\n" +
      "  --dry-run    print the body and change nothing on the remote\n",
  );
  process.exit(1);
}

const slug = slugArg;
const base = val("--base", "");
const surfaces = val("--surfaces", "ios,android,web")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const dryRun = flag("--dry-run");

// ---------------------------------------------------------------- shelling out

function run(cmd, args, { timeout = 180000 } = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout, windowsHide: true });
  return {
    ok: r.status === 0 && !r.error,
    stdout: (r.stdout ?? "").trim(),
    stderr: (r.stderr ?? "").trim() || String(r.error ?? ""),
  };
}
const git = (...a) => run("git", a);
const gh = (...a) => run("gh", a);

const say = (s = "") => console.log(s);
const fail = (lines) => {
  console.error("\nCannot open the PR yet:\n");
  for (const l of lines) console.error(`  - ${l}`);
  console.error("");
  process.exit(1);
};

// ---------------------------------------------------------------- preflight

const inRepo = git("rev-parse", "--is-inside-work-tree");
if (!inRepo.ok) fail(["this is not a git repository"]);

const branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout;
const info = routes();
const baseBranch = base || info.repo?.defaultBranch || "main";

const problems = [];
if (!info.gh) problems.push("the GitHub CLI is not installed — see cli.github.com");
else if (!info.ghAuth) problems.push("gh is not signed in — run 'gh auth login'");
if (branch === baseBranch)
  problems.push(
    `you are on ${branch}, which is the base — a PR needs its own branch: ` +
      `git switch -c ${slug}`,
  );
if (!flag("--allow-dirty")) {
  const dirty = git("status", "--porcelain").stdout;
  if (dirty)
    problems.push(
      "there is uncommitted work — commit it, or pass --allow-dirty to open the PR without it:\n" +
        dirty
          .split(/\r?\n/)
          .slice(0, 10)
          .map((l) => `      ${l}`)
          .join("\n"),
    );
}
if (problems.length && !dryRun) fail(problems);
if (problems.length) for (const p of problems) say(`  (dry run, ignoring) ${p}`);

// ---------------------------------------------------------------- capture

if (flag("--capture")) {
  say("\nCapturing the app as it is now");
  spawnSync(
    process.execPath,
    [join(HERE, "capture-screens.mjs"), "after", slug, "--surfaces", surfaces.join(",")],
    { stdio: "inherit", windowsHide: true },
  );
}

// ---------------------------------------------------------------- gather the evidence

const MEDIA = /\.(png|jpe?g|gif|webp|mp4|mov|webm)$/i;
const surfaceOf = (file) => {
  const n = basename(file).toLowerCase();
  return surfaces.find((s) => n.includes(s)) ?? "other";
};
// One spelling of a path, everywhere. A manifest written on macOS records a/b/c and a Windows
// directory scan produces a\b\c, and comparing the two raw is how the same screenshot ends up
// in the PR twice.
const norm = (p) => p.replace(/\\/g, "/");

/** Everything worth showing, plus every surface that could not be shown and why. */
function gather() {
  const shots = [];
  const gaps = [];
  const imagesDir = val("--images");

  if (imagesDir) {
    if (!existsSync(imagesDir)) fail([`--images ${imagesDir} does not exist`]);
    for (const f of readdirSync(imagesDir).filter((f) => MEDIA.test(f))) {
      shots.push({ phase: "after", surface: surfaceOf(f), file: norm(join(imagesDir, f)) });
    }
    return { shots, gaps };
  }

  const manifestPath = join(".evidence", slug, "manifest.json");
  if (existsSync(manifestPath)) {
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      manifest = null;
    }
    for (const [phase, entry] of Object.entries(manifest?.phases ?? {})) {
      for (const r of entry.results ?? []) {
        if (r.status === "captured" && existsSync(r.detail)) {
          shots.push({ phase, surface: r.surface, file: norm(r.detail) });
        } else if (r.status !== "captured") {
          gaps.push({ phase, surface: r.surface, status: r.status, detail: r.detail });
        }
      }
    }
  }

  // A file on disk that the manifest never mentioned still belongs in the PR.
  for (const phase of ["before", "after"]) {
    const dir = join(".evidence", slug, phase);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => MEDIA.test(f))) {
      const file = norm(join(dir, f));
      if (!shots.some((s) => s.file === file)) {
        shots.push({ phase, surface: surfaceOf(f), file });
      }
    }
  }
  return { shots, gaps };
}

const { shots, gaps } = gather();

say(`\nEvidence for '${slug}': ${shots.length} file(s), ${gaps.length} gap(s)`);
for (const s of shots) say(`  ${s.phase.padEnd(6)} ${s.surface.padEnd(8)} ${s.file}`);
for (const g of gaps)
  say(`  ${g.phase.padEnd(6)} ${g.surface.padEnd(8)} ${g.status}: ${g.detail}`);

// ---------------------------------------------------------------- the body

const GAP_WORDING = {
  "impossible-here": "not possible on this machine",
  unavailable: "not running when captured",
  manual: "captured by hand",
  "unknown-surface": "unknown surface",
};

/** One table cell: a rendered image, an inline video, or an honest blank. */
function cell(shot, hosted) {
  if (!shot) return "—";
  const url = hosted[shot.file];
  if (!url) return `\`${shot.file.replace(/\\/g, "/")}\``;
  if (/\.(mp4|mov|webm)$/i.test(shot.file)) return url; // GitHub renders these inline
  return `<img src="${url}" width="320" alt="${shot.surface} ${shot.phase}">`;
}

function evidenceTable(hosted) {
  const rows = ["| Surface | Before | After |", "| ------- | ------ | ----- |"];
  const label = { ios: "iOS", android: "Android", web: "Web" };
  const seen = new Set([...shots, ...gaps].map((s) => s.surface));
  for (const surface of [...surfaces, ...[...seen].filter((s) => !surfaces.includes(s))]) {
    const before = shots.find((s) => s.surface === surface && s.phase === "before");
    const after = shots.find((s) => s.surface === surface && s.phase === "after");
    if (!before && !after && !seen.has(surface)) continue;
    const gap = gaps.find((g) => g.surface === surface);
    const blank = gap ? `_${GAP_WORDING[gap.status] ?? gap.status}_` : "—";
    rows.push(
      `| ${label[surface] ?? surface} | ${before ? cell(before, hosted) : blank} | ${
        after ? cell(after, hosted) : blank
      } |`,
    );
  }
  return rows.join("\n");
}

function gapNotes() {
  if (!gaps.length) return "";
  // The same missing surface usually shows up in both phases; a reviewer needs to read it once.
  const seen = new Set();
  const lines = [];
  for (const g of gaps) {
    const key = `${g.surface}|${g.status}|${g.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`- **${g.surface}** — ${GAP_WORDING[g.status] ?? g.status}: ${g.detail}`);
  }
  return (
    "\n**Unverified surfaces** — each one needs a named owner before merge:\n\n" +
    lines.join("\n") +
    "\n"
  );
}

/** `## What changed` and friends — heading match without building a regex from a string. */
const isHeading = (line, text) =>
  /^#{1,3}\s/.test(line) &&
  line
    .trim()
    .replace(/^#+\s*/, "")
    .toLowerCase() === text.toLowerCase();

/** Replace the paragraph under a heading, leaving the rest of the template untouched. */
function fillSection(lines, heading, text) {
  const at = lines.findIndex((l) => isHeading(l, heading));
  if (at === -1) return lines;
  let start = at + 1;
  while (start < lines.length && !lines[start].trim()) start += 1;
  let end = start;
  while (end < lines.length && lines[end].trim() && !/^#{1,3}\s/.test(lines[end])) end += 1;
  return [...lines.slice(0, start), text, ...lines.slice(end)];
}

function commitList() {
  const log = git("log", "--no-merges", "--pretty=- %s", `${baseBranch}..HEAD`);
  return log.ok && log.stdout
    ? log.stdout
    : "- (no commits found against " + baseBranch + ")";
}

/**
 * Prefer the repository's own PR template and fill its evidence table in place; a team's
 * checklist is not ours to replace. Without one, write a minimal body of our own.
 */
function composeBody(hosted, title) {
  const templatePath = join(".github", "PULL_REQUEST_TEMPLATE.md");
  const table = evidenceTable(hosted) + "\n" + gapNotes();

  if (existsSync(templatePath)) {
    let body = readFileSync(templatePath, "utf8").split(/\r?\n/);
    const start = body.findIndex((l) => /^\|\s*Surface\s*\|/i.test(l));
    if (start !== -1) {
      let end = start;
      while (end < body.length && body[end].trim().startsWith("|")) end += 1;
      body = [...body.slice(0, start), table, ...body.slice(end)];
    } else {
      body = [...body, "", "## Evidence", "", table];
    }
    const what = val("--what");
    if (what) body = fillSection(body, "What changed", what);
    return body
      .join("\n")
      .replace(/^#\s*<slug>.*$/m, `# ${title}`)
      .replace(/<slug>/g, slug);
  }

  return [
    `# ${title}`,
    "",
    "## What changed",
    "",
    val("--what") ?? commitList(),
    "",
    "## Evidence",
    "",
    table,
    "## Verified",
    "",
    "- [ ] Checks green, output read",
    "- [ ] Run on a device or simulator, not only in tests",
    "- [ ] Light **and** dark",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------- push, open, upload, rewrite

const lastSubject = git("log", "-1", "--pretty=%s").stdout;
const title = val("--title", lastSubject || slug);

if (dryRun) {
  say("\n--- body (dry run; nothing was pushed, created or uploaded) ---\n");
  say(composeBody({}, title));
  say("\n--- end ---");
  say(
    `\nRoutes here: gh ${info.gh ? "yes" : "no"}, signed in ${info.ghAuth ? "yes" : "no"}, ` +
      `saved browser session ${info.session ? "yes" : "no"}`,
  );
  process.exit(0);
}

say(`\nPushing ${branch}`);
const pushed = git("push", "--set-upstream", "origin", branch);
if (!pushed.ok) fail([`git push failed: ${pushed.stderr}`]);
say(pushed.stderr || "  pushed");

const tmp = join(tmpdir(), `open-pr-${slug}-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
const bodyFile = join(tmp, "body.md");

// An existing PR for this branch is updated rather than duplicated.
const existing = gh("pr", "view", branch, "--json", "number,url");
let prUrl;
if (existing.ok) {
  prUrl = JSON.parse(existing.stdout).url;
  say(`\nPR already open: ${prUrl}`);
} else {
  writeFileSync(bodyFile, composeBody({}, title));
  const args = [
    "pr",
    "create",
    "--base",
    baseBranch,
    "--head",
    branch,
    "--title",
    title,
    "--body-file",
    bodyFile,
  ];
  if (flag("--draft")) args.push("--draft");
  const created = gh(...args);
  if (!created.ok) {
    rmSync(tmp, { recursive: true, force: true });
    fail([`gh pr create failed: ${created.stderr}`]);
  }
  prUrl = created.stdout.split(/\s+/).find((s) => s.startsWith("http")) ?? created.stdout;
  say(`\nOpened ${prUrl}`);
}

let hosted = {};
let route = "none";
let reason = "";
if (shots.length) {
  say("\nHosting the evidence so the PR body can render it");
  const r = await hostImages({
    prUrl,
    files: shots.map((s) => s.file),
    slug,
    mode: val("--host", "auto"),
    force: flag("--force"),
  });
  hosted = r.hosted;
  route = r.route;
  reason = r.reason ?? "";
}

writeFileSync(bodyFile, composeBody(hosted, title));
const edited = gh("pr", "edit", prUrl, "--body-file", bodyFile);
rmSync(tmp, { recursive: true, force: true });
if (!edited.ok) fail([`gh pr edit failed: ${edited.stderr}`]);

// ---------------------------------------------------------------- report

say("\n" + "-".repeat(70));
say(`PR         ${prUrl}`);
say(`Images     ${Object.keys(hosted).length} of ${shots.length} hosted via ${route}`);
if (route === "manual" && shots.length) {
  say(
    `\nThe upload route was not usable (${reason}).\n` +
      "The body lists the local paths instead — open the PR and drag these files into it:",
  );
  for (const s of shots) say(`  ${s.file}`);
  say("\nTo fix the route for next time: node upload-images.mjs --login");
}
if (gaps.length) {
  say(
    `\n${gaps.length} surface(s) went unverified and are named in the body. Give each one an\n` +
      "owner in the PR thread — a written gap gets picked up, an implied one ships broken.",
  );
}
if (!val("--what")) {
  say(
    "\nThe body still carries the template's own prompts. Fill them in before asking for a\n" +
      "review — a PR describing itself as 'One paragraph.' has not been written yet.",
  );
}
say("-".repeat(70));
