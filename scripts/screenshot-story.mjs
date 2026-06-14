// Take a screenshot of a Ladle story for visual debugging.
//
// Usage:
//   node scripts/screenshot-story.mjs <story-id> [outfile]
//
// Example:
//   node scripts/screenshot-story.mjs prose--long /tmp/prose-long.png
//
// Ladle URL convention: ?story=<file-name>--<export-name>, both lowercased
// (e.g. Prose.stories.tsx + export Long → "prose--long").
//
// Assumes `just dev` is running on http://localhost:61000 (see .ladle/config.mjs).
// Override with LADLE_PORT if you serve on a different port.

import { chromium } from "playwright";

const storyId = process.argv[2];
const outfile = process.argv[3] ?? `/tmp/ladle-${storyId}.png`;
const port = process.env.LADLE_PORT ?? "61000";
if (!storyId) {
  console.error("usage: node scripts/screenshot-story.mjs <story-id> [outfile]");
  process.exit(1);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(`http://localhost:${port}/?story=${encodeURIComponent(storyId)}`, {
  waitUntil: "networkidle",
});
// Ladle wraps the story in an iframe — wait for it then screenshot the frame's body.
const frame =
  page.frame({ name: "ladle-frame" }) ?? page.frames().find((f) => f.url().includes("/iframe"));
if (frame) {
  await frame.waitForLoadState("networkidle");
  const body = await frame.locator("body").elementHandle();
  if (body) {
    await body.screenshot({ path: outfile });
  } else {
    await page.screenshot({ path: outfile, fullPage: true });
  }
} else {
  await page.screenshot({ path: outfile, fullPage: true });
}
await browser.close();
console.log(outfile);
