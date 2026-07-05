import type { Story } from "@ladle/react";
import { useEffect, useRef, useState } from "react";
import type { WindowArrayElevation, WindowArrayHandle, WindowMove } from "./WindowArray";
import { WindowArray } from "./WindowArray";
import { applyWindowMove } from "./WindowArray.harness";

export default { title: "WindowArray" };

interface DemoColumn {
  id: string;
  windows: { id: string; title: string; body: string }[];
}

const INITIAL: DemoColumn[] = [
  {
    id: "col-editor",
    windows: [
      {
        id: "editor",
        title: "Editor",
        body: "Primary work surface. Click a title to focus it; drag it to rearrange.",
      },
      { id: "terminal", title: "Terminal", body: "Stacked below the editor in the same column." },
    ],
  },
  {
    id: "col-preview",
    windows: [{ id: "preview", title: "Preview", body: "A full-height single-window column." }],
  },
  {
    id: "col-logs",
    windows: [
      {
        id: "logs",
        title: "Logs",
        body: "Shift+Arrow moves the focused window; plain arrows navigate.",
      },
      {
        id: "metrics",
        title: "Metrics",
        body: "Drop a window on a gutter to break it out into its own column.",
      },
    ],
  },
];

function Paragraphs({ text, count = 1 }: { text: string; count?: number }) {
  return (
    <div style={{ padding: "calc(var(--sf-unit) / 2)" }}>
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static demo copy
        <p key={i} style={{ margin: "0 0 var(--sf-space-2) 0" }}>
          {text}
        </p>
      ))}
    </div>
  );
}

function Demo({
  columns: initial = INITIAL,
  height = 420,
  longBodies = false,
  snap = false,
  controls = false,
  hotkeys = false,
  elevation,
}: {
  columns?: DemoColumn[];
  height?: number;
  longBodies?: boolean;
  snap?: boolean;
  controls?: boolean;
  /** Wires Alt+Arrow to `apiRef.switchColumn` — the consumer's job now (#32). */
  hotkeys?: boolean;
  elevation?: WindowArrayElevation;
}) {
  const [columns, setColumns] = useState(initial);
  const api = useRef<WindowArrayHandle>(null);
  const close = (id: string) =>
    setColumns((cols) =>
      cols
        .map((c) => ({ ...c, windows: c.windows.filter((w) => w.id !== id) }))
        .filter((c) => c.windows.length > 0),
    );
  const move = (m: WindowMove) => setColumns((cols) => applyWindowMove(cols, m));
  // The consumer owns the shortcut: a document-level Alt+Arrow → switchColumn.
  useEffect(() => {
    if (!hotkeys) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        api.current?.switchColumn("prev");
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        api.current?.switchColumn("next");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hotkeys]);
  return (
    <div style={{ blockSize: height }}>
      <WindowArray
        aria-label="Workspace"
        onWindowMove={move}
        defaultActiveId="editor"
        snap={snap}
        controls={controls}
        apiRef={api}
        elevation={elevation}
      >
        {columns.map((col) => (
          <WindowArray.Column key={col.id} id={col.id} defaultWidth={360}>
            {col.windows.map((win) => (
              <WindowArray.Window
                key={win.id}
                id={win.id}
                title={win.title}
                onClose={() => close(win.id)}
              >
                <Paragraphs text={win.body} count={longBodies ? 14 : 1} />
              </WindowArray.Window>
            ))}
          </WindowArray.Column>
        ))}
      </WindowArray>
    </div>
  );
}

/** Three columns with stacked windows: drag titles to rearrange (gutters make
 *  new columns), drag gutters to resize, arrows/Home/End to navigate. */
export const Basic: Story = () => <Demo />;

/** Enough columns to overflow: the strip scrolls horizontally with proximity
 *  column snapping, edge paddles switch columns (they fade in as the pointer
 *  nears their edge), and Alt+Arrow works from anywhere inside the array
 *  (keyboard nav auto-scrolls as before). */
