import { expect, test } from "@playwright/experimental-ct-react";
import { DigitInputMicro } from "./DigitInputMicro";

// Variable-length numeric input: a real text input with faded placeholder slots
// that recede as you type. Value is number | null.

test("fills slots left-to-right and reports parsed numbers", async ({ mount }) => {
  const seen: (number | null)[] = [];
  const c = await mount(<DigitInputMicro slots={4} onValueChange={(v) => seen.push(v)} />);
  const input = c.locator("input");
  await input.focus();
  await input.pressSequentially("42");
  await expect(input).toHaveValue("42");
  expect(seen).toEqual([4, 42]);
});

test("rejects non-numeric characters", async ({ mount }) => {
  const c = await mount(<DigitInputMicro slots={4} />);
  const input = c.locator("input");
  await input.focus();
  await input.pressSequentially("1a2b3");
  await expect(input).toHaveValue("123");
});

test("grows past the slot count", async ({ mount }) => {
  const c = await mount(<DigitInputMicro slots={2} />);
  const input = c.locator("input");
  await input.focus();
  await input.pressSequentially("123456");
  await expect(input).toHaveValue("123456");
});

test("integer-only by default drops the decimal point", async ({ mount }) => {
  const c = await mount(<DigitInputMicro slots={4} />);
  const input = c.locator("input");
  await input.focus();
  await input.pressSequentially("1.5");
  await expect(input).toHaveValue("15");
});

test("decimals allows one capped decimal point", async ({ mount }) => {
  const seen: (number | null)[] = [];
  const c = await mount(
    <DigitInputMicro slots={4} decimals={2} onValueChange={(v) => seen.push(v)} />,
  );
  const input = c.locator("input");
  await input.focus();
  await input.pressSequentially("1.239");
  await expect(input).toHaveValue("1.23");
  expect(seen.at(-1)).toBe(1.23);
});

test("clamps to min/max on blur", async ({ mount }) => {
  const seen: (number | null)[] = [];
  const c = await mount(
    <DigitInputMicro slots={3} min={0} max={100} onValueChange={(v) => seen.push(v)} />,
  );
  const input = c.locator("input");
  await input.focus();
  await input.pressSequentially("250");
  await input.blur();
  await expect(input).toHaveValue("100");
  expect(seen.at(-1)).toBe(100);
});

test("controlled value renders and updates", async ({ mount }) => {
  const c = await mount(<DigitInputMicro slots={4} value={42} />);
  await expect(c.locator("input")).toHaveValue("42");
});

test("renders a unit suffix", async ({ mount }) => {
  const c = await mount(<DigitInputMicro slots={3} unit="%" defaultValue={50} />);
  await expect(c.getByText("%")).toBeVisible();
});
