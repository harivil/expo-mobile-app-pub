#!/usr/bin/env node
// Host local screenshots somewhere a GitHub PR body can render them, and print the URLs.
//
//   node upload-images.mjs --pr <url|number> --files a.png b.png [--host auto|browser|branch]
//   node upload-images.mjs --login          sign in once so GitHub remembers this machine
//   node upload-images.mjs --check          report which hosting routes are usable here
//
// Why this file exists at all: GitHub has no public API for comment attachments. The REST API
// can create a pull request and edit its body, but the only way to get bytes onto
// github.com/user-attachments is the upload the web UI performs — which is why this drives a
// real browser for that route instead of calling an endpoint. See
// ../references/image-hosting.md for the whole picture, including what breaks when GitHub
// changes that page.
//
// Cross-platform by construction: Node and argument arrays only, no shell syntax and no
// per-OS scripts. Every route degrades into a named gap rather than a stack trace.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------- shelling out

/**
 * Run a command with no shell at all, so per-OS quoting never applies.
 *
 * `gh` ships as gh.exe on Windows rather than a .cmd shim, so spawn can exec it directly —
 * which matters, because a shell on Windows would not quote a temp path containing a space.
 * Never throws.
 */
export function run(cmd, args, { input, timeout = 120000 } = {}) {
  try {
    const r = spawnSync(cmd, args, {
      encoding: "utf8",
      input,
      timeout,
      windowsHide: true,
    });
    return {
      ok: r.status === 0 && !r.error,
      stdout: (r.stdout ?? "").trim(),
      stderr: (r.stderr ?? "").trim() || String(r.error ?? ""),
    };
  } catch (e) {
    return { ok: false, stdout: "", stderr: String(e) };
  }
}

const gh = (...args) => run("gh", args);

/** The owner/repo this checkout points at, plus whether outsiders can read it. */
export function repoInfo() {
  const r = gh("repo", "view", "--json", "nameWithOwner,visibility,defaultBranchRef");
  if (!r.ok) return null;
  try {
    const j = JSON.parse(r.stdout);
    return {
      nameWithOwner: j.nameWithOwner,
      isPublic: j.visibility === "PUBLIC",
      defaultBranch: j.defaultBranchRef?.name ?? "main",
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- file types

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};
const mimeOf = (f) => MIME[extname(f).toLowerCase()] ?? "application/octet-stream";

// ---------------------------------------------------------------- route A: the browser

// GitHub persists an attachment the moment it is uploaded, whether or not the comment is ever
// posted. So the sequence is: open the PR page, put the file through the comment box's own
// upload path, read the markdown GitHub writes back, then clear the box. Nothing is submitted.

const PROFILE_DIR =
  process.env.PR_UPLOAD_PROFILE ??
  join(homedir(), ".cache", "github-pr-uploads", "chromium-profile");

const ATTACHMENT_URL =
  /https:\/\/(?:github\.com\/user-attachments\/assets\/[\w-]+|(?:user-images|private-user-images)\.githubusercontent\.com\/[^\s)"']+)/g;

// Whichever of these the host project already has, in order of preference. The three imports
// are unrolled rather than looped because a dynamic import from a variable is a lint finding
// (no-unsanitized/method) — and a literal specifier is what a bundler can follow anyway.
async function loadChromium() {
  try {
    const m = await import("playwright");
    if (m.chromium) return m.chromium;
  } catch {
    /* not installed here */
  }
  try {
    const m = await import("@playwright/test");
    if (m.chromium) return m.chromium;
  } catch {
    /* not installed here */
  }
  try {
    const m = await import("playwright-core");
    if (m.chromium) return m.chromium;
  } catch {
    /* not installed here */
  }
  throw new Error(
    "playwright is not installed here — run 'npm i -D @playwright/test' then " +
      "'npx playwright install chromium', or use --host branch",
  );
}

/** Is there a live GitHub session in the saved profile? */
async function loggedIn(page) {
  const who = await page
    .locator('meta[name="user-login"]')
    .getAttribute("content")
    .catch(() => null);
  return who || null;
}

/**
 * Open a headed browser and wait for the human to sign in.
 *
 * Credentials never pass through this script: it opens github.com/login and polls for the
 * session to appear. That boundary is deliberate — an agent must not handle a password.
 */
export async function login({ timeoutMs = 300000 } = {}) {
  const chromium = await loadChromium();
  mkdirSync(PROFILE_DIR, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: false });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto("https://github.com/login", { waitUntil: "domcontentloaded" });
  console.log(
    "A browser window is open. Sign in to GitHub there, including any 2FA step.\n" +
      "Nothing you type reaches this script — it only waits for the session to appear.\n" +
      `The session is then saved under ${PROFILE_DIR} and reused from now on.`,
  );
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const who = await loggedIn(page);
    if (who) {
      console.log(`\nSigned in as ${who}.`);
      await ctx.close();
      return true;
    }
    await page.waitForTimeout(2000);
  }
  await ctx.close();
  console.error("Timed out waiting for a sign-in.");
  return false;
}

/** Find the comment box on a PR page. Ordered most- to least-specific. */
async function commentBox(page) {
  const candidates = [
    'textarea[name="comment[body]"]',
    "textarea#new_comment_field",
    'textarea[aria-label*="comment" i]',
    'form textarea[class*="comment" i]',
    "form textarea",
  ];
  for (const sel of candidates) {
    const box = page.locator(sel).last();
    if ((await box.count()) > 0 && (await box.isVisible().catch(() => false))) return box;
  }
  return null;
}

/** Push one file through the page's own upload path and return the URL GitHub hands back. */
async function uploadOne(page, box, file) {
  const before = (await box.inputValue()) ?? "";

  const input = page.locator("form input[type=file]").last();
  if ((await input.count()) > 0) {
    await input.setInputFiles(file);
  } else {
    // No reachable file input — synthesise the drop event the dropzone listens for instead.
    const b64 = readFileSync(file).toString("base64");
    await box.evaluate(
      (el, { name, type, data }) => {
        const bin = atob(data);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
        const dt = new DataTransfer();
        dt.items.add(new File([arr], name, { type }));
        el.dispatchEvent(
          new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }),
        );
      },
      { name: basename(file), type: mimeOf(file), data: b64 },
    );
  }

  // GitHub writes the markdown into the textarea once the upload lands.
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const now = (await box.inputValue()) ?? "";
    if (now.length > before.length) {
      const added = now.slice(before.length);
      const found = [...added.matchAll(ATTACHMENT_URL)].map((m) => m[0]);
      if (found.length) return found[found.length - 1];
      if (/failed|too big|not supported/i.test(added)) {
        throw new Error(`GitHub rejected ${basename(file)}: ${added.trim()}`);
      }
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(`timed out waiting for GitHub to accept ${basename(file)}`);
}

