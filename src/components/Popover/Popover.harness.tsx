import { Popover } from "./Popover";

// Reproduces the trapped-z-index scenario (issue #5): an open popup overlapping a
// sibling that forms its own stacking context with a positive z-index. Before the
// fix the positioner sat at `z-index: auto` (its inline transform trapped the
// popup's z-index), so the blocker painted over the popup.
export function PopoverZIndexHarness() {
  return (
    <div style={{ position: "relative", padding: 8 }}>
      <Popover.Root defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={4}>
            <Popover.Popup>
              <div data-testid="popup-content" style={{ inlineSize: 200, blockSize: 140 }}>
                Panel
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <div
        data-testid="blocker"
        style={{ position: "relative", zIndex: 5, marginTop: 4, height: 220, background: "#fff" }}
      />
    </div>
  );
}
