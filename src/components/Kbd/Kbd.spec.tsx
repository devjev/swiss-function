import { expect, test } from "@playwright/experimental-ct-react";
import { Kbd } from "./Kbd";

test("mod renders ⌘ on macOS and Ctrl elsewhere (no ⌘ off-Mac)", async ({ mount }) => {
  const mac = await mount(<Kbd combo="mod+k" mac />);
  await expect(mac).toContainText("⌘");
  await expect(mac).toContainText("K");
  await expect(mac).not.toContainText("Ctrl");
  await mac.unmount();

  const other = await mount(<Kbd combo="mod+k" mac={false} />);
  await expect(other).toContainText("Ctrl");
  await expect(other).toContainText("K");
  await expect(other).not.toContainText("⌘");
});

test("macOS glyphs read as a unit; off-Mac joins modifiers with +", async ({ mount }) => {
  const mac = await mount(<Kbd combo="mod+shift+k" mac />);
  await expect(mac).toHaveText("⌘⇧K");
  await mac.unmount();

  const other = await mount(<Kbd combo="mod+shift+k" mac={false} />);
  await expect(other).toHaveText("Ctrl+Shift+K");
});

test("a space separates the steps of a sequence; each step is its own keys", async ({ mount }) => {
  const c = await mount(<Kbd combo="g u" mac={false} />);
  await expect(c.locator("kbd")).toHaveCount(2);
  await expect(c).toHaveText("GU");
  await c.unmount();

  // Spaces around a `+` still read as one chord.
  const chord = await mount(<Kbd combo="mod + k" mac={false} />);
  await expect(chord).toHaveText("Ctrl+K");
});

test("variant=outline draws a flat ruled key with no cast", async ({ mount }) => {
  const c = await mount(<Kbd combo="mod+k" mac={false} variant="outline" />);
  await expect(c).toHaveAttribute("data-variant", "outline");
  const key = c.locator("kbd").first();
  const s = await key.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { shadow: cs.boxShadow, border: cs.borderTopWidth, children: el.children.length };
  });
  expect(s.shadow).toBe("none");
  expect(s.border).toBe("1px");
  // No face element: the legend alone.
  expect(s.children).toBe(1);
});

test("named keys and arrows resolve to glyphs", async ({ mount }) => {
  const c = await mount(<Kbd combo="alt+arrowup" mac />);
  await expect(c).toHaveText("⌥↑");
});
