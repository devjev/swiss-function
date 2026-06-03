import { expect, test } from "@playwright/experimental-ct-react";
import { Box } from "./Box";

test("default render: <div> with border + radius + 1u padding", async ({ mount }) => {
  const component = await mount(<Box>hi</Box>);
  await expect(component).toHaveJSProperty("tagName", "DIV");
  const padding = await component.evaluate((el) => getComputedStyle(el).padding);
  expect(padding).toBe("24px");
});

test("data-elevation reflects the prop; box-shadow non-empty for >0", async ({ mount }) => {
  const component = await mount(<Box elevation={3}>x</Box>);
  await expect(component).toHaveAttribute("data-elevation", "3");
  const shadow = await component.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).not.toBe("none");
});

test("elevation={0} has no shadow", async ({ mount }) => {
  const component = await mount(<Box>x</Box>);
  const shadow = await component.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).toBe("none");
});

test("texture prop sets data-texture", async ({ mount }) => {
  const component = await mount(<Box texture>x</Box>);
  await expect(component).toHaveAttribute("data-texture", "true");
});

test("texture absent when not set", async ({ mount }) => {
  const component = await mount(<Box>x</Box>);
  await expect(component).not.toHaveAttribute("data-texture", /.*/);
});

test("padding={0.5} → 12px", async ({ mount }) => {
  const component = await mount(<Box padding={0.5}>x</Box>);
  const p = await component.evaluate((el) => getComputedStyle(el).padding);
  expect(p).toBe("12px");
});

test("padding accepts a raw CSS string", async ({ mount }) => {
  const component = await mount(<Box padding="20px">x</Box>);
  const p = await component.evaluate((el) => getComputedStyle(el).padding);
  expect(p).toBe("20px");
});

test("render prop renders the requested element", async ({ mount }) => {
  const component = await mount(<Box render={<section />}>x</Box>);
  await expect(component).toHaveJSProperty("tagName", "SECTION");
});
