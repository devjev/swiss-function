import { expect, test } from "@playwright/experimental-ct-react";
import { MapHarness } from "./Map.harness";

// MapLibre needs real WebGL; these specs avoid asserting rendered map pixels and
// keep the map on an inline empty style (no tile network). They check that the
// component mounts, the compound surfaces render, and the framing props apply.

test("renders the map surface and the controls toolbar", async ({ mount }) => {
  const c = await mount(<MapHarness />);
  await expect(c.locator("[data-map-surface]")).toBeVisible();
  await expect(c.getByRole("button", { name: "Reset view" })).toBeVisible();
  for (const name of ["Minimal", "Street", "Terrain"]) {
    await expect(c.getByRole("button", { name })).toBeVisible();
  }
});

test("renders the minimap overlay when included", async ({ mount }) => {
  const c = await mount(<MapHarness minimap />);
  await expect(c.locator("[data-map-minimap]")).toBeVisible();
});

test("the surface exposes role and label", async ({ mount }) => {
  const c = await mount(<MapHarness />);
  const surface = c.locator("[data-map-surface]");
  await expect(surface).toHaveAttribute("role", "application");
  await expect(surface).toHaveAttribute("aria-label", "Map");
});

test("a basemap toggle marks itself pressed", async ({ mount }) => {
  const c = await mount(<MapHarness />);
  await c.getByRole("button", { name: "Terrain" }).click();
  await expect(c.getByRole("button", { name: "Terrain" })).toHaveAttribute("data-pressed", "");
});

test("the default frame draws a border", async ({ mount }) => {
  const c = await mount(<MapHarness />);
  await expect(c.locator("[data-map-root]")).toHaveCSS("border-top-width", "1px");
});

test("frame={false} removes the component's border", async ({ mount }) => {
  const c = await mount(<MapHarness frame={false} />);
  await expect(c.locator("[data-map-root]")).toHaveCSS("border-top-width", "0px");
});

test("fill makes the map fill its parent's height", async ({ mount }) => {
  const c = await mount(<MapHarness fill />);
  await expect(c.locator("[data-map-root]")).toHaveCSS("height", "400px");
});

test("without fill the map keeps its fixed default height", async ({ mount }) => {
  // 24 × --sf-unit (1.5rem @ 16px) = 576px.
  const c = await mount(<MapHarness />);
  await expect(c.locator("[data-map-root]")).toHaveCSS("height", "576px");
});
