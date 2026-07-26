import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stackZ, Z_LAYER } from "./stacking";

describe("stackZ", () => {
  it("keeps a leaf floater transparent at the document root", () => {
    // No inline z (CSS default stands) and it publishes nothing, so nested
    // floaters at the root also stay on their CSS defaults.
    expect(stackZ(0, Z_LAYER.dropdown, false)).toEqual({ zIndex: undefined, ceiling: 0 });
  });

  it("keeps a container on its CSS default at the root but publishes its band", () => {
    // A Dialog at the root paints via CSS (--sf-z-modal) yet still tells its
    // descendants the floor is 1200.
    expect(stackZ(0, Z_LAYER.modal, true)).toEqual({ zIndex: undefined, ceiling: 1200 });
  });

  it("lifts a leaf floater just above its host overlay", () => {
    // A Picker inside a Dialog (ceiling 1200) climbs to 1210 and passes that on.
    expect(stackZ(Z_LAYER.modal, Z_LAYER.dropdown, false)).toEqual({ zIndex: 1210, ceiling: 1210 });
  });

  it("stacks nested leaf floaters within the band", () => {
    // A menu opened from inside that Picker's popup climbs again.
    expect(stackZ(1210, Z_LAYER.dropdown, false)).toEqual({ zIndex: 1220, ceiling: 1220 });
  });

  it("jumps a nested container a full band above its host", () => {
    // A Dialog opened inside another Dialog clears the first dialog's floaters.
    expect(stackZ(Z_LAYER.modal, Z_LAYER.modal, true)).toEqual({ zIndex: 1300, ceiling: 1300 });
  });

  it("lifts a Popover-band container above a modal host", () => {
    // A Popover opened inside a Dialog: max(1200 + 100, 1300) = 1300.
    expect(stackZ(Z_LAYER.modal, Z_LAYER.popover, true)).toEqual({ zIndex: 1300, ceiling: 1300 });
  });

  it("lets a floater clear a Popover host even at the root", () => {
    // Popover seeds its 1300 band at the root; a Combobox inside climbs to 1310.
    const popover = stackZ(0, Z_LAYER.popover, true);
    expect(popover.ceiling).toBe(1300);
    expect(stackZ(popover.ceiling, Z_LAYER.dropdown, false).zIndex).toBe(1310);
  });
});

describe("Z_LAYER stays in lockstep with tokens.css", () => {
  it("mirrors every --sf-z-* value", () => {
    const css = readFileSync(
      fileURLToPath(new URL("../tokens/tokens.css", import.meta.url)),
      "utf8",
    );
    for (const [name, value] of Object.entries(Z_LAYER)) {
      const match = css.match(new RegExp(`--sf-z-${name}:\\s*(\\d+)`));
      expect(match, `--sf-z-${name} missing from tokens.css`).not.toBeNull();
      expect(Number(match?.[1]), `--sf-z-${name} drifted from Z_LAYER.${name}`).toBe(value);
    }
  });
});
