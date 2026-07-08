import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// One screenshot assertion per story, run once per theme project (light/dark).
// The manifest is committed (vrt/stories.json) so a fresh checkout gates
// without a discovery round-trip; refresh it with `npm run vrt:list`.

const here = dirname(fileURLToPath(import.meta.url));
const stories: string[] = JSON.parse(readFileSync(join(here, "stories.json"), "utf8"));

test.describe("visual regression", () => {
  for (const id of stories) {
    test(id, async ({ page }, testInfo) => {
      const theme = testInfo.project.name; // "light" | "dark"
      await page.emulateMedia({ reducedMotion: "reduce" });
      // `mode=preview` renders the isolated story (no Ladle chrome); `theme`
      // drives the library's data-theme via the Ladle Provider.
      await page.goto(`/?story=${encodeURIComponent(id)}&mode=preview&theme=${theme}`, {
        waitUntil: "networkidle",
      });
      // Let fonts/layout settle beyond networkidle before the pixel capture.
      await page.waitForTimeout(250);
      await expect(page).toHaveScreenshot(`${id}.png`, { fullPage: true });
    });
  }
});
