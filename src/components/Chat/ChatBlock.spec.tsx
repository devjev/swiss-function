import { expect, test } from "@playwright/experimental-ct-react";
import { ChatBlock } from "./ChatBlock";

/** The frame as the browser computes it: border, surface, letterforms, and the
 *  marker the title bar prints before its label. */
const frameOf = (el: HTMLElement) => {
  const cs = getComputedStyle(el);
  const title = el.querySelector("span");
  return {
    border: cs.borderTopWidth,
    bg: cs.backgroundColor,
    font: cs.fontFamily,
    marker: title ? getComputedStyle(title, "::before").content : "none",
  };
};

test("framed is the TUI panel: hairline border, surface, monospace, a marked title bar", async ({
  mount,
}) => {
  const c = await mount(
    <ChatBlock title="status">
      <span>body</span>
    </ChatBlock>,
  );
  const f = await c.evaluate(frameOf);
  expect(f.border).toBe("1px");
  expect(f.bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(f.font).toContain("monospace");
  // U+25CF, printed by .title::before.
  expect(f.marker).toContain("●");
});

test('variant="plain" brings no frame, no surface and no marker', async ({ mount }) => {
  const c = await mount(
    <ChatBlock variant="plain" title="status">
      <span>body</span>
    </ChatBlock>,
  );
  const f = await c.evaluate(frameOf);
  expect(f.border).toBe("0px");
  expect(f.bg).toBe("rgba(0, 0, 0, 0)");
  expect(f.marker).toBe("none");
  // The label survives, as one plain line.
  await expect(c.getByText("status")).toBeVisible();
});

test('variant="plain" with no title renders the children alone', async ({ mount }) => {
  const c = await mount(
    <ChatBlock variant="plain">
      <span data-testid="body">body</span>
    </ChatBlock>,
  );
  // One block box with the consumer's own markup directly inside: no title bar,
  // and no body wrapper to style around.
  const shape = await c.evaluate((el: HTMLElement) => ({
    children: el.children.length,
    first: el.firstElementChild?.getAttribute("data-testid") ?? null,
  }));
  expect(shape).toEqual({ children: 1, first: "body" });
});
