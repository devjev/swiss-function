import { DatePicker } from "../DatePicker";
import { MenuBar } from "../MenuBar";
import { Picker } from "../Picker";
import { Popover } from "../Popover";
import { Dialog } from "./Dialog";

const items = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];

/** A Picker rendered at the page root (no overlay above it). Its dropdown must
 *  keep the CSS default z-index — no inline override — so root behaviour is
 *  byte-identical to before issue #82. */
export function RootPickerHarness() {
  return <Picker items={items} placeholder="Fruit" />;
}

/** A Picker and a DatePicker inside an open Dialog. Both floaters must paint
 *  above the dialog (issue #82), not behind it. */
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

/** A MenuBar inside an open Dialog. Its dropdown must paint above the dialog. */
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

/** A Picker inside a Popover, both at the page root. The Popover is a seed, so
 *  the Picker's dropdown clears the Popover even without a Dialog above. */
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
