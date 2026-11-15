import { expect, test } from "@playwright/experimental-ct-react";
import { Chip } from "./Chip";

test("renders its label and is a plain span by default (not a button)", async ({ mount }) => {
  const chip = await mount(<Chip>design</Chip>);
  await expect(chip).toHaveText("design");
  // Neutral tone leaves data-tone unset, and a non-interactive chip has no role.
  await expect(chip).not.toHaveAttribute("role", "button");
});

test("a tone sets data-tone; neutral does not", async ({ mount }) => {
  const danger = await mount(<Chip tone="danger">error</Chip>);
  await expect(danger).toHaveAttribute("data-tone", "danger");
  await danger.unmount();

  const neutral = await mount(<Chip tone="neutral">plain</Chip>);
  await expect(neutral).not.toHaveAttribute("data-tone", "neutral");
});

test("variant=solid fills the chip with its tone and sets the label in the on-fill colour", async ({
  mount,
}) => {
  const c = await mount(
    <div>
      <Chip tone="danger">outline</Chip>
      <Chip tone="danger" variant="solid" dot>
        solid
      </Chip>
      <Chip variant="solid">ink</Chip>
    </div>,
  );
  const style = (name: string) =>
    c.getByText(name, { exact: true }).evaluate((el) => {
      const chip = el.parentElement as HTMLElement;
      const s = getComputedStyle(chip);
      const dot = chip.querySelector("[aria-hidden='true']");
      return {
        variant: chip.getAttribute("data-variant"),
        bg: s.backgroundColor,
        color: s.color,
        border: s.borderTopColor,
        dot: dot ? getComputedStyle(dot).backgroundColor : null,
      };
    });
  const outline = await style("outline");
  const solid = await style("solid");
  const ink = await style("ink");
  expect(outline.variant).toBeNull();
  expect(solid.variant).toBe("solid");
  // The fill is the outline form's label colour; in the light theme the label
  // on it is the page colour.
  expect(solid.bg).toBe(outline.color);
  expect(solid.color).toBe(outline.bg);
  expect(solid.border).toBe(solid.bg);
  expect(solid.dot).toBe(solid.color);
  // Neutral solid is ink on the page colour, inverted.
  expect(ink.color).toBe(outline.bg);
  expect(ink.bg).not.toBe(solid.bg);
});

test("onClick makes it a keyboard-activatable button", async ({ mount }) => {
  let clicks = 0;
  const chip = await mount(<Chip onClick={() => (clicks += 1)}>filter</Chip>);
  await expect(chip).toHaveAttribute("role", "button");
  await expect(chip).toHaveAttribute("tabindex", "0");
  await chip.click();
  expect(clicks).toBe(1);
  await chip.press("Enter");
  expect(clicks).toBe(2);
});

test("remove button fires onRemove and does not bubble to the chip onClick", async ({ mount }) => {
  let removed = 0;
  let clicked = 0;
  const chip = await mount(
    <Chip onClick={() => (clicked += 1)} onRemove={() => (removed += 1)}>
      tag
    </Chip>,
  );
  await chip.getByRole("button", { name: "Remove" }).click();
  expect(removed).toBe(1);
  expect(clicked).toBe(0);
});

test("disabled blocks onClick", async ({ mount }) => {
  let clicks = 0;
  const chip = await mount(
    <Chip disabled onClick={() => (clicks += 1)}>
      nope
    </Chip>,
  );
  await expect(chip).toHaveAttribute("data-disabled", "true");
  await chip.click({ force: true });
  expect(clicks).toBe(0);
});
