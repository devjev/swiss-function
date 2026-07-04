import { expect, test } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import { Field } from "../Field";
import { DigitInput } from "./DigitInput";

// Calculator model pins: digits push in from the right, Backspace pops,
// Delete clears to the pristine mask, Arrow keys step the last place. The
// whole control is ONE focus target (a hidden overlay input).

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const cellsText = (c: { locator: (sel: string) => Locator }) =>
  c.locator("[data-cell]").allTextContents();

test("digits push in from the right; onValueChange reports complete values", async ({ mount }) => {
  const seen: (number | null)[] = [];
  const c = await mount(
    <DigitInput digits={3} decimals={2} unit="%" onValueChange={(v) => seen.push(v)} />,
  );
  const input = c.locator("input");
  await input.focus();
  await input.press("4");
  await expect(c.locator("[data-cell]").last()).toHaveText("4");
  await input.press("2");
  await input.press("5");
  expect(await cellsText(c)).toEqual(["0", "0", "4", "2", "5"]);
  expect(seen).toEqual([0.04, 0.42, 4.25]);
});

test("Backspace pops to pristine; the mask shows underscores and value is null", async ({
  mount,
}) => {
  const seen: (number | null)[] = [];
  const c = await mount(<DigitInput digits={2} decimals={0} onValueChange={(v) => seen.push(v)} />);
  const input = c.locator("input");
  await input.focus();
  await input.press("7");
  await input.press("Backspace");
  expect(await cellsText(c)).toEqual(["_", "_"]);
  expect(seen).toEqual([7, null]);
});

test("Delete clears to pristine in one keystroke (cash-register C)", async ({ mount }) => {
  const c = await mount(<DigitInput digits={3} decimals={0} defaultValue={123} />);
  const input = c.locator("input");
  await input.focus();
  await input.press("Delete");
  expect(await cellsText(c)).toEqual(["_", "_", "_"]);
});

test("typing at full significant capacity is ignored", async ({ mount }) => {
  const c = await mount(<DigitInput digits={2} decimals={0} defaultValue={99} />);
  const input = c.locator("input");
  await input.focus();
  await input.press("5");
  expect(await cellsText(c)).toEqual(["9", "9"]);
});

test("ArrowUp/Down step one least-significant unit and clamp at the ends", async ({ mount }) => {
  const c = await mount(<DigitInput digits={1} decimals={1} defaultValue={0.1} />);
  const input = c.locator("input");
  await input.focus();
  await input.press("ArrowUp");
  expect(await cellsText(c)).toEqual(["0", "2"]);
  await input.press("ArrowDown");
  await input.press("ArrowDown");
  await input.press("ArrowDown"); // clamp at 0
  expect(await cellsText(c)).toEqual(["0", "0"]);
  await expect(input).toHaveAttribute("aria-valuenow", "0");
});

test("Arrow from pristine un-pristines: down → 0, up → 1 ulp", async ({ mount }) => {
  const c = await mount(<DigitInput digits={2} decimals={1} />);
  const input = c.locator("input");
  await input.focus();
  await input.press("ArrowUp");
  expect(await cellsText(c)).toEqual(["0", "0", "1"]);
});

test("paste parses separators and unit noise; clamps to capacity", async ({ mount, page }) => {
  const c = await mount(<DigitInput digits={3} decimals={2} unit="%" />);
  const input = c.locator("input");
  await input.focus();
  await page.evaluate(() => navigator.clipboard.writeText("42.5 %"));
  await page.keyboard.press("ControlOrMeta+v");
  expect(await cellsText(c)).toEqual(["0", "4", "2", "5", "0"]);

  await page.evaluate(() => navigator.clipboard.writeText("12345.67"));
  await page.keyboard.press("ControlOrMeta+v");
  expect(await cellsText(c)).toEqual(["9", "9", "9", "9", "9"]); // clamped
});

test("paste respects a comma display separator", async ({ mount, page }) => {
  const c = await mount(<DigitInput digits={3} decimals={2} decimalSeparator="," />);
  const input = c.locator("input");
  await input.focus();
  await page.evaluate(() => navigator.clipboard.writeText("12,5"));
  await page.keyboard.press("ControlOrMeta+v");
  expect(await cellsText(c)).toEqual(["0", "1", "2", "5", "0"]);
  // The separator glyph is display-only; the machine value stays canonical.
  await expect(c.locator("input")).toHaveValue("12.50");
});

