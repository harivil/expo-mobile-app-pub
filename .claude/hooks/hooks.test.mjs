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
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
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
      CLAUDE_PROJECT_DIR: "",
      ALLOW_PUSH_TO_MAIN: "",
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
  ["guard-bash.mjs", bash("yarn add zod"), ALLOW, "yarn add of a non-Expo package"],
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

console.log(`\n${CASES.length + 1 + pluginCases} cases, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
