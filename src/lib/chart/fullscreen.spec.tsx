import { expect, test } from "@playwright/experimental-ct-react";
import { ScaffoldFullscreenCharts } from "./fullscreen.harness";

const CHARTS = ["BarChart", "BridgeChart", "BoxPlot", "DotPlot", "BulletChart", "Marimekko"];

test.use({ viewport: { width: 1000, height: 700 } });

test("each scaffold chart's fullscreen key sits in its own corner, and full screen fills the window", async ({
  mount,
  page,
}) => {
  const c = await mount(<ScaffoldFullscreenCharts />);
  for (const name of CHARTS) {
    const chart = c.getByTestId(name);
    const key = chart.getByRole("button", { name: "Enter fullscreen" });
    const fit = await key.evaluate((el) => {
      const k = el.getBoundingClientRect();
      const r = (el.parentElement as HTMLElement).getBoundingClientRect();
      return {
        inside: k.left >= r.left && k.right <= r.right && k.top >= r.top && k.bottom <= r.bottom,
        // The top-right corner, a hair inside.
        corner: r.right - k.right < 24 && k.top - r.top < 24,
      };
    });
    expect(fit, name).toEqual({ inside: true, corner: true });
    await key.click();
    const full = await chart.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { width: Math.round(r.width), height: Math.round(r.height), top: r.top, left: r.left };
    });
    expect(full, name).toEqual({ width: 1000, height: 700, top: 0, left: 0 });
    await page.keyboard.press("Escape");
    await expect(chart.getByRole("button", { name: "Enter fullscreen" })).toBeVisible();
  }
});
