import type { Story } from "@ladle/react";
import { useState } from "react";
import { CommandBar } from "./CommandBar";

const log = (msg: string) => () => console.log(msg);

function Bar({ position }: { position?: "top" | "bottom" }) {
  return (
    <CommandBar.Root position={position}>
      <CommandBar.Menu>
        <CommandBar.Trigger>File</CommandBar.Trigger>
        <CommandBar.Content>
          <CommandBar.Item shortcut="⌘N" onClick={log("new")}>
            New
          </CommandBar.Item>
          <CommandBar.Item shortcut="⌘O" onClick={log("open")}>
            Open
          </CommandBar.Item>
          <CommandBar.Submenu>
            <CommandBar.SubmenuTrigger>Open Recent</CommandBar.SubmenuTrigger>
            <CommandBar.SubmenuContent>
              <CommandBar.Item onClick={log("recent-1")}>untitled.md</CommandBar.Item>
              <CommandBar.Item onClick={log("recent-2")}>notes.md</CommandBar.Item>
              <CommandBar.Item onClick={log("recent-3")}>journal.md</CommandBar.Item>
            </CommandBar.SubmenuContent>
          </CommandBar.Submenu>
          <CommandBar.Separator />
          <CommandBar.Item shortcut="⌘S" onClick={log("save")}>
            Save
          </CommandBar.Item>
          <CommandBar.Item shortcut="⇧⌘S" onClick={log("save-as")}>
            Save As…
          </CommandBar.Item>
          <CommandBar.Separator />
          <CommandBar.Item shortcut="⌘Q" onClick={log("quit")}>
            Quit
          </CommandBar.Item>
        </CommandBar.Content>
      </CommandBar.Menu>

      <CommandBar.Menu>
        <CommandBar.Trigger>Edit</CommandBar.Trigger>
        <CommandBar.Content>
          <CommandBar.Item shortcut="⌘Z" onClick={log("undo")}>
            Undo
          </CommandBar.Item>
          <CommandBar.Item shortcut="⇧⌘Z" onClick={log("redo")}>
            Redo
          </CommandBar.Item>
          <CommandBar.Separator />
          <CommandBar.Item shortcut="⌘X" onClick={log("cut")}>
            Cut
          </CommandBar.Item>
          <CommandBar.Item shortcut="⌘C" onClick={log("copy")}>
            Copy
          </CommandBar.Item>
          <CommandBar.Item shortcut="⌘V" onClick={log("paste")}>
            Paste
          </CommandBar.Item>
        </CommandBar.Content>
      </CommandBar.Menu>

      <CommandBar.Menu>
        <CommandBar.Trigger>View</CommandBar.Trigger>
        <CommandBar.Content>
          <CommandBar.Item shortcut="⌘+" onClick={log("zoom-in")}>
            Zoom In
          </CommandBar.Item>
          <CommandBar.Item shortcut="⌘-" onClick={log("zoom-out")}>
            Zoom Out
          </CommandBar.Item>
          <CommandBar.Item shortcut="⌘0" onClick={log("reset-zoom")}>
            Reset Zoom
          </CommandBar.Item>
          <CommandBar.Separator />
          <CommandBar.Submenu>
            <CommandBar.SubmenuTrigger>Theme</CommandBar.SubmenuTrigger>
            <CommandBar.SubmenuContent>
              <CommandBar.Item onClick={log("light")}>Light</CommandBar.Item>
              <CommandBar.Item onClick={log("dark")}>Dark</CommandBar.Item>
              <CommandBar.Item onClick={log("system")}>System</CommandBar.Item>
            </CommandBar.SubmenuContent>
          </CommandBar.Submenu>
        </CommandBar.Content>
      </CommandBar.Menu>
    </CommandBar.Root>
  );
}

export const Classic: Story = () => (
  <div style={{ width: "min(50rem, 100%)", border: "1px solid var(--sf-color-border-subtle)" }}>
    <Bar />
    <div style={{ padding: "var(--sf-unit)", color: "var(--sf-color-muted)" }}>
      Window content goes here. Click a menu above; clicks log to console.
    </div>
  </div>
);

export const PositionBottom: Story = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      width: "min(50rem, 100%)",
      height: "70vh",
      border: "1px solid var(--sf-color-border-subtle)",
    }}
  >
    <div style={{ flex: 1, padding: "var(--sf-unit)", color: "var(--sf-color-muted)" }}>
      Window content (fills available space).
      <br />
      <br />
      With the bar pinned at the bottom of a tall container, the trigger has room above it — the
      popup will open upward.
    </div>
    <Bar position="bottom" />
  </div>
);

