import { expect, test } from "@playwright/experimental-ct-react";
import { DomDocument } from "./useMinimapMarkers.harness";

test("measures headers and blocks from the DOM in content coordinates", async ({ mount }) => {
  const c = await mount(<DomDocument />);
  const readout = c.getByTestId("markers");
  await expect(readout).not.toHaveText("");
  const text = await readout.textContent();
  const markers = (text ?? "").split("|");
  // Three headers (h2, h3, h2) and three blocks, sorted by position.
  expect(markers.filter((m) => m.startsWith("header:"))).toHaveLength(3);
  expect(markers.filter((m) => m.startsWith("block:"))).toHaveLength(3);
  expect(markers[0]).toMatch(/^header:Introduction:2:\d+$/);
  const background = markers.find((m) => m.startsWith("header:Background"));
  expect(background).toMatch(/:3:\d+$/);
  // Positions are relative to the content root and increase down the document.
  const tops = markers.map((m) => Number.parseInt(m.split(":")[3] ?? "0", 10));
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
  expect(tops[0]).toBeLessThan(40);
});

test("the rail shows the header labels and a click jumps to the section", async ({ mount }) => {
  const c = await mount(<DomDocument />);
  const method = c.getByRole("heading", { name: "Method" });
  const offset = async () => {
    const root = await c.elementHandle();
    if (!root) throw new Error("no root");
    return method.evaluate(
      (el, r) => el.getBoundingClientRect().top - r.getBoundingClientRect().top,
      root,
    );
  };
  // Below the fold at first (three 240px paragraphs above it).
  expect(await offset()).toBeGreaterThan(300);
  await expect(c.getByRole("button", { name: "Method" })).toBeVisible();
  await c.getByRole("button", { name: "Method" }).click();
  await expect.poll(offset).toBeLessThan(60);
});

test("re-measures when the content changes", async ({ mount }) => {
  const c = await mount(<DomDocument />);
  const readout = c.getByTestId("markers");
  await expect(readout).toContainText("header:Method");
  await c.getByRole("button", { name: "add section" }).click();
  await expect(readout).toContainText("header:Appendix 1:2:");
  const text = await readout.textContent();
  expect((text ?? "").split("|").filter((m) => m.startsWith("block:"))).toHaveLength(4);
});
