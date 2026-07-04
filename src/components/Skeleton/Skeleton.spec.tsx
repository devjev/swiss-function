import { expect, test } from "@playwright/experimental-ct-react";
import { Skeleton } from "./Skeleton";

test("renders a div with aria-hidden by default", async ({ mount }) => {
  const component = await mount(<Skeleton />);
  await expect(component).toHaveJSProperty("tagName", "DIV");
  await expect(component).toHaveAttribute("aria-hidden", "true");
});

test("default height is one --sf-unit (24px at default leading)", async ({ mount }) => {
  const component = await mount(<Skeleton width={5} />);
  const height = await component.evaluate((el) => getComputedStyle(el).height);
  expect(height).toBe("24px");
});

test("width={5} resolves to 5 × --sf-unit (120px)", async ({ mount }) => {
  const component = await mount(<Skeleton width={5} />);
  const width = await component.evaluate((el) => getComputedStyle(el).width);
  expect(width).toBe("120px");
});

test("size shorthand applies to both width and height", async ({ mount }) => {
  const component = await mount(<Skeleton size={3} />);
  const { width, height } = await component.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { width: cs.width, height: cs.height };
  });
  expect(width).toBe("72px");
  expect(height).toBe("72px");
});

test("shape='circle' yields a round element (radius = 50% or half of size)", async ({ mount }) => {
  const component = await mount(<Skeleton shape="circle" size={3} />);
  const radius = await component.evaluate((el) => getComputedStyle(el).borderRadius);
  // Browsers may resolve border-radius: 50% to either "50%" or the pixel equivalent (36px on a 72×72 box).
  expect(radius).toMatch(/^(50%|36px)/);
});

test("shape='pill' uses --sf-radius-full (9999px)", async ({ mount }) => {
  const component = await mount(<Skeleton shape="pill" width={5} height={1} />);
  const radius = await component.evaluate((el) => getComputedStyle(el).borderRadius);
  expect(radius).toBe("9999px");
});

test("default rect uses --sf-radius-default (2px)", async ({ mount }) => {
  const component = await mount(<Skeleton width={5} />);
  const radius = await component.evaluate((el) => getComputedStyle(el).borderRadius);
  expect(radius).toBe("2px");
});

test("render prop renders the requested element", async ({ mount }) => {
  const component = await mount(<Skeleton render={<span />} />);
  await expect(component).toHaveJSProperty("tagName", "SPAN");
});

test("consumer style wins over computed sizing", async ({ mount }) => {
  const component = await mount(<Skeleton width={5} style={{ width: "200px" }} />);
  const width = await component.evaluate((el) => getComputedStyle(el).width);
  expect(width).toBe("200px");
});

test("default skeleton has no canvas (shimmer only)", async ({ mount }) => {
  const c = await mount(<Skeleton />);
  expect(await c.locator("canvas").count()).toBe(0);
});

test("effect renders a dithered-fill canvas and flags the root", async ({ mount }) => {
  const c = await mount(<Skeleton effect="noise" height={4} />);
  await expect(c).toHaveAttribute("data-effect", "");
  expect(await c.locator("canvas").count()).toBe(1);
});

test("dithered fill paints through the lazily-loaded shared engine", async ({ mount, page }) => {
  const hasGl = await page.evaluate(() => !!document.createElement("canvas").getContext("webgl"));
  test.skip(!hasGl, "WebGL unavailable in this environment");
  const c = await mount(<Skeleton effect="noise" height={4} />);
  const canvas = c.locator("canvas");
  // The engine arrives via dynamic import, so poll for the first blitted frame.
  await expect
    .poll(() =>
      canvas.evaluate((el: HTMLCanvasElement) => {
        const ctx = el.getContext("2d");
        if (!ctx || el.width === 0) return 0;
        const data = ctx.getImageData(0, 0, el.width, el.height).data;
        let opaque = 0;
        for (let i = 3; i < data.length; i += 4) if ((data[i] as number) > 0) opaque++;
        return opaque;
      }),
    )
    .toBeGreaterThan(0);
});
