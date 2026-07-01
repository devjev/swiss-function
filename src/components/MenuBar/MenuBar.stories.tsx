import type { Story } from "@ladle/react";
import { useState } from "react";
import { DataTable } from "../DataTable";
import type { ColumnDef } from "../DataTable/types";
import { Selector } from "../Selector";
import { Switch } from "../Switch";
import { MenuBar } from "./MenuBar";

// Demo no-op: menu items get a handler without logging to the console.
const log = (_msg: string) => () => {};

function Bar({ position }: { position?: "top" | "bottom" }) {
  return (
    <MenuBar.Root position={position}>
      <MenuBar.Menu>
        <MenuBar.Trigger>File</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item shortcut="⌘N" onClick={log("new")}>
            New
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘O" onClick={log("open")}>
            Open
          </MenuBar.Item>
          <MenuBar.Submenu>
            <MenuBar.SubmenuTrigger>Open Recent</MenuBar.SubmenuTrigger>
            <MenuBar.SubmenuContent>
              <MenuBar.Item onClick={log("recent-1")}>untitled.md</MenuBar.Item>
              <MenuBar.Item onClick={log("recent-2")}>notes.md</MenuBar.Item>
              <MenuBar.Item onClick={log("recent-3")}>journal.md</MenuBar.Item>
            </MenuBar.SubmenuContent>
          </MenuBar.Submenu>
          <MenuBar.Separator />
          <MenuBar.Item shortcut="⌘S" onClick={log("save")}>
            Save
          </MenuBar.Item>
          <MenuBar.Item shortcut="⇧⌘S" onClick={log("save-as")}>
            Save As…
          </MenuBar.Item>
          <MenuBar.Separator />
          <MenuBar.Item shortcut="⌘Q" onClick={log("quit")}>
            Quit
          </MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>

      <MenuBar.Menu>
        <MenuBar.Trigger>Edit</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item shortcut="⌘Z" onClick={log("undo")}>
            Undo
          </MenuBar.Item>
          <MenuBar.Item shortcut="⇧⌘Z" onClick={log("redo")}>
            Redo
          </MenuBar.Item>
          <MenuBar.Separator />
          <MenuBar.Item shortcut="⌘X" onClick={log("cut")}>
            Cut
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘C" onClick={log("copy")}>
            Copy
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘V" onClick={log("paste")}>
            Paste
          </MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>

      <MenuBar.Menu>
        <MenuBar.Trigger>View</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item shortcut="⌘+" onClick={log("zoom-in")}>
            Zoom In
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘-" onClick={log("zoom-out")}>
            Zoom Out
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘0" onClick={log("reset-zoom")}>
            Reset Zoom
          </MenuBar.Item>
          <MenuBar.Separator />
          <MenuBar.Submenu>
            <MenuBar.SubmenuTrigger>Theme</MenuBar.SubmenuTrigger>
            <MenuBar.SubmenuContent>
              <MenuBar.Item onClick={log("light")}>Light</MenuBar.Item>
              <MenuBar.Item onClick={log("dark")}>Dark</MenuBar.Item>
              <MenuBar.Item onClick={log("system")}>System</MenuBar.Item>
            </MenuBar.SubmenuContent>
          </MenuBar.Submenu>
        </MenuBar.Content>
      </MenuBar.Menu>
    </MenuBar.Root>
  );
}

export const Classic: Story = () => (
  <div style={{ width: "min(50rem, 100%)", border: "1px solid var(--sf-color-border-subtle)" }}>
    <Bar />
    <div style={{ padding: "var(--sf-unit)", color: "var(--sf-color-muted)" }}>
      Window content goes here. Click a menu above.
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
    <MenuBar.Root>
      <MenuBar.Menu>
        <MenuBar.Trigger style={{ fontWeight: "var(--sf-font-weight-semibold)" }}>
          ◇ Swiss Function
        </MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item onClick={log("about")}>About Swiss Function</MenuBar.Item>
          <MenuBar.Separator />
          <MenuBar.Item shortcut="⌘," onClick={log("preferences")}>
            Preferences…
          </MenuBar.Item>
          <MenuBar.Separator />
          <MenuBar.Item shortcut="⌘H" onClick={log("hide")}>
            Hide Swiss Function
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘Q" onClick={log("quit")}>
            Quit Swiss Function
          </MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>
      <MenuBar.Menu>
        <MenuBar.Trigger>File</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item shortcut="⌘N" onClick={log("new")}>
            New
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘O" onClick={log("open")}>
            Open
          </MenuBar.Item>
          <MenuBar.Separator />
          <MenuBar.Item shortcut="⌘S" onClick={log("save")}>
            Save
          </MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>
      <MenuBar.Menu>
        <MenuBar.Trigger>Edit</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item shortcut="⌘Z" onClick={log("undo")}>
            Undo
          </MenuBar.Item>
          <MenuBar.Item shortcut="⇧⌘Z" onClick={log("redo")}>
            Redo
          </MenuBar.Item>
          <MenuBar.Separator />
          <MenuBar.Item shortcut="⌘X" onClick={log("cut")}>
            Cut
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘C" onClick={log("copy")}>
            Copy
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘V" onClick={log("paste")}>
            Paste
          </MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>
      <MenuBar.Menu>
        <MenuBar.Trigger>View</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item shortcut="⌘+" onClick={log("zoom-in")}>
            Zoom In
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘−" onClick={log("zoom-out")}>
            Zoom Out
          </MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>
      <MenuBar.Search elevation={1} placeholder="Search…" />
    </MenuBar.Root>
  </div>
);

