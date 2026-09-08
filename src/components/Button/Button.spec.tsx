import { expect, test } from "@playwright/experimental-ct-react";
import { Play, Power } from "../Icon";
import { Button } from "./Button";

test("renders its label", async ({ mount }) => {
  const component = await mount(<Button>Save</Button>);
  await expect(component).toHaveText("Save");
});

test("fires click handler", async ({ mount }) => {
  let clicked = 0;
  const component = await mount(
    <Button
      onClick={() => {
        clicked += 1;
      }}
    >
      Save
    </Button>,
  );
  await component.click();
  expect(clicked).toBe(1);
});

test("respects disabled", async ({ mount }) => {
  const component = await mount(<Button disabled>Save</Button>);
  await expect(component).toBeDisabled();
  await expect(component).toHaveAttribute("data-disabled", "true");
});

test("applies variant class", async ({ mount }) => {
  const component = await mount(<Button variant="danger">Delete</Button>);
  const className = await component.getAttribute("class");
  expect(className).toMatch(/variantDanger/);
});

test("the solid build renders a cap with a swept side wall and travels onto it on press", async ({
  mount,
  page,
}) => {
  const component = await mount(
    <Button build="solid" size="md">
      Record
    </Button>,
  );
  await expect(component).toHaveAttribute("data-build", "solid");
  await expect(component).toHaveText("Record");
  const face = component.locator('[class*="face"]');
  await expect(face).toHaveCount(1);
  // The wall layers: offset, zero blur and spread, not inset (the edge bands end in "inset").
  const layers = (shadow: string) => shadow.match(/[1-9]\d*px [1-9]\d*px 0px 0px(?=,|$)/g) ?? [];
  // Four one-pixel steps from the cap down to the base, the deepest at 4px.
  const rest = await face.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(layers(rest)).toHaveLength(4);
  expect(rest).toContain("4px 4px 0px");
  expect(await face.evaluate((el) => getComputedStyle(el).translate)).toBe("none");
  const box = await face.boundingBox();
  if (!box) throw new Error("no face");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // The cap travels one pixel short of the height; the wall collapses to that pixel.
  await expect.poll(() => face.evaluate((el) => getComputedStyle(el).translate)).toBe("3px 3px");
  await expect
    .poll(() => face.evaluate((el) => getComputedStyle(el).boxShadow))
    .not.toContain("4px 4px 0px");
  expect(await face.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("1px 1px 0px");
  await page.mouse.up();
  await expect.poll(() => face.evaluate((el) => getComputedStyle(el).translate)).toBe("none");
});

test("a latched solid key sits down and a ghost stays a sheet", async ({ mount }) => {
  const latched = await mount(
    <Button build="solid" variant="secondary" aria-pressed="true">
      Loudness
    </Button>,
  );
  const face = latched.locator('[class*="face"]');
  expect(await face.evaluate((el) => getComputedStyle(el).translate)).toBe("3px 3px");
  await latched.unmount();
  const ghost = await mount(
    <Button build="solid" variant="ghost">
      Ghost
    </Button>,
  );
  await expect(ghost).not.toHaveAttribute("data-build", "solid");
  await expect(ghost.locator('[class*="face"]')).toHaveCount(0);
});

test("a round solid key is a circle of the size's height inside its ring", async ({ mount }) => {
  const component = await mount(
    <Button build="solid" round aria-label="Power" size="lg">
      P
    </Button>,
  );
  const box = await component.boundingBox();
  if (!box) throw new Error("no box");
  // lg is 2u = 48px, plus the 6px wall ring on each side.
  expect(Math.round(box.width)).toBe(60);
  expect(Math.round(box.height)).toBe(60);
  const face = await component.locator('[class*="face"]').boundingBox();
  if (!face) throw new Error("no face");
  expect(Math.round(face.width)).toBe(48);
  expect(Math.round(face.x - box.x)).toBe(6);
  const radius = await component.evaluate((el) => getComputedStyle(el).borderRadius);
  expect(radius).not.toBe("2px");
});

test("a pressed round solid key sinks into its ring instead of sliding", async ({
  mount,
  page,
}) => {
  const component = await mount(
    <Button build="solid" round aria-label="Power" size="lg">
      P
    </Button>,
  );
  const face = component.locator('[class*="face"]');
  const box = await face.boundingBox();
  if (!box) throw new Error("no face");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => face.evaluate((el) => getComputedStyle(el).translate)).toBe("1px 1px");
  await page.mouse.up();
  await expect.poll(() => face.evaluate((el) => getComputedStyle(el).translate)).toBe("none");
});

test("a round key centres its label on the glyph's ink, text and icon alike", async ({ mount }) => {
  const text = await mount(
    <Button build="solid" round aria-label="Mute" size="lg">
      M
    </Button>,
  );
  const glyph = text.locator('[class*="glyph"]');
  await expect(glyph).toHaveCount(1);
  // A measured offset is applied inline; a capital sits high in its box, so it moves down.
  await expect
    .poll(() => glyph.evaluate((el) => (el as HTMLElement).style.translate))
    .toMatch(/px/);
  const [, dy] = await glyph.evaluate((el) =>
    (el as HTMLElement).style.translate.split(" ").map(Number.parseFloat),
  );
  expect(dy).toBeGreaterThan(0);
  await text.unmount();
  const icon = await mount(
    <Button build="solid" round aria-label="Play" size="lg">
      <Play />
    </Button>,
  );
  await expect(icon.locator("svg")).toHaveCount(1);
  const iconGlyph = icon.locator('[class*="glyph"]');
  await expect
    .poll(() => iconGlyph.evaluate((el) => (el as HTMLElement).style.translate))
    .toMatch(/px/);
  // The play triangle's ink sits right of its viewBox centre, so it moves left.
  const [dx] = await iconGlyph.evaluate((el) =>
    (el as HTMLElement).style.translate.split(" ").map(Number.parseFloat),
  );
  expect(dx).toBeLessThan(0);
});
