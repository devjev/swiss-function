import { expect, test } from "@playwright/experimental-ct-react";
import { Progress } from "./Progress";
import { ProgressHarness } from "./Progress.harness";

test("exposes a progressbar with aria value attributes when determinate", async ({ mount }) => {
  const c = await mount(<ProgressHarness value={60} />);
  const bar = c.getByRole("progressbar");
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("aria-valuenow", "60");
  await expect(bar).toHaveAttribute("aria-valuemin", "0");
  await expect(bar).toHaveAttribute("aria-valuemax", "100");
});

test("indeterminate omits aria-valuenow and marks the status", async ({ mount }) => {
  const c = await mount(<ProgressHarness value={null} />);
  const bar = c.getByRole("progressbar");
  await expect(bar).toHaveAttribute("data-indeterminate", "");
  expect(await bar.getAttribute("aria-valuenow")).toBeNull();
});

test("showValue renders the rounded percentage", async ({ mount }) => {
  const c = await mount(<ProgressHarness value={128} min={0} max={256} showValue />);
  await expect(c.getByText("50%")).toBeVisible();
});

test("showValue shows no readout when indeterminate", async ({ mount }) => {
  const c = await mount(<ProgressHarness value={null} showValue />);
  await expect(c.getByText("%")).toHaveCount(0);
});

// Note: `formatValue` is a function prop, which Playwright CT proxies over RPC
// (a call returns a Promise, not a synchronous string), so it can't be exercised
// through CT render. It is covered by the WithValue Ladle story / visual pass.

test("color and dither fills render an indicator sized to the value", async ({ mount }) => {
  const c = await mount(
    <div style={{ inlineSize: 200 }}>
      <Progress value={50} fill="color" data-testid="color" />
      <Progress value={50} fill="dither" data-testid="dither" />
    </div>,
  );
  for (const id of ["color", "dither"]) {
    const indicator = c.getByTestId(id).locator('[class*="indicator"]');
    await expect(indicator).toBeVisible();
    const box = await indicator.boundingBox();
    if (!box) throw new Error("no indicator box");
    // 50% of a 200px track.
    expect(box.width).toBeGreaterThan(80);
    expect(box.width).toBeLessThan(120);
  }
});

test("animated fill renders a canvas revealed to the value via clip", async ({ mount }) => {
  const c = await mount(<ProgressHarness value={40} fill="animated" />);
  const canvas = c.locator("canvas");
  await expect(canvas).toBeAttached();
  const clip = await canvas.evaluate((el) => getComputedStyle(el).clipPath);
  // The clip insets the right edge by (100 - 40)% = 60%.
  expect(clip).not.toBe("none");
});

test("size changes the track thickness (xs < sm < md < lg)", async ({ mount }) => {
  const c = await mount(
    <div style={{ inlineSize: 240 }}>
      <Progress value={50} size="xs" data-testid="xs" />
      <Progress value={50} size="sm" data-testid="sm" />
      <Progress value={50} size="md" data-testid="md" />
      <Progress value={50} size="lg" data-testid="lg" />
    </div>,
  );
  const heights: number[] = [];
  for (const size of ["xs", "sm", "md", "lg"]) {
    const track = c.getByTestId(size).locator('[class*="track"]');
    const box = await track.boundingBox();
    if (!box) throw new Error("no track box");
    heights.push(box.height);
  }
  const sorted = [...heights].sort((a, b) => a - b);
  expect(heights).toEqual(sorted);
  expect(new Set(heights).size).toBe(4);
});

test("tone sets the accent custom property; elevation sets the shadow", async ({ mount }) => {
  const c = await mount(<ProgressHarness value={50} tone="danger" elevation={3} />);
  const bar = c.getByRole("progressbar");
  const accent = await bar.evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--progress-accent").trim(),
  );
  expect(accent.length).toBeGreaterThan(0);
  const track = c.locator('[class*="track"]');
  await expect(track).toHaveAttribute("data-elevation", "3");
  const shadow = await track.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).not.toBe("none");
});
