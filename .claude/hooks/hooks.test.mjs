#!/usr/bin/env node
// Regression tests for the hooks in this folder.
//
//   node .claude/hooks/hooks.test.mjs
//
// The hooks steer every session in this repo, so they get tested like the code they guard.
// Run this after changing any guard, and in CI on any change under .claude/.
//
// Exit 0 = all cases pass. Exit 1 = at least one case failed.

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const BLOCK = 2;
const ALLOW = 0;

/** Run a hook with a payload object on stdin and return its exit code. */
function run(hook, payload, env) {
  const res = spawnSync(process.execPath, [join(HERE, hook)], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    // Neutralise anything the developer's own shell exports, so a machine that happens to set
    // the escape hatch does not silently turn these cases green.
    env: {
      ...process.env,
      CLAUDE_SKIP_PLUGIN_CHECK: "",
      CLAUDE_SKIP_CI_PREFLIGHT: "",
      CLAUDE_PROJECT_DIR: "",
      ...env,
    },
  });
  return res.status;
}

const bash = (command) => ({ tool_input: { command } });
const write = (file_path) => ({ tool_input: { file_path } });

const CASES = [
  // --- guard-bash: blocked -------------------------------------------------
  [
    "guard-bash.mjs",
    bash("npm install expo-camera"),
    BLOCK,
    "npm install of an expo package",
  ],
  ["guard-bash.mjs", bash("npm i expo-router@latest"), BLOCK, "npm i, pinned version"],
  [
    "guard-bash.mjs",
    bash("npm run lint && npm add react-native-svg"),
    BLOCK,
    "second segment of a chain",
  ],
  // Every package manager desynchronises the SDK the same way, so all of them are blocked.
  ["guard-bash.mjs", bash("yarn add expo-camera"), BLOCK, "yarn add of an expo package"],
  ["guard-bash.mjs", bash("pnpm add react-native-svg"), BLOCK, "pnpm add of an RN package"],
  ["guard-bash.mjs", bash("bun add expo-router"), BLOCK, "bun add of an expo package"],
  ["guard-bash.mjs", bash("git push --force origin feat"), BLOCK, "force push"],
  ["guard-bash.mjs", bash("git push -f"), BLOCK, "force push, short flag"],

  // main is append-only. Each of these is a different spelling of rewriting it, and every one
  // of them was allowed until someone went looking.
  [
    "guard-bash.mjs",
    bash("git push --force-with-lease origin main"),
    BLOCK,
    "lease-guarded, still rewrites main",
  ],
  ["guard-bash.mjs", bash("git push origin +main"), BLOCK, "+refspec force onto main"],
  [
    "guard-bash.mjs",
    bash("git push origin +main:main"),
    BLOCK,
    "+refspec, both sides named",
  ],
  [
    "guard-bash.mjs",
    bash("git push origin +feat"),
    BLOCK,
    "+refspec is a force push on any branch",
  ],
  [
    "guard-bash.mjs",
    bash("git push --delete origin main"),
    BLOCK,
    "deleting main on the remote",
  ],
  ["guard-bash.mjs", bash("git push origin :main"), BLOCK, "the colon spelling of delete"],
  ["guard-bash.mjs", bash("git branch -f main abc123"), BLOCK, "moving the local main ref"],
  ["guard-bash.mjs", bash("git branch -D main"), BLOCK, "deleting local main"],
  [
    "guard-bash.mjs",
    bash("git update-ref refs/heads/main abc123"),
    BLOCK,
    "moving main by plumbing",
  ],

  // --- guard-bash: allowed -------------------------------------------------
  [
    "guard-bash.mjs",
    bash("npx expo install expo-camera"),
    ALLOW,
    "the correct install form",
  ],
  [
    "guard-bash.mjs",
    bash("git push --force-with-lease origin feat"),
    ALLOW,
    "lease-guarded push",
  ],
  [
    "guard-bash.mjs",
    bash("git branch -D old-feature"),
    ALLOW,
    "deleting an ordinary branch",
  ],
  ["guard-bash.mjs", bash("git switch main"), ALLOW, "reading main is not writing it"],
  ["guard-bash.mjs", bash("git rebase main"), ALLOW, "rebasing onto main"],
  ["guard-bash.mjs", bash("git log main..HEAD"), ALLOW, "main named in a revision range"],
  ["guard-bash.mjs", bash("npm install"), ALLOW, "bare install, restores the tree"],
  ["guard-bash.mjs", bash("npm run lint"), ALLOW, "ordinary script"],
  [
    "guard-bash.mjs",
    bash('echo "do not run npm install expo here"'),
    ALLOW,
    "mention inside a quoted string",
  ],
  ["guard-bash.mjs", bash("npm test"), ALLOW, "tests"],

  // --- guard-bash: pushing to a protected branch ---------------------------
  // The refspec decides where a push lands, not the branch you are standing on — which is
  // exactly what the commit guard cannot see.
  ["guard-bash.mjs", bash("git push origin main"), BLOCK, "push straight to main"],
  ["guard-bash.mjs", bash("git push origin master"), BLOCK, "push straight to master"],
  [
    "guard-bash.mjs",
    bash("git push origin HEAD:main"),
    BLOCK,
    "push HEAD onto main from a feature branch",
  ],
  [
    "guard-bash.mjs",
    bash("git push origin my-feature:main"),
    BLOCK,
    "push a named branch onto main",
  ],
  ["guard-bash.mjs", bash("git push origin refs/heads/main"), BLOCK, "fully qualified ref"],
  [
    "guard-bash.mjs",
    bash("git push origin :main"),
    BLOCK,
    "deleting main is an update too",
  ],
  [
    "guard-bash.mjs",
    bash("git push --force-with-lease origin main"),
    BLOCK,
    "a lease does not make it reviewable",
  ],
  [
    "guard-bash.mjs",
    bash("npm run verify && git push -u origin HEAD:main"),
    BLOCK,
    "second segment of a chain",
  ],

  // Precision matters more here than anywhere: a guard that fires on a branch merely
  // containing the word teaches people to reach for --no-verify.
  ["guard-bash.mjs", bash("git push -u origin feat/settings"), ALLOW, "ordinary branch"],
  [
    "guard-bash.mjs",
    bash("git push origin feature/main-menu"),
    ALLOW,
    "branch name containing 'main'",
  ],
  [
    "guard-bash.mjs",
    bash("git push origin HEAD:release/maintenance"),
    ALLOW,
    "destination merely starting with 'main'",
  ],
  [
    "guard-bash.mjs",
    bash("git push origin main:my-backup"),
    ALLOW,
    "main as the SOURCE is fine — the destination is what gets written",
  ],
  [
    "guard-bash.mjs",
    bash("ALLOW_PUSH_TO_MAIN=1 git push origin main"),
    ALLOW,
    "documented override, inline",
    { ALLOW_PUSH_TO_MAIN: "1" },
  ],

  // --- guard-write: blocked ------------------------------------------------
  ["guard-write.mjs", write("node_modules/react/index.js"), BLOCK, "posix node_modules"],
  [
    "guard-write.mjs",
    write("node_modules\\react\\index.js"),
    BLOCK,
    "windows node_modules",
  ],
  ["guard-write.mjs", write("ios/Podfile"), BLOCK, "posix ios/"],
  [
    "guard-write.mjs",
    write("D:\\mobile standard\\android\\build.gradle"),
    BLOCK,
    "windows absolute android/",
  ],
  ["guard-write.mjs", write("/Users/x/app/.expo/settings.json"), BLOCK, "expo cache"],
  ["guard-write.mjs", write("package-lock.json"), BLOCK, "lockfile"],
  ["guard-write.mjs", write("coverage/lcov.info"), BLOCK, "build output"],

  // --- guard-write: allowed ------------------------------------------------
  ["guard-write.mjs", write("src/screens/settings/index.tsx"), ALLOW, "ordinary source"],
  [
    "guard-write.mjs",
    write("src\\screens\\settings\\index.tsx"),
    ALLOW,
    "ordinary source, windows",
  ],
  [
    "guard-write.mjs",
    write("src/components/node-modules-helper.ts"),
    ALLOW,
    "name merely resembling a protected path",
  ],
  ["guard-write.mjs", write("docs/specs/claim-status.md"), ALLOW, "an artifact"],
  ["guard-write.mjs", write("app.json"), ALLOW, "config the team owns"],

  // --- guard-secrets -------------------------------------------------------
  // Only reacts to a real commit. With gitleaks absent it must still allow, so a missing
  // scanner never stops people committing — CI scans every push regardless.
  ["guard-secrets.mjs", bash("npm run lint"), ALLOW, "not a commit, no scan"],
  [
    "guard-secrets.mjs",
    bash('echo "git commit is blocked on main"'),
    ALLOW,
    "commit named inside a string",
  ],
  ["guard-secrets.mjs", bash("git status"), ALLOW, "other git command"],
  [
    "guard-secrets.mjs",
    bash('git commit -m "feat: add settings"'),
    ALLOW,
    "commit scans, allows when clean or gitleaks absent",
  ],

  // --- malformed input must never wedge a session --------------------------
  ["guard-bash.mjs", {}, ALLOW, "no command field"],
  ["guard-write.mjs", {}, ALLOW, "no path field"],
  ["guard-secrets.mjs", {}, ALLOW, "no command field"],
  [
    "format-after-edit.mjs",
    write("AGENTS.md"),
    ALLOW,
    "formatter with no node_modules present",
  ],
  ["format-after-edit.mjs", {}, ALLOW, "formatter, no path"],

  // --- guard-write: governance ---------------------------------------------
  //
  // The files that decide how every future change gets built. An agent editing the rules
  // that constrain it is the one edit nobody is positioned to review, because the
  // reviewer's own instructions may be what changed.
  [
    "guard-write.mjs",
    write("/Users/x/app/.claude/settings.json"),
    BLOCK,
    "the file that wires these guards",
  ],
  [
    "guard-write.mjs",
    write("/Users/x/app/.claude/skills/verify-app/SKILL.md"),
    BLOCK,
    "a skill body",
  ],
  [
    "guard-write.mjs",
    write("/Users/x/app/.claude/agents/verifier.md"),
    BLOCK,
    "an agent's ground truth",
  ],
  [
    "guard-write.mjs",
    write("/Users/x/app/AGENTS.md"),
    BLOCK,
    "the instructions themselves",
  ],
  ["guard-write.mjs", write("AGENTS.md"), BLOCK, "the instructions, relative path"],
  ["guard-write.mjs", write("/Users/x/app/REVIEW.md"), BLOCK, "what a reviewer checks"],
  ["guard-write.mjs", write("/Users/x/app/.husky/pre-push"), BLOCK, "a git hook"],
  [
    "guard-write.mjs",
    write("/Users/x/app/.github/workflows/ci.yml"),
    BLOCK,
    "what CI runs",
  ],
  [
    "guard-write.mjs",
    write("/Users/x/app/.github/CODEOWNERS"),
    BLOCK,
    "who has to approve a change",
  ],
  ["guard-write.mjs", write("/Users/x/app/.semgrep.yml"), BLOCK, "a scanner rule"],
  [
    "guard-write.mjs",
    write("/Users/x/app/commitlint.config.js"),
    BLOCK,
    "the commit convention",
  ],
  // Per-developer settings are gitignored and personal — not governance.
  [
    "guard-write.mjs",
    write("/Users/x/app/.claude/settings.local.json"),
    ALLOW,
    "one developer's own allowlist",
  ],
  // A README under .github is documentation, not a gate.
  [
    "guard-write.mjs",
    write("/Users/x/app/.github/PULL_REQUEST_TEMPLATE.md"),
    ALLOW,
    "the PR template",
  ],
  // The escape hatch has to work, or a session whose whole purpose is changing the rules
  // cannot do its job.
  [
    "guard-write.mjs",
    write("/Users/x/app/AGENTS.md"),
    ALLOW,
    "ALLOW_GOVERNANCE_EDIT overrides the block",
    { ALLOW_GOVERNANCE_EDIT: "1" },
  ],
];