export async function uploadViaBrowser({ prUrl, files, headless = true }) {
  const chromium = await loadChromium();
  if (!existsSync(PROFILE_DIR)) {
    throw new Error("no saved GitHub session — run this script with --login once");
  }
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    viewport: { width: 1280, height: 1000 },
  });
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(prUrl, { waitUntil: "domcontentloaded" });
    if (!(await loggedIn(page))) {
      throw new Error("the saved GitHub session has expired — run with --login again");
    }
    const box = await commentBox(page);
    if (!box) {
      const shot = join(tmpdir(), "pr-upload-page.png");
      await page.screenshot({ path: shot }).catch(() => {});
      throw new Error(
        `could not find the comment box on ${prUrl} — GitHub's markup has probably changed. ` +
          `What the script saw is at ${shot}; the selector list lives in commentBox().`,
      );
    }
    const hosted = {};
    for (const file of files) {
      hosted[file] = await uploadOne(page, box, file);
      console.log(`  uploaded ${basename(file)}`);
    }
    // Leave no draft behind. Nothing here ever submits a comment.
    await box.fill("");
    return hosted;
  } finally {
    await ctx.close();
  }
}

// ---------------------------------------------------------------- route B: an evidence branch

// No browser needed, but it writes the bytes into the repository's object store, where they
// stay forever, and a raw.githubusercontent URL does not render in a PR body on a private
// repo. Hence opt-in, and a refusal on a private repo unless forced.

