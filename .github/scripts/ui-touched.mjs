#!/usr/bin/env node
// The path rule from docs/specs/pr-screenshots.md, in one place.
//
//   node ui-touched.mjs <path> [<path> ...]     paths on argv
//   node ui-touched.mjs --stdin                 one path per line on stdin
//
// Prints "true" or "false" on the last line, and the paths that matched above it. Exits 0
// either way: "no UI changed" is an answer, not a failure.
//
// Default-exempt by design. A path is UI-touching only when it matches a rule below, so a
// new top-level directory does not silently start costing three capture jobs.

const RULES = [
  { re: /^src\//, why: "app source" },
  { re: /^app\.json$/, why: "app config — icons, splash, appearance" },
];

/** Behind the auth guard, so an unaided capture cannot reach it. */
const GUARDED = /^src\/app\/\(tabs\)\//;

/** A flow that can drive the app somewhere a launch screenshot cannot reach. */
const CAPTURE_FLOW = [/^\.maestro\/.*\.ya?ml$/, /^e2e\/web\/.*\.capture\.spec\.ts$/];

export function classify(paths) {
  const clean = paths.map((p) => p.trim().replace(/\\/g, "/")).filter(Boolean);

  const matched = [];
  for (const p of clean) {
    const rule = RULES.find((r) => r.re.test(p));
    if (rule) matched.push({ path: p, why: rule.why });
  }

  return {
    ui: matched.length > 0,
    matched,
    guarded: clean.filter((p) => GUARDED.test(p)),
    flows: clean.filter((p) => CAPTURE_FLOW.some((re) => re.test(p))),
  };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
}

const invokedDirectly = process.argv[1]?.endsWith("ui-touched.mjs");

if (invokedDirectly) {
  const args = process.argv.slice(2);
  const paths = args.includes("--stdin") ? await readStdin() : args;
  const r = classify(paths);

  for (const m of r.matched) console.log(`ui  ${m.path}  (${m.why})`);
  for (const g of r.guarded) console.log(`gated  ${g}  (behind the auth guard)`);
  for (const f of r.flows) console.log(`flow  ${f}`);
  console.log(String(r.ui));
}
