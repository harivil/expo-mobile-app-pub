#!/usr/bin/env node
// node --test .github/scripts/
//
// What these protect: the bot must never eat what a human wrote in a PR body, and a second
// push must replace the block rather than stack a new one under it. Both are silent failures
// — the body still looks plausible — so they get tests rather than a careful eye.

import { test } from "node:test";
import assert from "node:assert/strict";

import { START, END, composeBlock, spliceBlock } from "./evidence-body.mjs";
import { classify } from "./ui-touched.mjs";

const images = [
  { name: "ios-light.png", url: "https://example.test/ios.png" },
  { name: "web-dark.png", url: "https://example.test/web-dark.png" },
];

test("the block carries the short sha and one img per image", () => {
  const block = composeBlock({ sha: "abcdef1234567890", images });
  assert.match(block, /abcdef1/);
  assert.equal(block.match(/<img /g).length, 2);
  assert.match(block, /iOS · light/);
  assert.match(block, /Web · dark/);
  assert.ok(block.startsWith(START) && block.endsWith(END));
});

test("gaps are named, not implied", () => {
  const block = composeBlock({
    sha: "deadbeef",
    images,
    gaps: [{ surface: "Android", why: "the emulator failed to boot" }],
  });
  assert.match(block, /\*\*Android\*\* — the emulator failed to boot/);
});

test("no images is a stated absence rather than an empty table", () => {
  const block = composeBlock({ sha: "deadbeef", images: [] });
  assert.match(block, /No screenshots were captured/);
  assert.ok(!block.includes("<img "));
});

test("splice appends below the author's text, keeping every word of it", () => {
  const authored = "## What changed\n\nRenamed the button.\n";
  const out = spliceBlock(authored, composeBlock({ sha: "aaaaaaa", images }));
  assert.match(out, /## What changed/);
  assert.match(out, /Renamed the button\./);
  assert.ok(out.indexOf("## What changed") < out.indexOf(START));
});

test("a second push replaces the block instead of stacking another", () => {
  const authored = "Author text.\n";
  const first = spliceBlock(authored, composeBlock({ sha: "1111111", images }));
  const second = spliceBlock(first, composeBlock({ sha: "2222222", images }));

  assert.equal(second.match(new RegExp(START, "g")).length, 1);
  assert.match(second, /2222222/);
  assert.ok(!second.includes("1111111"));
  assert.match(second, /Author text\./);
});

test("text the author added after the block survives a replace", () => {
  const withTrailer = `${spliceBlock("Top.\n", composeBlock({ sha: "1111111", images }))}\nBottom note.\n`;
  const again = spliceBlock(withTrailer, composeBlock({ sha: "2222222", images }));
  assert.match(again, /Top\./);
  assert.match(again, /Bottom note\./);
  assert.equal(again.match(new RegExp(END, "g")).length, 1);
});

test("the path rule is default-exempt", () => {
  assert.equal(classify(["docs/specs/x.md", ".github/workflows/ci.yml"]).ui, false);
  assert.equal(classify(["package.json", "package-lock.json"]).ui, false);
  assert.equal(classify(["src/app/login.tsx"]).ui, true);
  assert.equal(classify(["app.json"]).ui, true);
  assert.equal(classify(["src/assets/images/icon.png"]).ui, true);
});

test("windows-style paths from a diff still classify", () => {
  assert.equal(classify(["src\\app\\login.tsx"]).ui, true);
});

test("guarded screens and capture flows are reported separately", () => {
  const r = classify([
    "src/app/(tabs)/labs.tsx",
    ".maestro/labs-capture.yaml",
    "e2e/web/labs.capture.spec.ts",
  ]);
  assert.equal(r.ui, true);
  assert.deepEqual(r.guarded, ["src/app/(tabs)/labs.tsx"]);
  assert.equal(r.flows.length, 2);
});