let failed = 0;
for (const [hook, payload, expected, label, env] of CASES) {
  const got = run(hook, payload, env);
  const ok = got === expected;
  if (!ok) failed++;
  const verdict = ok ? "pass" : "FAIL";
  const want = expected === BLOCK ? "block" : "allow";
  console.log(
    `${verdict}  ${hook.padEnd(22)} ${want}  ${label}${ok ? "" : `  (got exit ${got})`}`,
  );
}

// A malformed-JSON case, which cannot be expressed as an object.
{
  const res = spawnSync(process.execPath, [join(HERE, "guard-bash.mjs")], {
    input: "this is not json",
    encoding: "utf8",
  });
  const ok = res.status === ALLOW;
  if (!ok) failed++;
  console.log(`${ok ? "pass" : "FAIL"}  guard-bash.mjs         allow  unparseable stdin`);
}

// --- guard-pr -------------------------------------------------------------
//
// This guard reads the receipt ci-local.mjs writes, so each case writes its own receipt to a
// temp path and points the hook at it. That keeps the outcome dependent on the fixture rather
// than on whether whoever is running the tests happens to have a green run sitting in the
// repo — the mistake that would make these cases pass on one laptop and fail on another.

let prCases = 0;

{
  const TMP = mkdtempSync(join(tmpdir(), "pr-guard-"));
  let seq = 0;

  const git = (...args) => {
    const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
    return r.status === 0 ? r.stdout.trim() : "";
  };

  // The digest ci-local.mjs records: this commit plus the state of the working tree.
  const sha = git("rev-parse", "HEAD");
  const thisTree = createHash("sha1")
    .update(`${sha}\n${git("status", "--porcelain")}`)
    .digest("hex");

  /** Write a receipt and return its path. */
  function receipt(body) {
    const path = join(TMP, `receipt-${seq++}.json`);
    writeFileSync(path, JSON.stringify(body));
    return path;
  }

  const MISSING = join(TMP, "never-written.json");
  const GREEN = receipt({
    version: 1,
    green: true,
    full: true,
    sha,
    tree: thisTree,
    failed: [],
    skipped: [],
  });
  const RED = receipt({
    version: 1,
    green: false,
    full: true,
    sha,
    tree: thisTree,
    failed: ["types", "test"],
  });
  const STALE = receipt({
    version: 1,
    green: true,
    full: true,
    sha,
    tree: "0".repeat(40),
    dirty: true,
  });
  const PARTIAL = receipt({
    version: 1,
    green: true,
    full: false,
    sha,
    tree: thisTree,
    argv: ["--only=types,lint"],
  });
  // A receipt written before `full` existed. Absent is not false — refusing every one of them
  // would block on a field nobody knew to write.
  const LEGACY = receipt({ version: 1, green: true, sha, tree: thisTree });

  const PR_CASES = [
    // Gated: these are the actions that put a change in front of a reviewer.
    ["gh pr create --fill", MISSING, BLOCK, "open a PR with the gate never run"],
    ["gh pr create --fill", RED, BLOCK, "open a PR after a failed run"],
    [
      "gh pr create --fill",
      STALE,
      BLOCK,
      "open a PR when the green run was against other code",
    ],
    [
      "gh pr create --fill",
      PARTIAL,
      BLOCK,
      "a --only run is green about the checks it chose",
    ],
    ["gh pr ready 1", MISSING, BLOCK, "mark ready for review"],
    ["gh pr merge 1 --squash", MISSING, BLOCK, "merge"],
    ["npm run lint && gh pr create --fill", MISSING, BLOCK, "second segment of a chain"],

    // Allowed.
    ["gh pr create --fill", GREEN, ALLOW, "green run against exactly this code"],
    ["gh pr create --fill", LEGACY, ALLOW, "a receipt written before `full` existed"],
    [
      "gh pr create --draft --fill",
      MISSING,
      ALLOW,
      "a draft shares work without asking for review",
    ],
    ["gh pr view 1", MISSING, ALLOW, "reading a PR"],
    ["gh pr checks 1 --watch", MISSING, ALLOW, "watching checks"],
    ["gh pr list", MISSING, ALLOW, "listing PRs"],
    ["git push -u origin feat", MISSING, ALLOW, "pushing a branch is not opening a PR"],
    ['echo "then run gh pr create"', MISSING, ALLOW, "mention inside a quoted string"],
  ];

  for (const [command, path, expected, label] of PR_CASES) {
    const got = run("guard-pr.mjs", bash(command), { CLAUDE_CI_RECEIPT: path });
    const ok = got === expected;
    if (!ok) failed++;
    prCases++;
    const want = expected === BLOCK ? "block" : "allow";
    console.log(
      `${ok ? "pass" : "FAIL"}  ${"guard-pr.mjs".padEnd(22)} ${want}  ${label}${ok ? "" : `  (got exit ${got})`}`,
    );
  }

  // The escape hatch has to work, or a broken gate becomes a broken team.
  {
    const got = run("guard-pr.mjs", bash("gh pr create --fill"), {
      CLAUDE_CI_RECEIPT: MISSING,
      CLAUDE_SKIP_CI_PREFLIGHT: "1",
    });
    const ok = got === ALLOW;
    if (!ok) failed++;
    prCases++;
    console.log(
      `${ok ? "pass" : "FAIL"}  ${"guard-pr.mjs".padEnd(22)} allow  CLAUDE_SKIP_CI_PREFLIGHT overrides a block${ok ? "" : `  (got exit ${got})`}`,
    );
  }

  // Malformed input must never wedge a session.
  {
    const got = run("guard-pr.mjs", {}, { CLAUDE_CI_RECEIPT: MISSING });
    const ok = got === ALLOW;
    if (!ok) failed++;
    prCases++;
    console.log(
      `${ok ? "pass" : "FAIL"}  ${"guard-pr.mjs".padEnd(22)} allow  no command field${ok ? "" : `  (got exit ${got})`}`,
    );
  }

  rmSync(TMP, { recursive: true, force: true });
}

