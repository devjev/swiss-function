import type { Story } from "@ladle/react";
import { NonIdealState } from "../NonIdealState";
import { Fullscreen } from "./Fullscreen";

// Click the corner button to fill the viewport; Escape (or the button) exits.
export const Default: Story = () => (
  <Fullscreen style={{ border: "1px solid var(--sf-color-border-subtle)" }}>
    <div style={{ padding: "calc(var(--sf-unit) * 2)" }}>
      <p style={{ margin: 0, color: "var(--sf-color-fg)" }}>
        Any content. Hit the fullscreen button (top-right) to expand to the whole viewport.
      </p>
    </div>
  </Fullscreen>
);

// A single child stretches to 100% when expanded — here a NonIdealState fills
// the screen (no explicit height needed; the expanded grid cell stretches it).
export const WithNonIdealState: Story = () => (
  <Fullscreen>
    <NonIdealState
      effect="plasma"
      speed={0.5}
      title="Maximize me"
      description="Click the fullscreen button — this block stretches to fill the viewport."
    />
  </Fullscreen>
);

export const ButtonBottomLeft: Story = () => (
  <Fullscreen
    buttonPosition="bottom-left"
    style={{ border: "1px solid var(--sf-color-border-subtle)" }}
  >
    <NonIdealState effect="grid" speed={0.5} title="Bottom-left toggle" />
  </Fullscreen>
);
