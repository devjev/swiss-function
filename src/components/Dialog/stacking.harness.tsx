import { useState } from "react";
import { Button } from "../Button";
import { DatePicker } from "../DatePicker";
import { MenuBar } from "../MenuBar";
import { Picker } from "../Picker";
import { Popover } from "../Popover";
import { Dialog } from "./Dialog";

const items = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];

/** A Picker at the page root, under a field of its own. */
export function RootPickerHarness() {
  return <Picker items={items} placeholder="Fruit" />;
}

/** A Picker far down a page, for a dropdown opened after the page scrolled. */
export function ScrolledPickerHarness() {
  return (
    <div>
      <div style={{ blockSize: 1500 }} />
      <Picker items={items} placeholder="Fruit" />
      <div style={{ blockSize: 1500 }} />
    </div>
  );
}

/** A Picker and a DatePicker inside an open Dialog (issue #82). */
export function DialogFloatersHarness() {
  return (
    <Dialog.Root defaultOpen>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup data-testid="popup">
          <Dialog.Title>Settings</Dialog.Title>
          <Picker items={items} placeholder="Fruit" />
          <DatePicker aria-label="Date" />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A MenuBar inside an open Dialog. */
export function DialogMenuBarHarness() {
  return (
    <Dialog.Root defaultOpen>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup data-testid="popup">
          <Dialog.Title>Editor</Dialog.Title>
          <MenuBar.Root>
            <MenuBar.Menu>
              <MenuBar.Trigger>File</MenuBar.Trigger>
              <MenuBar.Content>
                <MenuBar.Item>New</MenuBar.Item>
                <MenuBar.Item>Open</MenuBar.Item>
              </MenuBar.Content>
            </MenuBar.Menu>
          </MenuBar.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A Picker inside a Popover, both at the page root. */
export function PopoverPickerHarness() {
  return (
    <Popover.Root defaultOpen>
      <Popover.Trigger>Open</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner data-testid="pop-positioner">
          <Popover.Popup data-testid="pop-popup">
            <Picker items={items} placeholder="Fruit" />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** A Popover that stays open, with a key inside that opens a Dialog. On the
 *  z-index scale a popover (1300) painted over a dialog (1200) whatever the
 *  order they opened in. */
export function PopoverDialogHarness() {
  const [dialog, setDialog] = useState(false);
  return (
    <>
      <Popover.Root open>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup data-testid="pop-popup">
              <p>Popover content</p>
              <Button onClick={() => setDialog(true)}>Settings</Button>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <Dialog.Root open={dialog} onOpenChange={setDialog}>
        <Dialog.Portal>
          <Dialog.Backdrop data-testid="backdrop" />
          <Dialog.Popup data-testid="popup">
            <Dialog.Title>Settings</Dialog.Title>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

/** A host's own overlay at the highest z-index there is, over the whole
 *  viewport, and an open Dialog. */
export function HostOverlayHarness() {
  return (
    <>
      <div
        data-testid="host"
        style={{ position: "fixed", inset: 0, zIndex: 2147483647, background: "transparent" }}
      />
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup">
            <Dialog.Title>Above the host</Dialog.Title>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

/** A Dialog with a key that opens a second Dialog inside it. */
export function NestedDialogsHarness() {
  return (
    <Dialog.Root defaultOpen>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup data-testid="first">
          <Dialog.Title>First</Dialog.Title>
          <p>The first dialog's text, long enough to sit outside the second one.</p>
          <Dialog.Root>
            <Dialog.Trigger render={<Button>Open second</Button>} />
            <Dialog.Portal>
              <Dialog.Backdrop data-testid="second-backdrop" />
              <Dialog.Popup data-testid="second" style={{ inlineSize: 160 }}>
                <Dialog.Title>Second</Dialog.Title>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
