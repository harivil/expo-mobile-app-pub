#!/usr/bin/env node
// Screenshot the web build's first screen, light and dark.
//
//   node .github/scripts/shoot-web.mjs <out-dir> [--dist dist] [--route /login]
//
// Shoots the STATIC EXPORT, not the dev server, and that is the load-bearing choice: the Metro
// dev server never fires the browser `load` event in this project, so `page.goto` waits out its
// timeout and the whole web E2E suite fails locally. The export has no HMR socket, no dev
// overlay and no "Refreshing…" banner, so it is both faster (~1.3s a shot) and honest about
// what a user would see.
//
// Readiness is the testID `login-screen`, never a sleep: src/components/animated-icon.tsx holds
// a splash overlay for 600ms after launch, and a fixed wait photographs that instead of the app.

import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import { chromium } from "@playwright/test";

const [, , outArg, ...rest] = process.argv;
const val = (name, fallback) => {
  const i = rest.indexOf(name);
  return i !== -1 && rest[i + 1] ? rest[i + 1] : fallback;
};

const outDir = outArg ?? "shots";
const dist = val("--dist", "dist");
const route = val("--route", "/login");
const READY_TESTID = "login-screen";
const PORT = 4173;

if (!existsSync(dist)) {
  console.error(
    `no static export at '${dist}' — run 'npx expo export --platform web --output-dir ${dist}' first`,
  );
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------- serving the export

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// `expo export` writes /login as login.html, so a request for /login has to try both.
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const candidates = [
    join(dist, path),
    join(dist, `${path}.html`),
    join(dist, path, "index.html"),
  ];
  for (const file of candidates) {
    if (existsSync(file) && statSync(file).isFile()) {
      res.writeHead(200, {
        "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      });
      res.end(readFileSync(file));
      return;
    }
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end(`not in the export: ${path}`);
});

await new Promise((resolve) => server.listen(PORT, resolve));

// ---------------------------------------------------------------- shooting

const browser = await chromium.launch();
const failures = [];

for (const scheme of ["light", "dark"]) {
  const file = join(outDir, `web-${scheme}.png`);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: scheme,
    // A capture must never depend on a clock or a locale the runner happens to have.
    locale: "en-US",
    timezoneId: "UTC",
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  try {
    // `commit` rather than `load`: a react-native-web page keeps connections open, and waiting
    // for `load` is the exact trap the dev server falls into.
    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: "commit" });
    await page.getByTestId(READY_TESTID).waitFor({ state: "visible", timeout: 60000 });
    // One frame past ready, so the splash overlay has finished unmounting.
    await page.waitForTimeout(800);
    await page.screenshot({ path: file });
    console.log(`ok    web-${scheme} → ${file}`);
  } catch (error) {
    failures.push(
      `web-${scheme}: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error(`fail  web-${scheme}: ${error}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
server.close();

if (failures.length) {
  console.error(`\n${failures.length} web capture(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nboth web appearances captured");