// --- guard-bash, branch-aware ---------------------------------------------
//
// The subtle half of protecting main: these commands name no branch at all. `git push
// --force-with-lease` pushes whatever you are standing on, and a hard reset destroys it in
// place. Identical text, opposite consequences, so the fixture is a real repo on a real branch.

let branchCases = 0;

{
  const TMP = mkdtempSync(join(tmpdir(), "branch-guard-"));
  const git = (...args) => spawnSync("git", args, { cwd: TMP, encoding: "utf8" });

  git("init", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  writeFileSync(join(TMP, "seed.txt"), "seed\n");
  git("add", "-A");
  git("commit", "-m", "chore: seed");

  const runIn = (command) =>
    spawnSync(process.execPath, [join(HERE, "guard-bash.mjs")], {
      input: JSON.stringify(bash(command)),
      encoding: "utf8",
      cwd: TMP,
      env: { ...process.env, CLAUDE_SKIP_PLUGIN_CHECK: "", CLAUDE_PROJECT_DIR: "" },
    }).status;

  const DANGEROUS = ["git reset --hard HEAD~1", "git push --force-with-lease"];

  for (const command of DANGEROUS) {
    const got = runIn(command);
    const ok = got === BLOCK;
    if (!ok) failed++;
    branchCases++;
    console.log(
      `${ok ? "pass" : "FAIL"}  ${"guard-bash.mjs".padEnd(22)} block  on main: ${command}${ok ? "" : `  (got exit ${got})`}`,
    );
  }

  // The same commands on a branch of your own are ordinary work.
  git("switch", "-c", "feat");
  for (const command of DANGEROUS) {
    const got = runIn(command);
    const ok = got === ALLOW;
    if (!ok) failed++;
    branchCases++;
    console.log(
      `${ok ? "pass" : "FAIL"}  ${"guard-bash.mjs".padEnd(22)} allow  on a branch: ${command}${ok ? "" : `  (got exit ${got})`}`,
    );
  }

  rmSync(TMP, { recursive: true, force: true });
}

// --- guard-push -----------------------------------------------------------
//
// A git hook rather than a Claude Code hook, so it refuses by git's convention (exit 1) and is
// exercised the way git calls it: one line per ref on stdin, and a real repo to resolve the
// shas against. Two real commits are cheaper here than any amount of mocking, and they make the
// fast-forward case — the one that must keep working — genuinely true rather than asserted.

let pushCases = 0;

{
  const TMP = mkdtempSync(join(tmpdir(), "push-guard-"));
  const git = (...args) => spawnSync("git", args, { cwd: TMP, encoding: "utf8" });
  const ZERO = "0".repeat(40);
  const REFUSE = 1;

  git("init", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  writeFileSync(join(TMP, "a.txt"), "a\n");
  git("add", "-A");
  git("commit", "-m", "chore: first");
  const first = git("rev-parse", "HEAD").stdout.trim();
  writeFileSync(join(TMP, "b.txt"), "b\n");
  git("add", "-A");
  git("commit", "-m", "chore: second");
  const second = git("rev-parse", "HEAD").stdout.trim();

  /** One pre-push line: local ref, local sha, remote ref, remote sha. */
  const push = (localSha, remoteRef, remoteSha) =>
    spawnSync(process.execPath, [join(HERE, "guard-push.mjs")], {
      input: `refs/heads/x ${localSha} ${remoteRef} ${remoteSha}\n`,
      encoding: "utf8",
      cwd: TMP,
    }).status;

  const PUSH_CASES = [
    // Adding commits on top of what the remote has is the whole point.
    [push(second, "refs/heads/main", first), ALLOW, "fast-forward onto main"],
    // The remote is ahead: this push drops a commit someone else can already see.
    [push(first, "refs/heads/main", second), REFUSE, "force-push onto main"],
    [push(ZERO, "refs/heads/main", second), REFUSE, "deleting main"],
    [push(second, "refs/heads/master", first), ALLOW, "fast-forward onto master"],
    [push(first, "refs/heads/master", second), REFUSE, "force-push onto master"],
    // Your own branch is yours to rewrite.
    [push(first, "refs/heads/feat", second), ALLOW, "force-push onto a feature branch"],
    // Nothing on the remote to overwrite yet.
    [push(second, "refs/heads/main", ZERO), ALLOW, "creating main on a fresh remote"],
  ];

  for (const [got, expected, label] of PUSH_CASES) {
    const ok = got === expected;
    if (!ok) failed++;
    pushCases++;
    const want = expected === ALLOW ? "allow" : "refuse";
    console.log(
      `${ok ? "pass" : "FAIL"}  ${"guard-push.mjs".padEnd(22)} ${want}  ${label}${ok ? "" : `  (got exit ${got})`}`,
    );
  }

  rmSync(TMP, { recursive: true, force: true });
}

// --- require-plugins ------------------------------------------------------
//
// This guard reads Claude Code's own plugin state, which differs on every machine and is
// absent in CI. So each case builds a throwaway CLAUDE_CONFIG_DIR and points the hook at it,
// making the outcome depend only on the fixture. The distinction that matters most is
// bundled vs external: a bundled plugin arrives with the marketplace clone and never gets an
// install record, so demanding one would block forever on plugins that already work.

let pluginCases = 0;

{
  const TMP = mkdtempSync(join(tmpdir(), "plugin-guard-"));
  let seq = 0;

  /** Build a project + config-dir pair and return what `run` needs to exercise it. */
  function fixture({ declared, local, records, catalog, marketplaces, version = 2 }) {
    const base = join(TMP, `case-${seq++}`);
    const proj = join(base, "proj");
    const cfg = join(base, "cfg");
    const plugins = join(cfg, "plugins");

    mkdirSync(join(proj, ".claude"), { recursive: true });
    if (declared !== undefined) {
      writeFileSync(
        join(proj, ".claude", "settings.json"),
        JSON.stringify({ enabledPlugins: declared }),
      );
    }
    if (local !== undefined) {
      writeFileSync(
        join(proj, ".claude", "settings.local.json"),
        JSON.stringify({ enabledPlugins: local }),
      );
    }

    mkdirSync(plugins, { recursive: true });
    writeFileSync(
      join(plugins, "installed_plugins.json"),
      JSON.stringify({ version, plugins: records ?? {} }),
    );
    writeFileSync(
      join(plugins, "known_marketplaces.json"),
      JSON.stringify(marketplaces ?? { mp: { source: {} } }),
    );

    for (const [name, entries] of Object.entries(catalog ?? { mp: [] })) {
      const dir = join(plugins, "marketplaces", name, ".claude-plugin");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "marketplace.json"), JSON.stringify({ plugins: entries }));
    }

    return { proj, cfg };
  }

  // A plugin whose source is a path inside the marketplace repo, versus one that points away.
  const BUNDLED = { name: "sec", source: "./plugins/sec" };
  const EXTERNAL = {
    name: "ext",
    source: { source: "git-subdir", url: "https://example.com/x.git" },
  };
  const CATALOG = { mp: [BUNDLED, EXTERNAL] };

  const PLUGIN_CASES = [
    [
      "bundled plugin needs no install record",
      fixture({ declared: { "sec@mp": true }, catalog: CATALOG }),
      ALLOW,
    ],
    [
      "external plugin, never installed",
      fixture({ declared: { "ext@mp": true }, catalog: CATALOG }),
      BLOCK,
    ],
    [
      "external plugin installed at user scope",
      fixture({
        declared: { "ext@mp": true },
        catalog: CATALOG,
        records: { "ext@mp": [{ scope: "user" }] },
      }),
      ALLOW,
    ],
    [
      "external plugin bound to a different project directory",
      fixture({
        declared: { "ext@mp": true },
        catalog: CATALOG,
        records: {
          "ext@mp": [{ scope: "project", projectPath: join(tmpdir(), "some-other-repo") }],
        },
      }),
      BLOCK,
    ],
    [
      "unknown marketplace",
      fixture({ declared: { "ext@nope": true }, catalog: CATALOG }),
      BLOCK,
    ],
    [
      "declared but absent from the catalog",
      fixture({ declared: { "ghost@mp": true }, catalog: CATALOG }),
      BLOCK,
    ],
    [
      "schema drift fails open rather than blocking everyone",
      fixture({ declared: { "ext@mp": true }, catalog: CATALOG, version: 3 }),
      ALLOW,
    ],
    ["nothing declared", fixture({ catalog: CATALOG }), ALLOW],
    [
      "declared false is not required",
      fixture({ declared: { "ext@mp": false }, catalog: CATALOG }),
      ALLOW,
    ],
    [
      "settings.local.json turns one off for this developer",
      fixture({
        declared: { "ext@mp": true },
        local: { "ext@mp": false },
        catalog: CATALOG,
      }),
      ALLOW,
    ],
  ];

  for (const [label, fx, expected] of PLUGIN_CASES) {
    const got = run(
      "require-plugins.mjs",
      { hook_event_name: "SessionStart", cwd: fx.proj },
      {
        CLAUDE_CONFIG_DIR: fx.cfg,
      },
    );
    const ok = got === expected;
    if (!ok) failed++;
    pluginCases++;
    const want = expected === BLOCK ? "block" : "allow";
    console.log(
      `${ok ? "pass" : "FAIL"}  ${"require-plugins.mjs".padEnd(22)} ${want}  ${label}${ok ? "" : `  (got exit ${got})`}`,
    );
  }

  // A project whose own path matches the install record is the case the others invert.
  {
    const fx = fixture({ declared: { "ext@mp": true }, catalog: CATALOG });
    writeFileSync(
      join(fx.cfg, "plugins", "installed_plugins.json"),
      JSON.stringify({
        version: 2,
        plugins: { "ext@mp": [{ scope: "project", projectPath: fx.proj }] },
      }),
    );
    const got = run(
      "require-plugins.mjs",
      { hook_event_name: "SessionStart", cwd: fx.proj },
      {
        CLAUDE_CONFIG_DIR: fx.cfg,
      },
    );
    const ok = got === ALLOW;
    if (!ok) failed++;
    pluginCases++;
    console.log(
      `${ok ? "pass" : "FAIL"}  ${"require-plugins.mjs".padEnd(22)} allow  project-scoped install matching this directory${ok ? "" : `  (got exit ${got})`}`,
    );
  }

  // The escape hatch has to work, or CI and cloud sessions cannot run at all.
  {
    const fx = fixture({ declared: { "ext@mp": true }, catalog: CATALOG });
    const got = run(
      "require-plugins.mjs",
      { hook_event_name: "SessionStart", cwd: fx.proj },
      {
        CLAUDE_CONFIG_DIR: fx.cfg,
        CLAUDE_SKIP_PLUGIN_CHECK: "1",
      },
    );
    const ok = got === ALLOW;
    if (!ok) failed++;
    pluginCases++;
    console.log(
      `${ok ? "pass" : "FAIL"}  ${"require-plugins.mjs".padEnd(22)} allow  CLAUDE_SKIP_PLUGIN_CHECK overrides a block${ok ? "" : `  (got exit ${got})`}`,
    );
  }

  rmSync(TMP, { recursive: true, force: true });
}

console.log(
  `\n${CASES.length + 1 + branchCases + pushCases + prCases + pluginCases} cases, ${failed} failed`,
);
process.exit(failed === 0 ? 0 : 1);