export const WithState: Story = () => {
  const [theme, setTheme] = useState("light");
  return (
    <div style={{ width: "min(50rem, 100%)", border: "1px solid var(--sf-color-border-subtle)" }}>
      <MenuBar.Root>
        <MenuBar.Menu>
          <MenuBar.Trigger>Settings</MenuBar.Trigger>
          <MenuBar.Content>
            <MenuBar.Item onClick={() => setTheme("light")}>Light theme</MenuBar.Item>
            <MenuBar.Item onClick={() => setTheme("dark")}>Dark theme</MenuBar.Item>
            <MenuBar.Item onClick={() => setTheme("system")}>System theme</MenuBar.Item>
          </MenuBar.Content>
        </MenuBar.Menu>
      </MenuBar.Root>
      <div style={{ padding: "var(--sf-unit)" }}>
        Selected theme: <code>{theme}</code>
      </div>
    </div>
  );
};

/**
 * A real app bar that opts into responsive collapse: a `Logo`, File/Edit menus,
 * an in-place `Control` (the Wrap switch), and a right-aligned `Search`. Wide, it
 * reads exactly like the Classic menu bar; once its container drops below
 * `collapseAt`, the whole bar — menus, switch, and search — folds behind the ☰.
 */
function AppBar({ menuAlign }: { menuAlign?: "start" | "end" }) {
  const [wrap, setWrap] = useState(true);
  return (
    <MenuBar.Root collapseAt="34rem" menuAlign={menuAlign}>
      <MenuBar.Logo>◇ Editor</MenuBar.Logo>
      <MenuBar.Menu>
        <MenuBar.Trigger>File</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item shortcut="⌘N" onClick={log("new")}>
            New
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘O" onClick={log("open")}>
            Open
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘S" onClick={log("save")}>
            Save
          </MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>
      <MenuBar.Menu>
        <MenuBar.Trigger>Edit</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item shortcut="⌘Z" onClick={log("undo")}>
            Undo
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘C" onClick={log("copy")}>
            Copy
          </MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>
      <MenuBar.Control label="Wrap">
        <Switch checked={wrap} onCheckedChange={setWrap} />
      </MenuBar.Control>
      <MenuBar.Search placeholder="Search…" />
    </MenuBar.Root>
  );
}

/**
 * Drag the resize handle on the bottom-right corner to narrow the container.
 * Below ~34rem the whole bar folds into a ☰ panel; widen it again and the menus,
 * the Wrap switch, and Search return inline. This is the same `useCollapse`
 * container-width mechanism `Reflow` uses — it reacts to the *container*, not the
 * viewport, so it works in sidebars and split panes.
 */
export const Collapsible: Story = () => (
  <div>
    <p style={{ margin: "0 0 var(--sf-unit)", color: "var(--sf-color-muted)" }}>
      Drag the ⌟ handle (bottom-right) to resize ↔
    </p>
    <div
      style={{
        resize: "horizontal",
        overflow: "hidden",
        inlineSize: "44rem",
        minInlineSize: "16rem",
        maxInlineSize: "100%",
        border: "1px solid var(--sf-color-border-subtle)",
      }}
    >
      <AppBar />
      <div style={{ padding: "var(--sf-unit)", color: "var(--sf-color-muted)" }}>
        Window content. The bar above tracks this container's width.
      </div>
    </div>
  </div>
);

/** The collapsed end-state, forced by a narrow wrapper. Click the ☰ to open the panel. */
export const Collapsed: Story = () => (
  <div style={{ inlineSize: 320, border: "1px solid var(--sf-color-border-subtle)" }}>
    <AppBar />
    <div style={{ padding: "var(--sf-unit)", color: "var(--sf-color-muted)" }}>Window content.</div>
  </div>
);

/**
 * `menuAlign="start"` keeps the ☰ next to the `Logo`, where the menus were,
 * instead of pinning it to the far edge.
 */
export const CollapsedMenuStart: Story = () => (
  <div style={{ inlineSize: 320, border: "1px solid var(--sf-color-border-subtle)" }}>
    <AppBar menuAlign="start" />
    <div style={{ padding: "var(--sf-unit)", color: "var(--sf-color-muted)" }}>Window content.</div>
  </div>
);

/**
 * `bordered={false}` drops the bar's own hairline — useful when the bar already
 * sits inside a bordered surface (a `Box`, a card, a `Pane.Header`) and a second
 * line would double up.
 */
