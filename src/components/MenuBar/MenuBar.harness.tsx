import { useState } from "react";
import { Button } from "../Button";
import { Switch } from "../Switch";
import { MenuBar } from "./MenuBar";

interface HarnessProps {
  position?: "top" | "bottom";
  onClickItem?: (id: string) => void;
  /** Mount with Logo + Search slots. */
  withSlots?: boolean;
}

/** Single File menu for the returnFocus test: after selecting an item, whether
 *  focus lands back on the trigger is what the prop controls. */
export function MenuBarFocusHarness({ returnFocus }: { returnFocus?: boolean }) {
  return (
    <MenuBar.Root>
      <MenuBar.Menu>
        <MenuBar.Trigger>File</MenuBar.Trigger>
        <MenuBar.Content returnFocus={returnFocus}>
          <MenuBar.Item>New</MenuBar.Item>
          <MenuBar.Item>Open</MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>
    </MenuBar.Root>
  );
}

// Playwright CT mounts must be top-level component invocations (no inline
// closures) for serialization. The harness exposes a stable onClickItem hook.
export function MenuBarHarness({ position, onClickItem, withSlots }: HarnessProps) {
  const click = (id: string) => () => onClickItem?.(id);
  return (
    <MenuBar.Root position={position}>
      {withSlots ? <MenuBar.Logo>Brand</MenuBar.Logo> : null}
      <MenuBar.Menu>
        <MenuBar.Trigger>File</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item shortcut="⌘N" onClick={click("new")}>
            New
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘O" onClick={click("open")}>
            Open
          </MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>
      <MenuBar.Menu>
        <MenuBar.Trigger>Edit</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item onClick={click("undo")}>Undo</MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>
      <MenuBar.Menu>
        <MenuBar.Trigger>View</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item onClick={click("zoom-in")}>Zoom In</MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>
      {withSlots ? <MenuBar.Search placeholder="Find…" /> : null}
    </MenuBar.Root>
  );
}

interface CollapseHarnessProps {
  /** Outer width in px — drives the container-width collapse. */
  width?: number;
}

// Exercises the opt-in responsive collapse: a Control (Switch) plus a menu fold
// into the ☰ panel when the container is narrower than collapseAt.
export function MenuBarCollapseHarness({ width = 1000 }: CollapseHarnessProps) {
  const [on, setOn] = useState(false);
  return (
    <div style={{ width }}>
      <MenuBar.Root collapseAt="600px" menuLabel="Menu">
        <MenuBar.Logo>App</MenuBar.Logo>
        <MenuBar.Menu>
          <MenuBar.Trigger>File</MenuBar.Trigger>
          <MenuBar.Content>
            <MenuBar.Item>New</MenuBar.Item>
          </MenuBar.Content>
        </MenuBar.Menu>
        <MenuBar.Control>
          <Button variant="primary" size="sm">
            Save
          </Button>
        </MenuBar.Control>
        <MenuBar.Control label="Wrap">
          <Switch checked={on} onCheckedChange={setOn} />
        </MenuBar.Control>
      </MenuBar.Root>
      <div data-testid="on">{String(on)}</div>
    </div>
  );
}

interface OverflowHarnessProps {
  /** Outer width in px — drives how many items stay inline. */
  width?: number;
}

// Exercises progressive overflow (collapse="items"): several menus + a Control
// fold one-by-one into the ⋯ menu from the trailing edge as width shrinks.
export function MenuBarOverflowHarness({ width = 1000 }: OverflowHarnessProps) {
  const [on, setOn] = useState(false);
  return (
    <div style={{ width }}>
      <MenuBar.Root collapse="items" menuLabel="More">
        <MenuBar.Logo>App</MenuBar.Logo>
        <MenuBar.Menu>
          <MenuBar.Trigger>File</MenuBar.Trigger>
          <MenuBar.Content>
            <MenuBar.Item onClick={() => {}}>New</MenuBar.Item>
          </MenuBar.Content>
        </MenuBar.Menu>
        <MenuBar.Menu>
          <MenuBar.Trigger>Edit</MenuBar.Trigger>
          <MenuBar.Content>
            <MenuBar.Item onClick={() => {}}>Undo</MenuBar.Item>
          </MenuBar.Content>
        </MenuBar.Menu>
        <MenuBar.Menu>
          <MenuBar.Trigger>View</MenuBar.Trigger>
          <MenuBar.Content>
            <MenuBar.Item onClick={() => {}}>Zoom In</MenuBar.Item>
          </MenuBar.Content>
        </MenuBar.Menu>
        <MenuBar.Control label="Wrap">
          <Switch checked={on} onCheckedChange={setOn} />
        </MenuBar.Control>
      </MenuBar.Root>
      <div data-testid="on">{String(on)}</div>
    </div>
  );
}
