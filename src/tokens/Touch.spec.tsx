import { expect, test } from "@playwright/experimental-ct-react";
import { Button } from "../components/Button";
import { Checkbox } from "../components/Checkbox";
import { Input } from "../components/Input";

// Pins the touch contract (tokens.css → Pointer): a device whose primary
// pointer is a finger gets the touch tokens and the comfortable density; a
// mouse gets neither. The hit area of a small control is its `::after`
// (lib/hitArea), so the control itself keeps its size.

const sample = (
  <div>
    <Button size="sm">Go</Button>
    <Checkbox aria-label="Agree" />
    <Input inputSize="sm" aria-label="Query" />
  </div>
);

const metrics = (root: Element) => {
  const px = (value: string) => Number.parseFloat(value);
  const button = root.querySelector("button") as HTMLElement;
  const checkbox = root.querySelector('[role="checkbox"]') as HTMLElement;
  // By name: the checkbox carries a hidden native input of its own.
  const input = root.querySelector('input[aria-label="Query"]') as HTMLElement;
  const after = (el: Element) => getComputedStyle(el, "::after");
  return {
    coarse: matchMedia("(pointer: coarse)").matches,
    hitMin: getComputedStyle(root).getPropertyValue("--sf-hit-min").trim(),
    font: px(getComputedStyle(root).fontSize),
    button: button.getBoundingClientRect().height,
    buttonHit: px(after(button).height),
    checkbox: checkbox.getBoundingClientRect().width,
    checkboxHit: [px(after(checkbox).width), px(after(checkbox).height)],
    inputFont: px(getComputedStyle(input).fontSize),
  };
};

test.describe("with a finger", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 700 } });

  test("the touch tokens and the comfortable density apply", async ({ mount }) => {
    const c = await mount(sample);
    const m = await c.evaluate(metrics);
    expect(m.coarse).toBe(true);
    expect(m.font).toBe(16);
    // The small key is one comfortable unit tall and answers on 44px.
    expect(m.button).toBe(24);
    expect(m.buttonHit).toBe(44);
    // The checkbox keeps its size; its hit area is 44 by 44.
    expect(m.checkbox).toBe(18);
    expect(m.checkboxHit).toEqual([44, 44]);
    // A small field would be 14px: the floor holds it at 16, under which iOS
    // zooms the page on focus.
    expect(m.inputFont).toBe(16);
  });

  test("an explicit density wins; the touch tokens stay", async ({ mount }) => {
    const c = await mount(<div data-density="compact">{sample}</div>);
    const m = await c.evaluate(metrics);
    expect(m.font).toBe(14);
    expect(m.button).toBe(20);
    expect(m.buttonHit).toBe(44);
    expect(m.inputFont).toBe(16);
  });
});

test("with a mouse nothing grows", async ({ mount }) => {
  const c = await mount(sample);
  const m = await c.evaluate(metrics);
  expect(m.coarse).toBe(false);
  expect(m.hitMin).toBe("0px");
  expect(m.font).toBe(14);
  expect(m.button).toBe(20);
  // The pseudo-element is the control's own padding box: nothing outside it.
  expect(m.buttonHit).toBeLessThanOrEqual(20);
  expect(Math.max(...m.checkboxHit)).toBeLessThanOrEqual(15);
  expect(m.inputFont).toBe(12);
});
