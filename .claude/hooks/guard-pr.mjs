#!/usr/bin/env node
// PreToolUse hook for Bash. Holds the last gate of the delivery loop: a pull request opens
// for review only once the checks CI will run have been run here and passed.
//
// Exit 0 = allow. Exit 2 = block, with the reason on stderr for the agent to read.
// Any internal error exits 0: a broken guard must never wedge a session.
//
// What it reads is the receipt .claude/scripts/ci-local.mjs writes. Three things make a
// receipt stale, and all three matter:
//
//   missing        the gate was never run
//   not green      it was run and something failed
//   different tree it was run against different code — the commit moved, or the working
//                  tree changed after the run, which is the case people actually hit
//
// A draft pull request is deliberately allowed. Sharing unfinished work is not the failure
// this guards against; asking for review on work that has not been checked is, so
// `gh pr ready` and `gh pr merge` are gated even though `gh pr create --draft` is not.
//
// Escape hatch: CLAUDE_SKIP_CI_PREFLIGHT=1. It exists for the case where the gate itself is
// what is broken. Using it routinely means the gate is wrong — fix the gate.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RECEIPT = process.env.CLAUDE_CI_RECEIPT || join(ROOT, ".claude", ".ci-local.json");
const RUN = "node .claude/scripts/ci-local.mjs";

// Match only where a command actually starts — the beginning of the line or just after a
// shell separator — so the guard does not fire on the string inside a quoted argument.
const segments = (c) =>
  c
    .split(/(?:&&|\|\||[;|\n])/)
    .map((s) => s.trim())
    .filter(Boolean);

/** The actions that put a change in front of a reviewer. */
function gatedAction(seg) {
  if (!/^(sudo\s+)?gh\s+pr\b/.test(seg)) return null;
  if (/\bpr\s+create\b/.test(seg))
    return /--draft\b|(\s|^)-d(\s|$)/.test(seg) ? null : "open a pull request";
  if (/\bpr\s+ready\b/.test(seg)) return "mark a pull request ready for review";
  if (/\bpr\s+merge\b/.test(seg)) return "merge a pull request";
  return null;
}

const git = (...args) => {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", windowsHide: true });
  return r.status === 0 ? r.stdout.trim() : null;
};

/** The same digest ci-local.mjs records: the commit plus the state of the working tree. */
function currentTree() {
  const sha = git("rev-parse", "HEAD");
  if (sha === null) return null; // not a repo — nothing to compare, so nothing to enforce
  return createHash("sha1")
    .update(sha + "\n" + (git("status", "--porcelain") ?? ""))
    .digest("hex");
}

function verdict() {
  if (!existsSync(RECEIPT)) {
    return "The checks CI runs have not been run here yet.";
  }

  let receipt;
  try {
    receipt = JSON.parse(readFileSync(RECEIPT, "utf8"));
  } catch {
    return "The last run's receipt is unreadable, so nothing here is proven.";
  }

  if (!receipt.green) {
    const which = (receipt.failed ?? []).join(", ") || "unknown";
    return "The last run failed: " + which + ". CI fails the same way.";
  }

  // A --fast or --only run is green about the checks it chose, which is not the same claim.
  if (receipt.full === false) {
    const how = (receipt.argv ?? []).join(" ");
    return (
      "The last run covered only part of the checks" + (how ? " (" + how + ")" : "") + "."
    );
  }

  const tree = currentTree();
  if (tree && receipt.tree && tree !== receipt.tree) {
    return (
      "The last green run was against different code (" +
      (receipt.sha ?? "unknown").slice(0, 7) +
      (receipt.dirty ? ", dirty tree" : "") +
      "), so it proves nothing about what is about to be reviewed."
    );
  }

  return null; // green, and against this code
}

function main(raw) {
  if (process.env.CLAUDE_SKIP_CI_PREFLIGHT) return 0;

  let command = "";
  try {
    command = JSON.parse(raw)?.tool_input?.command ?? "";
  } catch {
    return 0;
  }
  if (!command) return 0;

  let action = null;
  for (const seg of segments(command)) {
    action = gatedAction(seg);
    if (action) break;
  }
  if (!action) return 0;

  const why = verdict();
  if (!why) return 0;

  process.stderr.write(
    "Not ready to " +
      action +
      ".\n" +
      "  " +
      why +
      "\n" +
      "  Run the gate, fix what it reports, then try again:\n" +
      "    " +
      RUN +
      "\n" +
      "  Sharing work in progress instead:  gh pr create --draft\n",
  );
  return 2;
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let code = 0;
  try {
    code = main(input);
  } catch {
    code = 0; // fail open
  }
  process.exit(code);
});
