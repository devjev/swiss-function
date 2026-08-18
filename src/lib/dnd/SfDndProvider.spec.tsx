import { expect, test } from "@playwright/experimental-ct-react";
import {
  CrossWidgetHarness,
  ExternalDropHarness,
  ProbeHarness,
  ReorderHarness,
  TwoTableHarness,
} from "./SfDndProvider.harness";

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

test("an item dragged out of one region onto another fires the target's onExternalDrop", async ({
  mount,
  page,
}) => {
  const c = await mount(<CrossWidgetHarness />);
  await expect(c.getByTestId("event-a")).toHaveText("none");
  await expect(c.getByTestId("event-b")).toHaveText("none");

  const dragA = await c.getByTestId("drag-a").boundingBox();
  const regionB = await c.getByTestId("region-b").boundingBox();
  if (!dragA || !regionB) throw new Error("no boxes");

  // Drag region A's item onto region B.
  await dragMouse(page, center(dragA), center(regionB));

  // B saw it as an external drop; A's own internal reorder never fired.
  await expect(c.getByTestId("event-b")).toHaveText("external:a-item");
  await expect(c.getByTestId("event-a")).toHaveText("none");
  // The source region's transient drag state was reset (no ghosted row leak).
  await expect(c.getByTestId("drag-state-a")).toHaveText("idle");
});

test("two TableInputs under one provider have namespaced row ids (no cross-table hijack)", async ({
  mount,
  page,
}) => {
  const c = await mount(<TwoTableHarness />);
  await expect(c.getByTestId("order-a")).toHaveText("A1|A2|A3");
  await expect(c.getByTestId("b-external")).toHaveText("none");

  // Reorder within table A: drag its first row past its third.
  const gripsA = c.getByTestId("table-a").getByRole("button", { name: "Drag to reorder" });
  const firstA = await gripsA.first().boundingBox();
  const thirdA = await gripsA.nth(2).boundingBox();
  if (!firstA || !thirdA) throw new Error("no grips");
  await dragMouse(page, center(firstA), { x: center(thirdA).x, y: thirdA.y + thirdA.height });

  // A reordered; B was never touched (before namespacing, colliding "0"/"1" ids
  // could route A's drag onto B's droppable and fire B's onExternalDrop).
  await expect(c.getByTestId("order-a")).toHaveText("A2|A3|A1");
  await expect(c.getByTestId("order-b")).toHaveText("B1|B2");
  await expect(c.getByTestId("b-external")).toHaveText("none");
});

test("an item dropped back inside its own region routes internal, not external", async ({
  mount,
  page,
}) => {
  const c = await mount(<CrossWidgetHarness />);
  const dragA = await c.getByTestId("drag-a").boundingBox();
  const regionA = await c.getByTestId("region-a").boundingBox();
  if (!dragA || !regionA) throw new Error("no boxes");

  // Drag A's item within A (down to the region's lower area, still inside A).
  await dragMouse(page, center(dragA), {
    x: regionA.x + regionA.width / 2,
    y: regionA.y + regionA.height - 8,
  });

  await expect(c.getByTestId("event-a")).toHaveText("internal:a-item");
  await expect(c.getByTestId("event-b")).toHaveText("none");
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
