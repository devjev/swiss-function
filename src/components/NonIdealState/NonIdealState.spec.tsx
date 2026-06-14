import { expect, test } from "@playwright/experimental-ct-react";
import { NonIdealState } from "./NonIdealState";

test("renders title, description, and action", async ({ mount }) => {
  const c = await mount(
    <NonIdealState
      variant="empty"
      title="No items"
      description="Add one."
      action={<button type="button">New</button>}
    />,
  );
  await expect(c.getByText("No items")).toBeVisible();
  await expect(c.getByText("Add one.")).toBeVisible();
  await expect(c.getByRole("button", { name: "New" })).toBeVisible();
});

test("fill is a decorative canvas, hidden from a11y, covering the block", async ({ mount }) => {
  const c = await mount(<NonIdealState variant="empty" title="x" width={24} height={10} />);
  const canvas = c.locator("canvas[data-nis-fill]");
  await expect(canvas).toHaveAttribute("aria-hidden", "true");
  // Backing store sized to the block × dpr → non-zero, covers the area.
  const dims = await canvas.evaluate((el: HTMLCanvasElement) => ({ w: el.width, h: el.height }));
  expect(dims.w).toBeGreaterThan(0);
  expect(dims.h).toBeGreaterThan(0);
});

test("error variant is an assertive alert", async ({ mount }) => {
  const c = await mount(<NonIdealState variant="error" title="Failed" />);
  await expect(c).toHaveAttribute("role", "alert");
});

test("loading variant is a busy status", async ({ mount }) => {
  const c = await mount(<NonIdealState variant="loading" title="Loading" />);
  await expect(c).toHaveAttribute("role", "status");
  await expect(c).toHaveAttribute("aria-busy", "true");
});

test("empty variant has no live-region role", async ({ mount }) => {
  const c = await mount(<NonIdealState variant="empty" title="Nothing" />);
  expect(await c.getAttribute("role")).toBeNull();
});

test("reduced motion still renders the fill (a single static frame)", async ({ mount, page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const c = await mount(<NonIdealState variant="loading" title="Loading" width={24} height={10} />);
  const canvas = c.locator("canvas[data-nis-fill]");
  await expect(canvas).toBeAttached();
  expect(await canvas.evaluate((el: HTMLCanvasElement) => el.width)).toBeGreaterThan(0);
});
