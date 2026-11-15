import { expect, test } from "@playwright/experimental-ct-react";
import { DEFAULT_UNIT_PX as U } from "../../lib/useCssPx";
import { Box } from "./Box";

test("default render: <div> with border + radius + 1u padding", async ({ mount }) => {
  const component = await mount(<Box>hi</Box>);
  await expect(component).toHaveJSProperty("tagName", "DIV");
  const padding = await component.evaluate((el) => getComputedStyle(el).padding);
  expect(padding).toBe(`${U}px`);
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

test("padding={0.5} is half a unit", async ({ mount }) => {
  const component = await mount(<Box padding={0.5}>x</Box>);
  const p = await component.evaluate((el) => getComputedStyle(el).padding);
  expect(p).toBe(`${U / 2}px`);
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
