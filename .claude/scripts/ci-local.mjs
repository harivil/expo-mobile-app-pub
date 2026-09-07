#!/usr/bin/env node
// Runs, on this machine, the checks that GitHub Actions runs on a pull request.
//
//   node .claude/scripts/ci-local.mjs                 every check
//   node .claude/scripts/ci-local.mjs --fast          skip the slow ones (semgrep, playwright)
//   node .claude/scripts/ci-local.mjs --only=types,test
//   node .claude/scripts/ci-local.mjs --install       run `npm ci` first, like CI does
//   node .claude/scripts/ci-local.mjs --list          what would run, and why
//
// A red check on a pull request costs a push, a wait, and a context switch — and the loop is
// worse than the failure, because a PR that has been red four times stops being read. Every
// check here is the same command the workflow runs, so a green run locally means the same
// thing it means in CI. Where a check cannot run locally at all, it says so by name rather
// than passing quietly: a gate that reports success for work it never did is the one failure
// mode that makes this script worse than nothing.
//
// Each check carries the job it belongs to, so a red check on github.com maps to one id here.
//
// Exit 0 = no blocking check failed. Exit 1 = at least one did.
//
// A run writes .claude/.ci-local.json — the receipt guard-pr.mjs reads before letting a pull
// request open. Nothing else consumes it, and it is gitignored.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RECEIPT = process.env.CLAUDE_CI_RECEIPT || join(ROOT, ".claude", ".ci-local.json");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes("--" + name);
const value = (name) => {
  const hit = argv.find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.slice(name.length + 3) : null;
};

const FAST = flag("fast");
const LIST = flag("list");
const INSTALL = flag("install");
const BASE = value("base") || "origin/main";
const ONLY = (value("only") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ---------------------------------------------------------------- environment

const git = (...args) => {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", windowsHide: true });
  return r.status === 0 ? r.stdout.trim() : null;
};

/**
 * npm and npx are .cmd shims on Windows, which Node refuses to exec directly. The usual
 * workaround — `shell: true` — concatenates the arguments into a command line instead of
 * passing them, which Node now warns about and which is how quoting bugs get in. Handing
 * cmd.exe an explicit argv does the same job without either problem, and leaves every other
 * command in this file shell-free.
 *
 * Only reached for npm and npx, whose arguments here are all literal constants.
 */
function launch(cmd) {
  const [bin, ...args] = cmd;
  if (process.platform === "win32" && /^(npm|npx)$/.test(bin)) {
    return [process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", cmd.join(" ")]];
  }
  return [bin, args];
}

/** Is this binary on PATH? Probed once — the answer decides skip messages, not just failures. */
const have = (() => {
  const cache = new Map();
  return (bin) => {
    if (!cache.has(bin)) {
      const [exe, args] = launch([bin, "--version"]);
      const r = spawnSync(exe, args, { cwd: ROOT, stdio: "ignore", windowsHide: true });
      cache.set(bin, r.status === 0);
    }
    return cache.get(bin);
  };
})();

const pkgPath = join(ROOT, "package.json");
const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, "utf8")) : null;
const script = (name) => Boolean(pkg?.scripts?.[name]);
const installed = (name) => existsSync(join(ROOT, "node_modules", ...name.split("/")));
const hasModules = existsSync(join(ROOT, "node_modules"));

// ---------------------------------------------------------------- the checks
//
// `plan()` returns { skip: why }, { fail: why }, or { cmd: [bin, ...args] }. Deciding this
// before anything runs is what makes --list honest: it prints the decision the run will make.

