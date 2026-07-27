import { useState } from "react";
import { Menu } from "../Menu";
import { PopOut } from "./PopOut";

/** CT harness for the M3 portal-container sweep: a Menu rendered inside a
 *  popped-out window. Its dropdown must portal into the popup document, not
 *  the opener's. */
export function PopOutFloaterHarness() {
  const [open, setOpen] = useState(false);
  const [name] = useState(() => `ct-popout-floater-${Math.random().toString(36).slice(2)}`);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)}>
        toggle
      </button>
      <PopOut open={open} onOpenChange={setOpen} title="Floater test" name={name}>
        <Menu.Root>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>First item</Menu.Item>
                <Menu.Item>Second item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </PopOut>
    </div>
  );
}
