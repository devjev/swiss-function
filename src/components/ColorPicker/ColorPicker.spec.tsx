import { expect, test } from "@playwright/experimental-ct-react";
import { ChromaticityDiagram } from "./ChromaticityDiagram";
import { ColorPickerHarness } from "./ColorPicker.harness";

test("renders the default OKLCH channels + alpha and the hex", async ({ mount }) => {
  const c = await mount(<ColorPickerHarness />);
  await expect(c.getByRole("slider")).toHaveCount(4); // L, C, H, A
  await expect(c.getByRole("slider", { name: "L" })).toBeVisible();
  await expect(c.locator('input[aria-label="Hex"]')).toHaveValue("#3b82f6");
});

test("switching the space relabels the channels", async ({ mount, page }) => {
  const c = await mount(<ColorPickerHarness />);
  await c.getByRole("button", { name: /OKLCH/ }).click();
  await page.getByRole("menuitem", { name: "RGB" }).click();
  await expect(c.getByRole("slider", { name: "R" })).toBeVisible();
  await expect(c.getByRole("slider", { name: "G" })).toBeVisible();
  await expect(c.getByRole("slider", { name: "B" })).toBeVisible();
});

test("typing a hex updates the colour", async ({ mount }) => {
  const c = await mount(<ColorPickerHarness />);
  await c.locator('input[aria-label="Hex"]').fill("#ff0000");
  await expect(c.getByTestId("value")).toHaveText("#ff0000");
});

test("a channel slider drives the value", async ({ mount, page }) => {
  const c = await mount(<ColorPickerHarness pickerProps={{ defaultSpace: "rgb" }} />);
  const r = c.getByRole("slider", { name: "R" });
  await r.focus();
  const before = (await c.getByTestId("value").textContent()) ?? "";
  await page.keyboard.press("ArrowRight");
  await expect(c.getByTestId("value")).not.toHaveText(before);
});

test("alpha={false} drops the alpha channel", async ({ mount }) => {
  const c = await mount(<ColorPickerHarness pickerProps={{ alpha: false }} />);
  await expect(c.getByRole("slider")).toHaveCount(3); // L, C, H only
});

test("out-of-gamut shows the chip and Clamp maps it in", async ({ mount }) => {
  const c = await mount(<ColorPickerHarness initialValue="oklch(0.7 0.37 30)" />);
  await expect(c.getByText("OUT OF GAMUT (sRGB)")).toBeVisible();
  await c.getByRole("button", { name: "Clamp" }).click();
  await expect(c.getByText("OUT OF GAMUT (sRGB)")).toHaveCount(0);
});

test("eyedropper={false} hides the pick button", async ({ mount }) => {
  const c = await mount(<ColorPickerHarness pickerProps={{ eyedropper: false }} />);
  await expect(c.getByRole("button", { name: "Pick colour from screen" })).toHaveCount(0);
});

test("diagram={true} renders the chromaticity diagram", async ({ mount }) => {
  const c = await mount(<ColorPickerHarness pickerProps={{ diagram: true }} />);
  await expect(c.getByRole("img", { name: /chromaticity/i })).toBeVisible();
});

test("standalone ChromaticityDiagram marks the colour with a filled dot", async ({ mount }) => {
  const c = await mount(<ChromaticityDiagram color="#3b82f6" fill={false} />);
  await expect(c.locator("circle").last()).toHaveAttribute("fill", "#3b82f6");
});

test("the spectral locus stays inside the frame (no out-of-bounds spill)", async ({ mount }) => {
  // The green tip of the locus reaches y ≈ 0.83; the plot domain must contain
  // it, or the horseshoe spills past the frame's top edge.
  const c = await mount(<ChromaticityDiagram color="#3b82f6" />);
  const bounds = await c.evaluate((root) => {
    const svg = root.querySelector("svg")!;
    const frame = svg.querySelector("rect")!;
    const locus = svg.querySelector("polygon")!;
    const fx = +frame.getAttribute("x")!;
    const fy = +frame.getAttribute("y")!;
    const fr = fx + +frame.getAttribute("width")!;
    const fb = fy + +frame.getAttribute("height")!;
    const pts = locus
      .getAttribute("points")!
      .split(" ")
      .map((p) => p.split(",").map(Number) as [number, number]);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return {
      fx,
      fy,
      fr,
      fb,
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  });
  expect(bounds.minX).toBeGreaterThanOrEqual(bounds.fx);
  expect(bounds.minY).toBeGreaterThanOrEqual(bounds.fy);
  expect(bounds.maxX).toBeLessThanOrEqual(bounds.fr);
  expect(bounds.maxY).toBeLessThanOrEqual(bounds.fb);
});

test("clicking the chromaticity diagram picks the colour under the pointer", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <ColorPickerHarness initialValue="#00bf54" pickerProps={{ diagram: true }} />,
  );
  const before = (await c.getByTestId("value").textContent()) ?? "";
  const box = await c.getByRole("img", { name: /chromaticity/i }).boundingBox();
  // A point well inside the horseshoe (near the sRGB interior).
  if (box) await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.5);
  await expect(c.getByTestId("value")).not.toHaveText(before);
});

test("a diagram pick clamps into sRGB (no out-of-gamut selection)", async ({ mount, page }) => {
  const c = await mount(
    <ColorPickerHarness initialValue="#3b82f6" pickerProps={{ diagram: true }} />,
  );
  const before = (await c.getByTestId("value").textContent()) ?? "";
  // A point outside the sRGB triangle but inside the horseshoe (the magenta sliver).
  const box = await c.getByRole("img", { name: /chromaticity/i }).boundingBox();
  if (box) await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.79);
  await expect(c.getByTestId("value")).not.toHaveText(before); // it picked something
  await expect(c.getByText("OUT OF GAMUT (sRGB)")).toHaveCount(0); // …but in gamut
});
