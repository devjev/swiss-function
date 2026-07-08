import { expect, test } from "@playwright/experimental-ct-react";
import { Icon } from "./Icon";
import { Check, ChevronDown } from "./icons";

test("renders a 16x16 currentColor svg", async ({ mount }) => {
  const el = await mount(<Check />);
  await expect(el).toHaveAttribute("viewBox", "0 0 16 16");
  await expect(el).toHaveAttribute("stroke", "currentColor");
  await expect(el).toHaveAttribute("fill", "none");
});

test("is decorative by default (aria-hidden, no role)", async ({ mount }) => {
  const el = await mount(<ChevronDown />);
  await expect(el).toHaveAttribute("aria-hidden", "true");
  await expect(el).not.toHaveAttribute("role", "img");
});

test("a label makes it a titled, named image", async ({ mount }) => {
  const el = await mount(<Check label="Done" />);
  await expect(el).toHaveAttribute("role", "img");
  await expect(el).not.toHaveAttribute("aria-hidden", "true");
  await expect(el).toHaveAttribute("aria-label", "Done");
  await expect(el.getByText("Done")).toBeAttached(); // the <title>
});

test("size: a number is a --sf-unit multiple, a string is a raw length", async ({ mount }) => {
  const num = await mount(<Check size={1} />);
  await expect(num).toHaveAttribute("width", "calc(1 * var(--sf-unit))");
  await num.unmount();

  const str = await mount(<Check size="20px" />);
  await expect(str).toHaveAttribute("width", "20px");
  await str.unmount();

  const dflt = await mount(<Check />);
  await expect(dflt).toHaveAttribute("width", "1em");
});

test("the Icon primitive renders custom path children", async ({ mount }) => {
  const el = await mount(
    <Icon label="Bolt" strokeWidth={2}>
      <path d="M9 1 3 9h4l-1 6 6-8H8z" />
    </Icon>,
  );
  await expect(el).toHaveAttribute("stroke-width", "2");
  await expect(el.locator("path")).toHaveCount(1);
});
