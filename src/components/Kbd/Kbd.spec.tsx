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

test("named keys and arrows resolve to glyphs", async ({ mount }) => {
  const c = await mount(<Kbd combo="alt+arrowup" mac />);
  await expect(c).toHaveText("⌥↑");
});