const CHECKS = [
  {
    id: "install",
    job: "verify",
    title: "npm ci",
    blocking: true,
    slow: true,
    plan: () => {
      if (!pkg) return { skip: "no package.json on this branch" };
      if (!INSTALL)
        return { skip: "pass --install to restore node_modules the way CI does" };
      return { cmd: ["npm", "ci"] };
    },
  },
  {
    id: "format",
    job: "verify",
    title: "npm run format:check",
    blocking: true,
    plan: () => {
      if (!pkg) return { skip: "no package.json on this branch" };
      // CI passes --if-present, so a missing script is a pass there. Say which it was.
      if (!script("format:check"))
        return { skip: "no format:check script — CI skips it too" };
      return { cmd: ["npm", "run", "format:check"] };
    },
  },
  {
    id: "types",
    job: "verify",
    title: "npx tsc --noEmit",
    blocking: true,
    plan: () => {
      if (!existsSync(join(ROOT, "tsconfig.json"))) return { skip: "no tsconfig.json" };
      if (!hasModules) return { skip: "node_modules missing — run with --install" };
      return { cmd: ["npx", "tsc", "--noEmit"] };
    },
  },
  {
    id: "lint",
    job: "verify",
    title: "npm run lint",
    blocking: true,
    plan: () => {
      if (!script("lint")) return { skip: "no lint script — CI skips it too" };
      if (!hasModules) return { skip: "node_modules missing — run with --install" };
      return { cmd: ["npm", "run", "lint"] };
    },
  },
  {
    id: "test",
    job: "verify",
    title: "npm test -- --coverage",
    blocking: true,
    slow: true,
    plan: () => {
      if (!script("test")) return { skip: "no test script — CI skips it too" };
      if (!hasModules) return { skip: "node_modules missing — run with --install" };
      return { cmd: ["npm", "test", "--", "--coverage"] };
    },
  },
  {
    id: "doctor",
    job: "verify + dependencies",
    title: "npx expo-doctor",
    blocking: true,
    slow: true,
    plan: () => {
      if (!pkg) return { skip: "no package.json on this branch" };
      return { cmd: ["npx", "expo-doctor"] };
    },
  },
  {
    id: "versions",
    job: "verify",
    title: "version numbers agree",
    blocking: true,
    plan: () => ({ cmd: ["node", ".claude/scripts/version-check.mjs"] }),
  },
  {
    id: "toolchain",
    job: "verify",
    title: "prettier, eslint, husky, commitlint wired to something that runs them",
    blocking: true,
    plan: () => ({ cmd: ["node", ".claude/scripts/toolchain-check.mjs"] }),
  },
  {
    id: "web-e2e",
    job: "web-e2e",
    title: "npx playwright test",
    blocking: true,
    slow: true,
    plan: () => {
      if (!existsSync(join(ROOT, "playwright.config.ts")))
        return { skip: "no playwright.config.ts" };
      if (!pkg) return { skip: "no package.json on this branch" };
      // The config is committed, so CI will run it. If the dependency it imports is not in
      // package.json, CI fails on "Cannot find module @playwright/test" — a real failure,
      // not a local gap. Report it as one rather than skipping.
      if (!installed("@playwright/test")) {
        return {
          fail:
            "playwright.config.ts is committed but @playwright/test is not installed.\n" +
            "      CI fails the same way. Add it: npm i -D @playwright/test",
        };
      }
      return { cmd: ["npx", "playwright", "test"] };
    },
  },
  {
    id: "hooks",
    job: "agent-config",
    title: "hook guards behave as specified",
    blocking: true,
    plan: () => ({ cmd: ["node", ".claude/hooks/hooks.test.mjs"] }),
  },
  {
    id: "skills",
    job: "agent-config",
    title: "skills well formed, nothing OS-specific",
    blocking: true,
    plan: () => ({ cmd: ["node", ".claude/check-skills.mjs"] }),
  },
  {
    id: "semgrep-rules",
    job: "semgrep",
    title: "custom semgrep rules behave as specified",
    blocking: true,
    plan: () => ({ cmd: ["node", ".claude/scripts/semgrep-test.mjs"] }),
  },
  {
    id: "semgrep",
    job: "semgrep",
    title: "semgrep scan (--error)",
    blocking: true,
    slow: true,
    plan: () => {
      const configs = [
        "--config",
        ".semgrep.yml",
        "--config",
        "p/typescript",
        "--config",
        "p/react",
        "--config",
        "p/secrets",
        "--config",
        "p/owasp-top-ten",
        // Deliberately vulnerable fixtures — semgrep-rules above asserts they all fire.
        // Scanning them here would report every one as a finding. Kept in step with the
        // same flag in security.yml.
        "--exclude",
        ".semgrep-tests",
        // The gate CI applies: ERROR blocks, WARNING is reported to the Security tab. Without
        // the filter, --error also fails on every mutable action tag, which Dependabot owns.
        "--severity",
        "ERROR",
      ];
      if (have("semgrep"))
        return { cmd: ["semgrep", "scan", ...configs, "--error", "--quiet"] };
      // The same image CI uses, so the rule versions match. Docker takes the mount as one
      // argv element, which is why this never goes through a shell.
      if (have("docker")) {
        return {
          cmd: [
            "docker",
            "run",
            "--rm",
            "-v",
            ROOT + ":/src",
            "-w",
            "/src",
            "semgrep/semgrep",
            "semgrep",
            "scan",
            ...configs,
            "--error",
            "--quiet",
          ],
        };
      }
      return {
        skip: "semgrep and docker both absent — the security-scan skill covers installing one",
      };
    },
  },
  {
    id: "secrets",
    job: "secrets",
    title: "gitleaks",
    blocking: true,
    plan: () => {
      // Not a hard failure when absent: CI scans history on every push, and a missing
      // scanner must never be the reason someone cannot get work reviewed.
      if (!have("gitleaks"))
        return { skip: "gitleaks not installed — CI scans history on every push" };
      return { cmd: ["gitleaks", "git", "--no-banner", "--redact"] };
    },
  },
  {
    id: "audit",
    job: "dependencies",
    title: "npm audit --audit-level=high",
    blocking: true,
    plan: () => {
      if (!pkg) return { skip: "no package.json on this branch" };
      if (!hasModules) return { skip: "node_modules missing — run with --install" };
      return { cmd: ["npm", "audit", "--audit-level=high"] };
    },
  },
  {
    // CI runs commitlint over the whole PR range. Locally the range is the same one the PR
    // will have — origin/main..HEAD — so a message rejected here is rejected there. Skipped
    // rather than failed when the base is not fetched: a stale clone is not a bad commit.
    id: "commits",
    job: "commits",
    title: "commit messages follow the convention",
    blocking: true,
    plan: () => {
      if (!installed("@commitlint/cli"))
        return { skip: "@commitlint/cli not installed — run with --install" };
      if (!git("rev-parse", "--verify", BASE))
        return { skip: BASE + " not fetched — git fetch origin" };
      return { cmd: ["npx", "commitlint", "--from", BASE, "--to", "HEAD"] };
    },
  },
  {
    id: "test-integrity",
    job: "test-integrity",
    title: "which tests did this change touch?",
    blocking: false, // reports, never fails — same as CI
    plan: () => {
      if (!git("rev-parse", "--verify", BASE))
        return { skip: BASE + " not fetched — git fetch origin" };
      return { cmd: ["node", ".claude/scripts/test-integrity.mjs", BASE] };
    },
  },
];

