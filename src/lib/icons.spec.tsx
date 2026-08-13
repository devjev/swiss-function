import { expect, test } from "@playwright/experimental-ct-react";
import {
  AdaptedDecorative,
  AdaptedLabelled,
  DefaultCheck,
  NestedMerge,
  OverrideCheckOnly,
} from "./icons.fixtures";

test("no provider: a slot resolves to its bespoke fallback", async ({ mount }) => {
  const el = await mount(<DefaultCheck />);
  // The bespoke Check on the 16-grid.
  await expect(el).toHaveAttribute("viewBox", "0 0 16 16");
  await expect(el).toHaveAttribute("stroke", "currentColor");
});

test("a provider override swaps only the mapped slot", async ({ mount }) => {
  const el = await mount(<OverrideCheckOnly />);
  // `check` is overridden -> the external 24-grid svg.
  await expect(el.getByTestId("external")).toHaveAttribute("viewBox", "0 0 24 24");
  // `close` is not mapped -> stays bespoke (16-grid).
  await expect(el.locator('svg[viewBox="0 0 16 16"]')).toHaveCount(1);
});

test("nested providers merge, child wins per slot", async ({ mount }) => {
  const el = await mount(<NestedMerge />);
  // Inner provider re-maps `check` to a bespoke glyph (16-grid); `close` still
  // resolves through the outer provider (external 24-grid).
  await expect(el.locator('svg[viewBox="0 0 16 16"]')).toHaveCount(1);
  await expect(el.getByTestId("external")).toHaveAttribute("viewBox", "0 0 24 24");
});

test("iconAdapter: labelled -> role=img + aria-label, size on the grid", async ({ mount }) => {
  const el = await mount(<AdaptedLabelled />);
  await expect(el).toHaveAttribute("role", "img");
  await expect(el).toHaveAttribute("aria-label", "Star");
  await expect(el).toHaveAttribute("width", "calc(2 * var(--sf-unit))");
  await expect(el).toHaveAttribute("height", "calc(2 * var(--sf-unit))");
});

test("iconAdapter: decorative -> aria-hidden, default 1em", async ({ mount }) => {
  const el = await mount(<AdaptedDecorative />);
  await expect(el).toHaveAttribute("aria-hidden", "true");
  await expect(el).not.toHaveAttribute("role", "img");
  await expect(el).toHaveAttribute("width", "1em");
});
