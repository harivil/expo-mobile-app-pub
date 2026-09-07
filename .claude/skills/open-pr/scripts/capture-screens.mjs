#!/usr/bin/env node
// Screenshot the running app on whatever surfaces this machine can reach.
//
//   node capture-screens.mjs <before|after> <slug> [--surfaces ios,android,web] [--url <web url>]
//
// Writes .evidence/<slug>/<phase>/<surface>.png and updates .evidence/<slug>/manifest.json.
//
// This is the portable fallback. When the repository already has its own capture script at
// .claude/scripts/capture.mjs — which also records video — this delegates to it rather than
// keeping a second, quietly different definition of what a capture is.
//
// A surface this machine cannot reach is recorded as a typed gap, never as a failure. There is
// no iOS simulator on Windows, and a script that exits 1 over that fact teaches people to stop
// running it.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [, , phase, slug, ...rest] = process.argv;

if (!["before", "after"].includes(phase) || !slug) {
  console.error(
    "usage: node capture-screens.mjs <before|after> <slug> [--surfaces ios,android,web] [--url <web url>]\n",
  );
  process.exit(1);
}

const val = (name, fallback) => {
  const i = rest.indexOf(name);
  return i !== -1 && rest[i + 1] ? rest[i + 1] : fallback;
};

const surfaces = val("--surfaces", "ios,android,web")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// ---------------------------------------------------------------- delegate if we can

const HOST_SCRIPT = join(".claude", "scripts", "capture.mjs");

if (existsSync(HOST_SCRIPT)) {
  console.log(`Delegating to ${HOST_SCRIPT} — this repo has its own capture script.`);
  const r = spawnSync(
    process.execPath,
    [HOST_SCRIPT, phase, slug, "--surfaces", surfaces.join(",")],
    { stdio: "inherit", windowsHide: true },
  );
  process.exit(r.status ?? 0);
}

// ---------------------------------------------------------------- otherwise, do it here

function run(cmd, args, { buffer = false, timeout = 120000 } = {}) {
  try {
    const r = spawnSync(cmd, args, {
      encoding: buffer ? "buffer" : "utf8",
      timeout,
      windowsHide: true,
      shell: process.platform === "win32",
    });
    return {
      ok: r.status === 0 && !r.error,
      stdout: r.stdout,
      stderr: String(r.stderr ?? ""),
    };
  } catch (e) {
    return { ok: false, stdout: buffer ? Buffer.alloc(0) : "", stderr: String(e) };
  }
}

const outDir = join(".evidence", slug, phase);
mkdirSync(outDir, { recursive: true });

const results = [];
const record = (surface, status, detail) =>
  results.push({ surface, kind: "screenshot", status, detail });

function android() {
  const file = join(outDir, "android.png");
  const r = run("adb", ["exec-out", "screencap", "-p"], { buffer: true });
  if (!r.ok || !r.stdout || r.stdout.length < 100) {
    return record("android", "unavailable", "no booted emulator or device (adb)");
  }
  writeFileSync(file, r.stdout);
  record("android", "captured", file);
}

function ios() {
  if (process.platform !== "darwin") {
    return record(
      "ios",
      "impossible-here",
      "the iOS simulator only exists on macOS — a Mac teammate or a macOS CI runner covers this",
    );
  }
  const file = join(outDir, "ios.png");
  const r = run("xcrun", ["simctl", "io", "booted", "screenshot", file]);
  if (!r.ok || !existsSync(file)) {
    return record("ios", "unavailable", "no booted simulator (xcrun simctl)");
  }
  record("ios", "captured", file);
}

function web() {
  const file = join(outDir, "web.png");
  const url = val("--url", process.env.WEB_URL ?? "http://localhost:8081");
  const r = run(
    "npx",
    ["--no-install", "playwright", "screenshot", "--wait-for-timeout=3000", url, file],
    { timeout: 90000 },
  );
  if (!r.ok || !existsSync(file)) {
    return record(
      "web",
      "unavailable",
      `could not shoot ${url} — is the web build running, and is playwright installed?`,
    );
  }
  record("web", "captured", file);
}

console.log(`Capturing ${phase} for '${slug}' — surfaces: ${surfaces.join(", ")}`);

for (const s of surfaces) {
  if (s === "android") android();
  else if (s === "ios") ios();
  else if (s === "web") web();
  else record(s, "unknown-surface", "not one of ios, android, web");
}

// ---------------------------------------------------------------- manifest

const manifestPath = join(".evidence", slug, "manifest.json");
let manifest = { slug, phases: {} };
if (existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    /* start fresh rather than lose the capture */
  }
}
manifest.phases[phase] = {
  at: new Date().toISOString(),
  platform: process.platform,
  results,
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

for (const r of results) console.log(`  ${r.status.padEnd(16)} ${r.surface}: ${r.detail}`);

const gaps = results.filter((r) => r.status !== "captured");
console.log(
  `\n${results.length - gaps.length} captured into ${outDir}, ${gaps.length} gap(s), manifest at ${manifestPath}`,
);

// Gaps are information, not failure. open-pr.mjs names them in the PR body.
process.exit(0);