test("controlled: numbers render zero-padded, null renders the mask, overflow clamps", async ({
  mount,
}) => {
  // The dev-only clamp warning can't be asserted here: Playwright CT bundles
  // in production mode, which compiles the NODE_ENV guard out. The clamped
  // flag itself is pinned in digitMath.test.ts.
  const zero = await mount(<DigitInput digits={3} decimals={2} value={4.25} />);
  expect(await cellsText(zero)).toEqual(["0", "0", "4", "2", "5"]);
  await zero.unmount();

  const masked = await mount(<DigitInput digits={3} decimals={2} value={null} />);
  expect(await cellsText(masked)).toEqual(["_", "_", "_", "_", "_"]);
  await masked.unmount();

  const clamped = await mount(<DigitInput digits={3} decimals={2} value={12345} />);
  expect(await cellsText(clamped)).toEqual(["9", "9", "9", "9", "9"]);
});

test("spinbutton semantics update as the value changes", async ({ mount }) => {
  const c = await mount(<DigitInput digits={3} decimals={2} unit="%" />);
  const input = c.locator("input");
  await expect(input).toHaveAttribute("role", "spinbutton");
  await expect(input).toHaveAttribute("aria-valuemax", "999.99");
  await expect(input).toHaveAttribute("aria-valuetext", "blank");
  await input.focus();
  await input.press("4");
  await input.press("2");
  await expect(input).toHaveAttribute("aria-valuenow", "0.42");
  await expect(input).toHaveAttribute("aria-valuetext", "0.42 %");
});

test("Field wires the label and description to the hidden input", async ({ mount }) => {
  const c = await mount(
    <Field>
      <Field.Label>Discount</Field.Label>
      <DigitInput digits={2} decimals={1} unit="%" />
      <Field.Description>Steps of 0.1</Field.Description>
    </Field>,
  );
  const input = c.locator("input");
  const id = await input.getAttribute("id");
  expect(id).toBeTruthy();
  await expect(c.locator("label")).toHaveAttribute("for", id as string);
  const describedBy = await input.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  await expect(c.locator(`[id="${describedBy}"]`)).toHaveText("Steps of 0.1");
  // Clicking the label focuses the control.
  await c.locator("label").click();
  await expect(input).toBeFocused();
});

test("clicking anywhere on the control focuses it; the active cell becomes a block caret", async ({
  mount,
}) => {
  const c = await mount(<DigitInput digits={3} decimals={0} defaultValue={42} />);
  await c.click();
  const input = c.locator("input");
  await expect(input).toBeFocused();
  const active = c.locator("[data-active]");
  const bg = await active.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe("rgb(37, 99, 235)"); // --sf-color-primary
});

test("no focus ring — the block caret is the focus indicator", async ({ mount, page }) => {
  const c = await mount(<DigitInput digits={3} decimals={0} />);
  await page.keyboard.press("Tab");
  await expect(c.locator("input")).toBeFocused();
  // Deliberate exception to the --sf-focus-ring-* convention: no outline...
  const outline = await c.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).toBe("none");
  // ...because the active cell renders as an inverse-video block caret.
  const bg = await c
    .locator("[data-active]")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe("rgb(37, 99, 235)"); // --sf-color-primary
});

test("cells are monospace with the size-adjust pairing", async ({ mount }) => {
  const c = await mount(<DigitInput digits={2} decimals={0} />);
  const cell = c.locator("[data-cell]").first();
  const family = await cell.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toContain("JetBrains Mono");
});

test("disabled control is not focusable; readOnly keeps value fixed", async ({ mount }) => {
  const disabled = await mount(<DigitInput digits={2} decimals={0} defaultValue={7} disabled />);
  await expect(disabled.locator("input")).toBeDisabled();
  await disabled.unmount();

  const ro = await mount(<DigitInput digits={2} decimals={0} defaultValue={7} readOnly />);
  const input = ro.locator("input");
  await input.focus();
  await input.press("9");
  await input.press("Backspace");
  expect(await cellsText(ro)).toEqual(["0", "7"]);
});

test("participates in forms with the canonical value; reset restores the default", async ({
  mount,
}) => {
  const c = await mount(
    <form data-testid="f">
      <DigitInput digits={3} decimals={2} name="pct" defaultValue={4.25} />
      <button type="reset">Reset</button>
    </form>,
  );
  const formValue = () =>
    c.evaluate((el) => {
      const data = new FormData(el.querySelector("form") ?? (el as HTMLFormElement));
      return data.get("pct");
    });
  expect(await formValue()).toBe("4.25");

  const input = c.locator("input");
  await input.focus();
  await input.press("9");
  expect(await formValue()).toBe("42.59");

  await c.locator("button[type='reset']").click();
  await expect(input).toHaveValue("4.25");
  expect(await cellsText(c)).toEqual(["0", "0", "4", "2", "5"]);
});

