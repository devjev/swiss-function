import { expect, test } from "@playwright/experimental-ct-react";
import { Button } from "../Button";
import { ButtonGroup } from "./ButtonGroup";

test("renders all child buttons", async ({ mount }) => {
  const c = await mount(
    <ButtonGroup>
      <Button>Save</Button>
      <Button>Cancel</Button>
    </ButtonGroup>,
  );
  await expect(c.getByRole("button", { name: "Save" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Cancel" })).toBeVisible();
});

test("each child fires its own onClick (group has no shared handler)", async ({ mount }) => {
  let last = "";
  const c = await mount(
    <ButtonGroup>
      <Button onClick={() => (last = "save")}>Save</Button>
      <Button onClick={() => (last = "cancel")}>Cancel</Button>
    </ButtonGroup>,
  );
  await c.getByRole("button", { name: "Save" }).click();
  expect(last).toBe("save");
  await c.getByRole("button", { name: "Cancel" }).click();
  expect(last).toBe("cancel");
});

test("middle buttons have square inner corners; outer corners stay rounded", async ({ mount }) => {
  const c = await mount(
    <ButtonGroup>
      <Button>A</Button>
      <Button>B</Button>
      <Button>C</Button>
    </ButtonGroup>,
  );
  const radii = (loc: ReturnType<typeof c.getByRole>) =>
    loc.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        tl: s.borderTopLeftRadius,
        tr: s.borderTopRightRadius,
      };
    });

  const a = await radii(c.getByRole("button", { name: "A" }));
  const b = await radii(c.getByRole("button", { name: "B" }));
  const cc = await radii(c.getByRole("button", { name: "C" }));

  // First: rounded left side, square right side
  expect(a.tl).not.toBe("0px");
  expect(a.tr).toBe("0px");
  // Middle: square on both sides
  expect(b.tl).toBe("0px");
  expect(b.tr).toBe("0px");
  // Last: square left, rounded right
  expect(cc.tl).toBe("0px");
  expect(cc.tr).not.toBe("0px");
});

test("size on group cascades to children that don't set their own size", async ({ mount }) => {
  const c = await mount(
    <ButtonGroup size="lg">
      <Button>Inherits LG</Button>
      <Button size="sm">Explicit SM</Button>
    </ButtonGroup>,
  );
  const inheritedHeight = await c
    .getByRole("button", { name: "Inherits LG" })
    .evaluate((el) => getComputedStyle(el).blockSize);
  const explicitHeight = await c
    .getByRole("button", { name: "Explicit SM" })
    .evaluate((el) => getComputedStyle(el).blockSize);
  // LG = unit * 2 = 48px; SM = unit = 24px. Heights should differ.
  expect(parseFloat(inheritedHeight)).toBeGreaterThan(parseFloat(explicitHeight));
});
