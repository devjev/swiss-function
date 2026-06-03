import { CommandBar } from "./CommandBar";

interface HarnessProps {
  position?: "top" | "bottom";
  onClickItem?: (id: string) => void;
}

// Playwright CT mounts must be top-level component invocations (no inline
// closures) for serialization. The harness exposes a stable onClickItem hook.
export function CommandBarHarness({ position, onClickItem }: HarnessProps) {
  const click = (id: string) => () => onClickItem?.(id);
  return (
    <CommandBar.Root position={position}>
      <CommandBar.Menu>
        <CommandBar.Trigger>File</CommandBar.Trigger>
        <CommandBar.Content>
          <CommandBar.Item shortcut="⌘N" onClick={click("new")}>
            New
          </CommandBar.Item>
          <CommandBar.Item shortcut="⌘O" onClick={click("open")}>
            Open
          </CommandBar.Item>
        </CommandBar.Content>
      </CommandBar.Menu>
      <CommandBar.Menu>
        <CommandBar.Trigger>Edit</CommandBar.Trigger>
        <CommandBar.Content>
          <CommandBar.Item onClick={click("undo")}>Undo</CommandBar.Item>
        </CommandBar.Content>
      </CommandBar.Menu>
      <CommandBar.Menu>
        <CommandBar.Trigger>View</CommandBar.Trigger>
        <CommandBar.Content>
          <CommandBar.Item onClick={click("zoom-in")}>Zoom In</CommandBar.Item>
        </CommandBar.Content>
      </CommandBar.Menu>
    </CommandBar.Root>
  );
}