test("elevation cascades to the cells via data-elevation", async ({ mount }) => {
  const c = await mount(<DigitInput digits={2} decimals={0} elevation={0} />);
  await expect(c).toHaveAttribute("data-elevation", "0");
  const shadow = await c
    .locator("[data-cell]")
    .first()
    .evaluate((el) => getComputedStyle(el).boxShadow);
  // elevation 0 keeps only the inset highlight — no drop shadow component.
  expect(shadow).toContain("inset");
  expect(shadow.split("inset").length).toBe(2);
});

/* --- Mask mode (2FA style, mode="mask") --- */

test("mask: typing fills left-to-right with auto-advance; value is null until complete", async ({
  mount,
  page,
}) => {
  const seen: (number | null)[] = [];
  const c = await mount(
    <DigitInput mode="mask" digits={3} decimals={2} unit="%" onValueChange={(v) => seen.push(v)} />,
  );
  const cells = c.locator("[data-cell]");
  await expect(cells).toHaveCount(5);
  await cells.first().click();
  await page.keyboard.type("425");
  // Focus auto-advanced past the typed cells; partial fill reports nothing yet.
  await expect(cells.nth(3)).toBeFocused();
  expect(seen).toEqual([]);
  await page.keyboard.type("50");
  await expect(cells.nth(0)).toHaveValue("4");
  await expect(cells.nth(4)).toHaveValue("0");
  expect(seen).toEqual([425.5]); // fires exactly once, on completion
});

test("mask: Backspace steps back and re-opens the value to null", async ({ mount, page }) => {
  const seen: (number | null)[] = [];
  const c = await mount(
    <DigitInput mode="mask" digits={2} decimals={0} onValueChange={(v) => seen.push(v)} />,
  );
  const cells = c.locator("[data-cell]");
  await cells.first().click();
  await page.keyboard.type("42");
  expect(seen).toEqual([42]);
  await page.keyboard.press("Backspace");
  expect(seen).toEqual([42, null]);
});

test("mask: pasting text WITH a separator fills positionally", async ({ mount, page }) => {
  const c = await mount(<DigitInput mode="mask" digits={3} decimals={2} />);
  const cells = c.locator("[data-cell]");
  await cells.first().click();
  await page.evaluate(() => navigator.clipboard.writeText("12.34"));
  await page.keyboard.press("ControlOrMeta+v");
  await expect(cells.nth(0)).toHaveValue("0");
  await expect(cells.nth(1)).toHaveValue("1");
  await expect(cells.nth(2)).toHaveValue("2");
  await expect(cells.nth(3)).toHaveValue("3");
  await expect(cells.nth(4)).toHaveValue("4");
});

test("mask: plain-digit paste keeps OTP's native left-to-right fill", async ({ mount, page }) => {
  const c = await mount(<DigitInput mode="mask" digits={3} decimals={2} />);
  const cells = c.locator("[data-cell]");
  await cells.first().click();
  await page.evaluate(() => navigator.clipboard.writeText("425"));
  await page.keyboard.press("ControlOrMeta+v");
  await expect(cells.nth(0)).toHaveValue("4");
  await expect(cells.nth(2)).toHaveValue("5");
  await expect(cells.nth(3)).toHaveValue("");
});

test("mask: the focused cell renders as the block caret; empty cells show the underscore placeholder", async ({
  mount,
}) => {
  const c = await mount(<DigitInput mode="mask" digits={3} decimals={0} />);
  const first = c.locator("[data-cell]").first();
  await expect(first).toHaveAttribute("placeholder", "_");
  await first.click();
  const bg = await first.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe("rgb(37, 99, 235)"); // --sf-color-primary
});

test("mask: controlled numbers render complete; external null clears", async ({ mount }) => {
  const filled = await mount(<DigitInput mode="mask" digits={3} decimals={2} value={4.25} />);
  await expect(filled.locator("[data-cell]").nth(2)).toHaveValue("4");
  await filled.unmount();

  const empty = await mount(<DigitInput mode="mask" digits={3} decimals={2} value={null} />);
  await expect(empty.locator("[data-cell]").first()).toHaveValue("");
});

test("mask: participates in forms via the hidden validation input", async ({ mount, page }) => {
  const c = await mount(
    <form>
      <DigitInput mode="mask" digits={2} decimals={0} name="code" />
    </form>,
  );
  await c.locator("[data-cell]").first().click();
  await page.keyboard.type("42");
  const value = await c.evaluate((el) => {
    const form = el.closest("form") ?? el.querySelector("form");
    return form ? String(new FormData(form).get("code")) : null;
  });
  expect(value).toBe("42");
});
