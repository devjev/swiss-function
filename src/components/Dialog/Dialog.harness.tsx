import { Dialog } from "./Dialog";

// Playwright CT mounts top-level components with serializable props. This opens
// a window-style dialog immediately (defaultOpen) so specs can drag/resize it
// without first clicking a trigger.
export function DialogWindowHarness({
  draggable,
  resizable,
}: {
  draggable?: boolean;
  resizable?: boolean;
}) {
  return (
    <Dialog.Root defaultOpen>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup draggable={draggable} resizable={resizable} data-testid="popup">
          <Dialog.Handle data-testid="handle">
            <Dialog.Title>Movable</Dialog.Title>
          </Dialog.Handle>
          <Dialog.Description>Drag me around by the header.</Dialog.Description>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