/**
 * Apple-menubar layout: icon + bold app name as the lead menu (About/Prefs/
 * Quit), then the document menus (File / Edit / View), then a low-elevation
 * Search that reads as inlaid in the bar.
 */
export const Logo: Story = () => (
  <div style={{ width: "min(50rem, 100%)", border: "1px solid var(--sf-color-border-subtle)" }}>
    <CommandBar.Root>
      <CommandBar.Menu>
        <CommandBar.Trigger style={{ fontWeight: "var(--sf-font-weight-semibold)" }}>
          ◇ Swiss Function
        </CommandBar.Trigger>
        <CommandBar.Content>
          <CommandBar.Item onClick={log("about")}>About Swiss Function</CommandBar.Item>
          <CommandBar.Separator />
          <CommandBar.Item shortcut="⌘," onClick={log("preferences")}>
            Preferences…
          </CommandBar.Item>
          <CommandBar.Separator />
          <CommandBar.Item shortcut="⌘H" onClick={log("hide")}>
            Hide Swiss Function
          </CommandBar.Item>
          <CommandBar.Item shortcut="⌘Q" onClick={log("quit")}>
            Quit Swiss Function
          </CommandBar.Item>
        </CommandBar.Content>
      </CommandBar.Menu>
      <CommandBar.Menu>
        <CommandBar.Trigger>File</CommandBar.Trigger>
        <CommandBar.Content>
          <CommandBar.Item shortcut="⌘N" onClick={log("new")}>
            New
          </CommandBar.Item>
          <CommandBar.Item shortcut="⌘O" onClick={log("open")}>
            Open
          </CommandBar.Item>
          <CommandBar.Separator />
          <CommandBar.Item shortcut="⌘S" onClick={log("save")}>
            Save
          </CommandBar.Item>
        </CommandBar.Content>
      </CommandBar.Menu>
      <CommandBar.Menu>
        <CommandBar.Trigger>Edit</CommandBar.Trigger>
        <CommandBar.Content>
          <CommandBar.Item shortcut="⌘Z" onClick={log("undo")}>
            Undo
          </CommandBar.Item>
          <CommandBar.Item shortcut="⇧⌘Z" onClick={log("redo")}>
            Redo
          </CommandBar.Item>
          <CommandBar.Separator />
          <CommandBar.Item shortcut="⌘X" onClick={log("cut")}>
            Cut
          </CommandBar.Item>
          <CommandBar.Item shortcut="⌘C" onClick={log("copy")}>
            Copy
          </CommandBar.Item>
          <CommandBar.Item shortcut="⌘V" onClick={log("paste")}>
            Paste
          </CommandBar.Item>
        </CommandBar.Content>
      </CommandBar.Menu>
      <CommandBar.Menu>
        <CommandBar.Trigger>View</CommandBar.Trigger>
        <CommandBar.Content>
          <CommandBar.Item shortcut="⌘+" onClick={log("zoom-in")}>
            Zoom In
          </CommandBar.Item>
          <CommandBar.Item shortcut="⌘−" onClick={log("zoom-out")}>
            Zoom Out
          </CommandBar.Item>
        </CommandBar.Content>
      </CommandBar.Menu>
      <CommandBar.Search elevation={1} placeholder="Search…" />
    </CommandBar.Root>
  </div>
);

export const WithState: Story = () => {
  const [theme, setTheme] = useState("light");
  return (
    <div style={{ width: "min(50rem, 100%)", border: "1px solid var(--sf-color-border-subtle)" }}>
      <CommandBar.Root>
        <CommandBar.Menu>
          <CommandBar.Trigger>Settings</CommandBar.Trigger>
          <CommandBar.Content>
            <CommandBar.Item onClick={() => setTheme("light")}>Light theme</CommandBar.Item>
            <CommandBar.Item onClick={() => setTheme("dark")}>Dark theme</CommandBar.Item>
            <CommandBar.Item onClick={() => setTheme("system")}>System theme</CommandBar.Item>
          </CommandBar.Content>
        </CommandBar.Menu>
      </CommandBar.Root>
      <div style={{ padding: "var(--sf-unit)" }}>
        Selected theme: <code>{theme}</code>
      </div>
    </div>
  );
};
