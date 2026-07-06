import { expect, test } from "@playwright/experimental-ct-react";
import { TextEditInline } from "./TextEditInline";

const LONG = "A single line at rest that is comfortably too long to fit, so it gets ellipsized.";

test("renders a <textarea>", async ({ mount }) => {
  const component = await mount(<TextEditInline aria-label="note" />);
  await expect(component.locator("textarea")).toHaveCount(1);
});

test("rests collapsed with a one-line preview", async ({ mount }) => {
  const component = await mount(<TextEditInline defaultValue={LONG} />);
  await expect(component).not.toHaveAttribute("data-expanded", "true");
  // The preview clamps to a single ellipsized line.
  const overflow = await component
    .locator("[aria-hidden='true']")
    .evaluate((el) => getComputedStyle(el).textOverflow);
  expect(overflow).toBe("ellipsis");
});

test("hover expands to the elevated overlay, then collapses on leave", async ({ mount, page }) => {
  const component = await mount(<TextEditInline defaultValue={LONG} />);
  await component.hover();
  await expect(component).toHaveAttribute("data-expanded", "true");
  // Elevation-3 lifts the textarea (a box-shadow, absent at rest).
  const shadow = await component
    .locator("textarea")
    .evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).not.toBe("none");
  // Move well below the 1-line root (full-width, top-anchored) so pointer-out
  // lands on <body>, not inside the strip or its overlay.
  await page.mouse.move(5, 600);
  await expect(component).not.toHaveAttribute("data-expanded", "true");
});

test("focus expands and accepts multi-line input; blur collapses", async ({ mount }) => {
  const component = await mount(<TextEditInline aria-label="note" />);
  const area = component.locator("textarea");
  await area.focus();
  await expect(component).toHaveAttribute("data-expanded", "true");
  await area.fill("first\nsecond\nthird");
  await expect(area).toHaveValue("first\nsecond\nthird");
  await area.blur();
  await expect(component).not.toHaveAttribute("data-expanded", "true");
});

test("empty field shows the placeholder in the preview", async ({ mount }) => {
  const component = await mount(<TextEditInline placeholder="Add a note…" />);
  await expect(component.locator("[aria-hidden='true']")).toHaveText("Add a note…");
});

test("the expanded overlay is vertically resizable", async ({ mount }) => {
  const component = await mount(<TextEditInline defaultValue={LONG} />);
  const area = component.locator("textarea");
  await area.focus();
  const resize = await area.evaluate((el) => getComputedStyle(el).resize);
  expect(resize).toBe("vertical");
});

test("a manual resize height survives further typing", async ({ mount }) => {
  const component = await mount(<TextEditInline aria-label="note" />);
  const area = component.locator("textarea");
  await area.focus();
  // Simulate a resize-handle drag: set an explicit taller height and let the
  // ResizeObserver observe it before typing…
  await area.evaluate(
    (el: HTMLTextAreaElement) =>
      new Promise<void>((resolve) => {
        el.style.height = "180px";
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  // …then typing must not auto-reset the dragged height.
  await area.pressSequentially("one\ntwo\nthree");
  const height = await area.evaluate((el) => el.style.height);
  expect(height).toBe("180px");
});

test("size maps to the Input single-line heights (md = 1.5u)", async ({ mount }) => {
  const component = await mount(<TextEditInline size="md" defaultValue="x" />);
  const height = await component.evaluate((el) => getComputedStyle(el).blockSize);
  // --sf-unit is 1.5rem = 24px, so md is 1.5u = 36px.
  expect(height).toBe("36px");
});