export function uploadViaBranch({ files, slug, force = false }) {
  const info = repoInfo();
  if (!info)
    throw new Error("gh could not read this repository — is 'gh auth login' done?");
  if (!info.isPublic && !force) {
    throw new Error(
      "this repository is private, and a raw.githubusercontent URL does not render in a PR " +
        "body on a private repo — use the browser route, or pass --force to host anyway",
    );
  }
  const [owner, repo] = info.nameWithOwner.split("/");
  const baseRef = gh("api", `repos/${owner}/${repo}/git/ref/heads/${info.defaultBranch}`);
  if (!baseRef.ok)
    throw new Error(`could not read ${info.defaultBranch}: ${baseRef.stderr}`);
  const baseSha = JSON.parse(baseRef.stdout).object.sha;

  const branch = `evidence/${slug}-${Date.now().toString(36)}`;
  const made = gh(
    "api",
    "--method",
    "POST",
    `repos/${owner}/${repo}/git/refs`,
    "-f",
    `ref=refs/heads/${branch}`,
    "-f",
    `sha=${baseSha}`,
  );
  if (!made.ok) throw new Error(`could not create ${branch}: ${made.stderr}`);

  const hosted = {};
  for (const file of files) {
    const path = `.evidence/${slug}/${basename(file)}`;
    // The payload goes through a temp JSON file: a base64 screenshot is far longer than the
    // command line Windows allows.
    const body = join(tmpdir(), `pr-upload-${Date.now()}.json`);
    writeFileSync(
      body,
      JSON.stringify({
        message: `chore(evidence): ${slug} ${basename(file)}`,
        content: readFileSync(file).toString("base64"),
        branch,
      }),
    );
    const put = gh(
      "api",
      "--method",
      "PUT",
      `repos/${owner}/${repo}/contents/${path}`,
      "--input",
      body,
    );
    rmSync(body, { force: true });
    if (!put.ok) throw new Error(`could not upload ${basename(file)}: ${put.stderr}`);
    const sha = JSON.parse(put.stdout).commit.sha;
    hosted[file] = `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${path}`;
    console.log(`  uploaded ${basename(file)}`);
  }
  console.log(
    `\nHosted on branch ${branch}. It is never merged, and deleting it breaks these URLs.`,
  );
  return hosted;
}

// ---------------------------------------------------------------- what works here

export function routes() {
  return {
    gh: gh("--version").ok,
    ghAuth: gh("auth", "status").ok,
    session: existsSync(PROFILE_DIR),
    profileDir: PROFILE_DIR,
    repo: repoInfo(),
  };
}

/** Try the browser, then fall back to naming the gap. `branch` is only ever explicit. */
export async function host({ prUrl, files, slug, mode = "auto", force = false }) {
  if (!files.length) return { hosted: {}, route: "none", reason: "no files to host" };

  if (mode === "branch") {
    return { hosted: uploadViaBranch({ files, slug, force }), route: "branch" };
  }
  if (mode === "manual") {
    return { hosted: {}, route: "manual", reason: "manual hosting was asked for" };
  }
  try {
    return { hosted: await uploadViaBrowser({ prUrl, files }), route: "browser" };
  } catch (e) {
    if (mode === "browser") throw e;
    return { hosted: {}, route: "manual", reason: String(e.message ?? e) };
  }
}

// ---------------------------------------------------------------- cli

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const flag = (n) => argv.includes(n);
  const val = (n, d) => {
    const i = argv.indexOf(n);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : d;
  };
  const list = (n) => {
    const i = argv.indexOf(n);
    if (i === -1) return [];
    const out = [];
    for (let j = i + 1; j < argv.length && !argv[j].startsWith("--"); j += 1)
      out.push(argv[j]);
    return out;
  };

  if (flag("--login")) {
    process.exit((await login()) ? 0 : 1);
  } else if (flag("--check")) {
    const r = routes();
    console.log(JSON.stringify(r, null, 2));
    console.log(
      r.session
        ? "\nBrowser route: ready."
        : "\nBrowser route: no saved session — run this with --login once.",
    );
  } else {
    const pr = val("--pr");
    const files = list("--files").filter((f) => existsSync(f));
    if (!pr || !files.length) {
      console.error(
        "usage: node upload-images.mjs --pr <url|number> --files a.png b.png [--host auto|browser|branch] [--force]\n" +
          "       node upload-images.mjs --login\n" +
          "       node upload-images.mjs --check\n",
      );
      process.exit(1);
    }
    const prUrl = /^https?:/.test(pr)
      ? pr
      : `https://github.com/${repoInfo()?.nameWithOwner}/pull/${pr}`;
    const { hosted, route, reason } = await host({
      prUrl,
      files,
      slug: val("--slug", "evidence"),
      mode: val("--host", "auto"),
      force: flag("--force"),
    });
    if (route === "manual") {
      console.error(`Nothing was hosted (${reason}). Drag the files into the PR by hand.`);
      process.exit(1);
    }
    for (const [file, url] of Object.entries(hosted))
      console.log(`${basename(file)}\t${url}`);
  }
}