export const ManyColumns: Story = () => (
  <Demo
    snap
    controls
    hotkeys
    columns={Array.from({ length: 8 }, (_, c) => ({
      id: `col-${c + 1}`,
      windows: [
        {
          id: `win-${c + 1}`,
          title: `Window ${c + 1}`,
          body: `Column ${c + 1} of 8 — End jumps to the last one; Alt+Arrows switch columns.`,
        },
      ],
    }))}
  />
);

/** Below 480px of container width the auto orientation transposes the strip:
 *  it scrolls top-to-bottom, columns become full-width bands, and stacked
 *  windows sit side by side. Drag the container's resize corner across the
 *  breakpoint to watch it flip — arrows, Shift+moves, gutter resizing,
 *  paddles, and Alt+hotkeys all follow the layout axis. */
export const NarrowVertical: Story = () => (
  <div
    style={{
      inlineSize: 360,
      minInlineSize: 240,
      maxInlineSize: 880,
      resize: "horizontal",
      overflow: "auto",
      padding: "0 0 var(--sf-space-2) 0",
    }}
  >
    <Demo height={520} snap controls hotkeys />
  </div>
);

/** `elevation={4}` lifts every window off the dithered desk with a deeper
 *  resting shadow (the default is `1`); fullscreen windows stay flat. */
export const Elevated: Story = () => <Demo elevation={4} />;

/** Window bodies that overflow scroll internally; the fullscreen toggle
 *  expands a window over the WindowArray container only (Escape exits). */
export const FullscreenAndScrollingBodies: Story = () => <Demo longBodies />;

/** Custom title-bar actions: `WindowArray.WindowButton` shares the ✕/fullscreen
 *  chrome exactly, so consumer buttons blend in. Rendered before the built-in
 *  pair; the actions row never starts a window drag. */
export const CustomActions: Story = () => {
  const [pinned, setPinned] = useState(false);
  return (
    <div style={{ blockSize: 320 }}>
      <WindowArray aria-label="Actions demo" defaultActiveId="notes">
        <WindowArray.Column id="a" defaultWidth={360}>
          <WindowArray.Window
            id="notes"
            title={pinned ? "Notes (pinned)" : "Notes"}
            onClose={() => {}}
            actions={
              <WindowArray.WindowButton
                aria-label={pinned ? "Unpin" : "Pin"}
                aria-pressed={pinned}
                onClick={() => setPinned((p) => !p)}
              >
                {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the button carries the label. */}
                <svg
                  viewBox="0 0 16 16"
                  width={14}
                  height={14}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                >
                  <path d="M8 2v7M5 9h6M6.5 9L5 14M9.5 9L11 14" strokeLinecap="square" />
                </svg>
              </WindowArray.WindowButton>
            }
          >
            <Paragraphs text="The pin button left of fullscreen/close is a consumer-supplied WindowButton." />
          </WindowArray.Window>
        </WindowArray.Column>
      </WindowArray>
    </div>
  );
};

/** No onWindowMove and no onClose: chrome shrinks to the fullscreen toggle and
 *  dragging is disabled. */
export const StaticStrip: Story = () => (
  <div style={{ blockSize: 320 }}>
    <WindowArray aria-label="Static workspace">
      <WindowArray.Column id="a" defaultWidth={320}>
        <WindowArray.Window id="one" title="Not movable">
          <Paragraphs text="Without onWindowMove there is no drag and no Shift+Arrow move." />
        </WindowArray.Window>
      </WindowArray.Column>
      <WindowArray.Column id="b" defaultWidth={320} resizable={false}>
        <WindowArray.Window id="two" title="Not closable" maximizable={false}>
          <Paragraphs text="No onClose → no ✕; maximizable={false} → no fullscreen toggle." />
        </WindowArray.Window>
      </WindowArray.Column>
    </WindowArray>
  </div>
);