export const Borderless: Story = () => (
  <div style={{ width: "min(50rem, 100%)", border: "1px solid var(--sf-color-border-subtle)" }}>
    <MenuBar.Root bordered={false}>
      <MenuBar.Logo>◇ App</MenuBar.Logo>
      <MenuBar.Menu>
        <MenuBar.Trigger>File</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item shortcut="⌘N" onClick={log("new")}>
            New
          </MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>
      <MenuBar.Menu>
        <MenuBar.Trigger>Edit</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item onClick={log("undo")}>Undo</MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>
    </MenuBar.Root>
    <div style={{ padding: "var(--sf-unit)", color: "var(--sf-color-muted)" }}>
      The bar draws no hairline of its own; the only border here is the wrapper.
    </div>
  </div>
);

/**
 * `collapse="items"` folds the bar **progressively**: as the container narrows,
 * the last item moves into a ⋯ overflow menu, then the next-to-last, and so on —
 * keeping as many menus/controls inline as fit. Drag the ⌟ handle (bottom-right)
 * to watch items fold one at a time and return on widen. Only `Logo` is pinned.
 */
function OverflowBar() {
  const [wrap, setWrap] = useState(true);
  return (
    <MenuBar.Root collapse="items">
      <MenuBar.Logo>◇ Editor</MenuBar.Logo>
      <MenuBar.Menu>
        <MenuBar.Trigger>File</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item shortcut="⌘N" onClick={log("new")}>
            New
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘S" onClick={log("save")}>
            Save
          </MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>
      <MenuBar.Menu>
        <MenuBar.Trigger>Edit</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item shortcut="⌘Z" onClick={log("undo")}>
            Undo
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘C" onClick={log("copy")}>
            Copy
          </MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>
      <MenuBar.Menu>
        <MenuBar.Trigger>View</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item shortcut="⌘+" onClick={log("zoom-in")}>
            Zoom In
          </MenuBar.Item>
          <MenuBar.Item shortcut="⌘-" onClick={log("zoom-out")}>
            Zoom Out
          </MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>
      <MenuBar.Menu>
        <MenuBar.Trigger>Selection</MenuBar.Trigger>
        <MenuBar.Content>
          <MenuBar.Item onClick={log("select-all")}>Select All</MenuBar.Item>
        </MenuBar.Content>
      </MenuBar.Menu>
      <MenuBar.Control label="Wrap">
        <Switch checked={wrap} onCheckedChange={setWrap} />
      </MenuBar.Control>
      <MenuBar.Search placeholder="Search…" />
    </MenuBar.Root>
  );
}

export const Overflow: Story = () => (
  <div>
    <p style={{ margin: "0 0 var(--sf-unit)", color: "var(--sf-color-muted)" }}>
      Drag the ⌟ handle (bottom-right) to resize ↔
    </p>
    <div
      style={{
        resize: "horizontal",
        overflow: "hidden",
        inlineSize: "52rem",
        minInlineSize: "16rem",
        maxInlineSize: "100%",
        border: "1px solid var(--sf-color-border-subtle)",
      }}
    >
      <OverflowBar />
      <div style={{ padding: "var(--sf-unit)", color: "var(--sf-color-muted)" }}>
        Items fold into ⋯ from the right as space runs out.
      </div>
    </div>
  </div>
);

// Regression (issue #5): a collapse="items" overflow panel rendered directly
// above a DataTable. The panel must paint above the table's sticky header, and a
// Selector folded into the panel must open its dropdown above the panel.
type RowT = { name: string; v: number };

function OverflowOverTableBar() {
  const [wrap, setWrap] = useState(true);
  const [funds, setFunds] = useState<string[]>(["Alpha"]);
  const cols: ColumnDef<RowT>[] = [
    { id: "name", header: "Name", accessor: "name", width: 10 },
    { id: "v", header: "Value", accessor: "v", align: "end", width: 6 },
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `m${i}`,
      header: `Month ${i + 1}`,
      accessor: (r: RowT) => r.v + i,
      align: "end" as const,
      width: 6,
    })),
  ];
  const data: RowT[] = Array.from({ length: 40 }, (_, i) => ({ name: `Row ${i}`, v: i }));
  return (
    <div style={{ width: 480, display: "flex", flexDirection: "column", height: 360 }}>
      <MenuBar.Root collapse="items">
        <MenuBar.Logo>◇ Fund</MenuBar.Logo>
        <MenuBar.Menu>
          <MenuBar.Trigger>File</MenuBar.Trigger>
          <MenuBar.Content>
            <MenuBar.Item onClick={log("export")}>Export</MenuBar.Item>
          </MenuBar.Content>
        </MenuBar.Menu>
        <MenuBar.Control label="Funds">
          <Selector
            layout="compact"
            items={["Alpha", "Beta", "Gamma", "Delta"]}
            value={funds}
            onChange={setFunds}
          />
        </MenuBar.Control>
        <MenuBar.Control label="Wrap">
          <Switch checked={wrap} onCheckedChange={setWrap} />
        </MenuBar.Control>
      </MenuBar.Root>
      <DataTable data={data} columns={cols} height={300} />
    </div>
  );
}

export const OverflowOverDataTable: Story = () => <OverflowOverTableBar />;
