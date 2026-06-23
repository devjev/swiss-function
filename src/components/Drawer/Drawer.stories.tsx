import type { Story } from "@ladle/react";
import { Button } from "../Button";
import { Drawer, type DrawerSide } from "./Drawer";

export default { title: "Drawer" };

function Panel({ side }: { side: DrawerSide }) {
  return (
    <Drawer.Viewport>
      <Drawer.Content>
        <Drawer.Title>{`${side.charAt(0).toUpperCase()}${side.slice(1)}`} drawer</Drawer.Title>
        <Drawer.Description>
          A non-modal panel — the page behind stays interactive. Press Escape or the button to
          close.
        </Drawer.Description>
        <div style={{ marginTop: "var(--sf-unit)" }}>
          <Drawer.Close render={<Button variant="secondary">Close</Button>} />
        </div>
      </Drawer.Content>
    </Drawer.Viewport>
  );
}

function Example({ side, handle }: { side: DrawerSide; handle?: boolean }) {
  return (
    <Drawer.Root side={side}>
      <Drawer.Trigger render={<Button>Open {side}</Button>} />
      {/* The handle lives outside the Portal so it stays mounted (and visible)
          while the drawer is closed. */}
      {handle ? <Drawer.SwipeArea /> : null}
      <Drawer.Portal>
        <Drawer.Popup>
          <Panel side={side} />
        </Drawer.Popup>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export const Right: Story = () => <Example side="right" />;
export const Left: Story = () => <Example side="left" />;
export const Bottom: Story = () => <Example side="bottom" />;

/**
 * With a `Drawer.SwipeArea`, a grab handle stays pinned to the edge while the
 * drawer is closed — swipe/drag it to reopen.
 */
export const WithHandle: Story = () => <Example side="right" handle />;

/**
 * All three sides on one page, demonstrating the non-modal posture (the buttons
 * stay clickable while a drawer is open).
 */
export const AllSides: Story = () => (
  <div style={{ display: "flex", gap: "0.5rem" }}>
    <Example side="left" />
    <Example side="right" />
    <Example side="bottom" />
  </div>
);
