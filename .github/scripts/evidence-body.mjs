#!/usr/bin/env node
// Compose the bot's block in a PR body, and splice it in without touching what the author
// wrote. Pure string work, so it is the one part of this feature that is cheap to test.
//
// The markers are the whole contract: everything between them belongs to CI and is replaced
// wholesale on the next push; everything outside is the author's and is never modified.

export const START = "<!-- pr-screenshots:start -->";
export const END = "<!-- pr-screenshots:end -->";

const LABELS = {
  "ios-light.png": "iOS · light",
  "android-light.png": "Android · light",
  "web-light.png": "Web · light",
  "web-dark.png": "Web · dark",
};

const label = (name) => LABELS[name] ?? name.replace(/\.png$/, "").replace(/-/g, " · ");

/**
 * Build the block.
 *
 * @param {object} o
 * @param {string} o.sha          the head commit these were captured from
 * @param {{name: string, url: string}[]} o.images
 * @param {{surface: string, why: string}[]} [o.gaps]
 * @param {string} [o.runUrl]     the workflow run, so a reader can see how they were made
 */
export function composeBlock({ sha, images = [], gaps = [], runUrl = "" }) {
  const short = (sha ?? "").slice(0, 7);
  const lines = [START, "", "## Screenshots"];

  if (images.length) {
    lines.push(
      "",
      `Captured by CI from \`${short}\`. Every image below waited for the app to render its\n` +
        "first screen — none of them is a splash frame.",
      "",
      `| ${images.map((i) => label(i.name)).join(" | ")} |`,
      `| ${images.map(() => "---").join(" | ")} |`,
      `| ${images.map((i) => `<img src="${i.url}" width="240">`).join(" | ")} |`,
    );
  } else {
    lines.push("", `No screenshots were captured for \`${short}\`.`);
  }

  if (gaps.length) {
    lines.push("", "**Not captured:**", "");
    for (const g of gaps) lines.push(`- **${g.surface}** — ${g.why}`);
  }

  if (runUrl) lines.push("", `<sub>[How these were made](${runUrl})</sub>`);
  lines.push("", END);
  return lines.join("\n");
}

/** Replace an existing block, or append one, leaving the author's text alone. */
export function spliceBlock(body, block) {
  const existing = body ?? "";
  const start = existing.indexOf(START);
  const end = existing.indexOf(END);

  if (start !== -1 && end !== -1 && end > start) {
    return existing.slice(0, start) + block + existing.slice(end + END.length);
  }
  const sep = existing.trim() ? `${existing.replace(/\s+$/, "")}\n\n` : "";
  return `${sep}${block}\n`;
}
