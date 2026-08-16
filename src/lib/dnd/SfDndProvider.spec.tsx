import { expect, test } from "@playwright/experimental-ct-react";
import { ExternalDropHarness, ProbeHarness, ReorderHarness } from "./SfDndProvider.harness";

async function dragMouse(
  page: import("@playwright/test").Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // Two moves: the first crosses the 4px activation threshold, the second lands.
  await page.mouse.move(from.x + 6, from.y + 6, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

const center = (b: { x: number; y: number; width: number; height: number }) => ({
  x: b.x + b.width / 2,
  y: b.y + b.height / 2,
});

test("a widget sees the shared registry only inside a provider", async ({ mount }) => {
  const c = await mount(<ProbeHarness />);
  await expect(c.getByTestId("inside")).toHaveText("shared");
  await expect(c.getByTestId("outside")).toHaveText("own");
});

test("reordering works when the widget joins the shared context", async ({ mount, page }) => {
  const c = await mount(<ReorderHarness />);
  await expect(c.getByTestId("order")).toHaveText("First|Second|Third");

  const grips = c.getByRole("button", { name: "Drag to reorder" });
  const firstGrip = await grips.first().boundingBox();
  const thirdRowGrip = await grips.nth(2).boundingBox();
  if (!firstGrip || !thirdRowGrip) throw new Error("no grips");

  // Drag the first row past the third so it lands last.
  await dragMouse(page, center(firstGrip), {
    x: center(thirdRowGrip).x,
    y: thirdRowGrip.y + thirdRowGrip.height,
  });

  await expect(c.getByTestId("order")).toHaveText("Second|Third|First");
});

test("a host element dropped on a row fires onExternalDrop, without reordering", async ({
  mount,
  page,
}) => {
  const c = await mount(<ExternalDropHarness />);
  await expect(c.getByTestId("drop")).toHaveText("none");

  const chip = await c.getByTestId("chip").boundingBox();
  // The first row's grip is a stable point inside the first sortable row.
  const firstRow = await c.getByRole("button", { name: "Drag to reorder" }).first().boundingBox();
  if (!chip || !firstRow) throw new Error("no boxes");

  await dragMouse(page, center(chip), center(firstRow));

  await expect(c.getByTestId("drop")).toHaveText("host-item@0");
  // A foreign drop must not reorder the widget's own rows.
  await expect(c.getByTestId("order")).toHaveText("First|Second");
});