// What CI does that no local run can. Named explicitly, so a green run here is never
// mistaken for a green pull request.
const CI_ONLY = [
  [
    "Security / codeql",
    "no local runner; waits on the CODE_SCANNING repo variable until Code Security is on",
  ],
  [
    "SARIF upload",
    "needs a workflow token and code scanning enabled — nothing to reproduce here",
  ],
  [
    "workflow permissions",
    "a missing permissions: entry only fails against the real API — read the job log",
  ],
  ["Dependabot", "runs on a schedule against the default branch, not on a pull request"],
];

// ---------------------------------------------------------------- run

const pick = (c) => ({ id: c.id, job: c.job, title: c.title, blocking: c.blocking });

const selected = CHECKS.filter((c) => {
  if (ONLY.length) return ONLY.includes(c.id);
  if (FAST && c.slow) return false;
  return true;
});

if (LIST) {
  console.log("Checks for " + ROOT + "\n");
  for (const c of CHECKS) {
    const p = c.plan();
    const marked = selected.includes(c) ? " " : "-";
    const what = p.skip
      ? "skip: " + p.skip
      : p.fail
        ? "fails before running"
        : p.cmd.join(" ");
    console.log(marked + " " + c.id.padEnd(15) + c.job.padEnd(22) + what);
  }
  process.exit(0);
}

