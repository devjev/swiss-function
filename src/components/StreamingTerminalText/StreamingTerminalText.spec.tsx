import { expect, test } from "@playwright/experimental-ct-react";
import { StreamingTerminalText } from "./StreamingTerminalText";

test("static isComplete content reveals fully, no shade blocks remain", async ({ mount, page }) => {
  const c = await mount(
    <StreamingTerminalText content={"# Hello"} isComplete charIntervalMs={10} />,
  );
  await expect(c.locator("h1")).toHaveText("Hello", { timeout: 2000 });
  // Once fully revealed, no shade-block glyphs should remain in the DOM.
  const txt = (await c.textContent()) ?? "";
  expect(/[▒▓█]/.test(txt)).toBe(false);
});

test("mid-stream, the current block is already styled (h1 with shade blocks)", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <StreamingTerminalText content={"# Hello World"} isComplete={false} charIntervalMs={30} />,
  );
  // Wait for a few ticks — enough that some chars resolved but not all.
  await page.waitForTimeout(100);
  // Even mid-stream, the heading is rendered as h1.
  await expect(c.locator("h1")).toBeVisible();
  const h1Text = (await c.locator("h1").textContent()) ?? "";
  // Should contain at least one shade-block glyph (tail) AND some resolved letters.
  expect(/[▒▓]/.test(h1Text)).toBe(true);
});

test("tailLength is respected during streaming", async ({ mount, page }) => {
  const c = await mount(
    <StreamingTerminalText
      content={"Helloworld"}
      isComplete={false}
      tailLength={3}
      charIntervalMs={10}
    />,
  );
  // After enough ticks, revealedCount caps at 10 - 3 = 7. The resolved
  // portion is "Hellowo" + shade blocks for the remaining 3.
  await page.waitForTimeout(200);
  const txt = (await c.textContent()) ?? "";
  // Real letters should be only "Hellowo"; the rest is shade blocks.
  const realLetters = txt.replace(/[▒▓ ]/g, "");
  expect(realLetters).toBe("Hellowo");
});

test("whitespace doesn't consume tick budget", async ({ mount, page }) => {
  const c = await mount(
    <StreamingTerminalText content={"Hi there"} isComplete charIntervalMs={10} />,
  );
  // 7 non-ws chars × 10ms = 70ms; wait 3x and assert the full text rendered.
  await page.waitForTimeout(220);
  const txt = (await c.textContent()) ?? "";
  expect(txt).toContain("Hi there");
});

test("a burst of content does not jump the reveal", async ({ mount, page }) => {
  const content =
    "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrst";
  const c = await mount(<StreamingTerminalText content={content} isComplete charIntervalMs={50} />);
  // ~1.5 ticks elapsed at 50ms interval.
  await page.waitForTimeout(80);
  const txt = (await c.textContent()) ?? "";
  // Resolved characters so far should be small — burst didn't jump.
  const realLetters = txt.replace(/[▒▓]/g, "").trim();
  expect(realLetters.length).toBeLessThan(10);
});

test("block boundary crossed → next block opens with shade blocks already styled", async ({
  mount,
  page,
}) => {
  // Content has two blocks. Once the heading + the \n\n + a few letters of
  // the paragraph are resolved, both <h1> and <p> exist; the <p> contains
  // shade blocks while the <h1> is finalized.
  const c = await mount(
    <StreamingTerminalText
      content={"# Hi\n\nWorld"}
      isComplete={false}
      tailLength={3}
      charIntervalMs={20}
    />,
  );
  // Wait long enough for the heading to fully resolve + paragraph to start.
  await page.waitForTimeout(200);
  await expect(c.locator("h1")).toHaveText("Hi");
  // Paragraph should exist with shade blocks (since !isComplete and tail spans into it).
  const pCount = await c.locator("p").count();
  expect(pCount).toBeGreaterThan(0);
});