const results = [];
const started = Date.now();

for (const check of selected) {
  const plan = check.plan();
  const label = check.id + " · " + check.title;

  if (plan.skip) {
    console.log("\n──── SKIP  " + label + "\n      " + plan.skip);
    results.push({ ...pick(check), state: "skip", why: plan.skip });
    continue;
  }
  if (plan.fail) {
    console.log("\n──── FAIL  " + label + "\n      " + plan.fail);
    results.push({ ...pick(check), state: "fail", why: plan.fail });
    continue;
  }

  const [exe, args] = launch(plan.cmd);
  console.log("\n──── RUN   " + label + "\n      $ " + plan.cmd.join(" "));
  const at = Date.now();
  const r = spawnSync(exe, args, { cwd: ROOT, stdio: "inherit", windowsHide: true });
  const ms = Date.now() - at;
  const state = r.status === 0 ? "pass" : "fail";
  results.push({ ...pick(check), state, code: r.status, ms });
  console.log("      " + state.toUpperCase() + " in " + (ms / 1000).toFixed(1) + "s");
}

// ---------------------------------------------------------------- summary

const failed = results.filter((r) => r.state === "fail" && r.blocking);
const skippedBlocking = results.filter((r) => r.state === "skip" && r.blocking);
const green = failed.length === 0;

const ICON = { pass: "PASS", fail: "FAIL", skip: "skip" };
console.log("\n" + "=".repeat(78));
console.log("CI parity — " + ((Date.now() - started) / 1000).toFixed(0) + "s\n");
for (const r of results) {
  console.log(
    "  " +
      ICON[r.state].padEnd(6) +
      r.id.padEnd(16) +
      r.job +
      (r.blocking ? "" : " (reports only)"),
  );
}

console.log("\n  Not reproducible locally — read these on the pull request:");
for (const [what, why] of CI_ONLY) console.log("    · " + what + ": " + why);

if (skippedBlocking.length) {
  console.log("\n  Skipped, so unproven here:");
  for (const r of skippedBlocking) console.log("    · " + r.id + " — " + r.why);
}

// ---------------------------------------------------------------- receipt

const sha = git("rev-parse", "HEAD");
const porcelain = git("status", "--porcelain") ?? "";
const receipt = {
  version: 1,
  ran: new Date().toISOString(),
  branch: git("rev-parse", "--abbrev-ref", "HEAD"),
  sha,
  // The working tree, not just the commit: a run is only evidence about the code it saw.
  tree: createHash("sha1")
    .update(sha + "\n" + porcelain)
    .digest("hex"),
  dirty: porcelain.length > 0,
  argv,
  // A --fast or --only run is a useful thing to do while building and a useless thing to
  // gate a review on: it is green about the checks it chose. guard-pr reads this rather
  // than treating three passes as proof of fifteen.
  full: selected.length === CHECKS.length,
  green,
  failed: failed.map((r) => r.id),
  skipped: skippedBlocking.map((r) => r.id),
};
try {
  writeFileSync(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
} catch {
  // The receipt is a convenience for guard-pr. Losing it must not fail the run.
}

if (!green) {
  console.log(
    "\n  " +
      failed.length +
      " blocking check(s) failed: " +
      failed.map((r) => r.id).join(", "),
  );
  console.log("  Fix these before pushing — CI fails the same way.\n");
  process.exit(1);
}

console.log(
  "\n  No blocking check failed." +
    (receipt.dirty ? " Working tree is dirty — commit before pushing." : "") +
    "\n",
);
