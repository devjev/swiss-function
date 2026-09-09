import type { DragEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart } from "../BarChart";
import { Box } from "../Box";
import { Button } from "../Button";
import { ChatBlock, type ChatMessage } from "../Chat";
import { PanelCenter, PanelLeft, PanelRight, X } from "../Icon";
import { MenuBar } from "../MenuBar";
import { Progress } from "../Progress";
import { Stat } from "../Stat";
import { type ChatAlign, ChatDrawer } from "./ChatDrawer";

/** The megachat demo: the assistant maximized as a centered column, replying
 *  with widgets (a KPI card, a chart, a progress card) that you drag into
 *  either margin to save them. The margins are a shelf: what lands there stays
 *  through the conversation and, with `persist`, across reloads; each saved
 *  widget has a remove button. Shared by the story and the component test. */

export type MegachatWidgetId = "aum" | "flows" | "flows-chart" | "close";

const WIDGET_TITLES: Record<MegachatWidgetId, string> = {
  aum: "AUM",
  flows: "Net flows",
  "flows-chart": "Net flows by month",
  close: "Quarter close",
};

const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
const FLOWS = [12.4, -3.1, 8.8, 15.2, -6.7, 9.3];

export const MEGACHAT_WIDGET_IDS = Object.keys(WIDGET_TITLES) as MegachatWidgetId[];

/** The widget body for an id: the reply's size, or `compact` for the shelf,
 *  where the margin is narrower (an xs Stat, a shorter chart). */
export function MegachatWidget({ id, compact }: { id: MegachatWidgetId; compact?: boolean }) {
  const statSize = compact ? "xs" : "sm";
  switch (id) {
    case "aum":
      return (
        <Stat
          label="Assets under management"
          value={1284500}
          valueUnit={compact ? undefined : "kCHF"}
          delta={2.1}
          trend={[1180, 1195, 1210, 1204, 1230, 1262, 1284]}
          size={statSize}
          elevation={1}
        />
      );
    case "flows":
      return (
        <Stat
          label="Net flows, September"
          value={9300}
          valueUnit={compact ? undefined : "kCHF"}
          delta={-0.8}
          size={statSize}
          elevation={1}
        />
      );
    case "flows-chart":
      return (
        <Box elevation={1} padding={0.5}>
          <BarChart
            categories={MONTHS}
            series={[{ name: "Net flows (MCHF)", values: FLOWS }]}
            height={compact ? 128 : 140}
            scaffolding="minimal"
          />
        </Box>
      );
    case "close":
      return (
        <Box
          elevation={1}
          padding={0.5}
          style={{ display: "grid", gap: "calc(var(--sf-unit) / 3)" }}
        >
          <span>Quarter close, 7 of 9 steps</span>
          <Progress value={78} showValue size="sm" />
        </Box>
      );
    default:
      return null;
  }
}

/** A widget in a reply: draggable into a shelf. HTML drag and drop, so it
 *  also works between windows; the shelf reads the id from the transfer. */
function ReplyWidget({ id }: { id: MegachatWidgetId }) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drag source; saving stays keyboard-reachable through the shelf buttons.
    <div
      draggable
      data-widget={id}
      onDragStart={(e: DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      style={{ cursor: "grab" }}
    >
      <MegachatWidget id={id} />
    </div>
  );
}

/** A masonry of saved widgets for a wide margin: as many columns as
 *  `minColumn` allows across the measured width, each item on the shortest
 *  column so far (heights measured and re-measured as they change), placed
 *  absolutely so an added or removed widget never reflows the others. */
function Masonry({
  items,
  minColumn = 216,
  gap = 12,
}: {
  items: { id: string; node: ReactNode }[];
  /** Least column width in px; the count follows the container. */
  minColumn?: number;
  gap?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const observers = useRef(new Map<string, ResizeObserver>());
  const refs = useRef(new Map<string, (el: HTMLDivElement | null) => void>());

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // One stable callback ref per item: it measures on mount (in the commit
  // phase, so the first paint already has the height) and observes after.
  const refFor = useCallback((id: string) => {
    let ref = refs.current.get(id);
    if (!ref) {
      ref = (el) => {
        observers.current.get(id)?.disconnect();
        observers.current.delete(id);
        if (!el) return;
        const set = () => {
          const h = el.getBoundingClientRect().height;
          setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
        };
        set();
        const ro = new ResizeObserver(set);
        ro.observe(el);
        observers.current.set(id, ro);
      };
      refs.current.set(id, ref);
    }
    return ref;
  }, []);

  const columns = Math.max(1, Math.floor((width + gap) / (minColumn + gap)));
  const colWidth = (width - gap * (columns - 1)) / columns;
  const colHeights = new Array<number>(columns).fill(0);
  const placed = items.map(({ id, node }) => {
    let col = 0;
    for (let i = 1; i < columns; i++) if ((colHeights[i] ?? 0) < (colHeights[col] ?? 0)) col = i;
    const x = col * (colWidth + gap);
    const y = colHeights[col] ?? 0;
    colHeights[col] = y + (heights[id] ?? 0) + gap;
    return { id, node, x, y, measured: heights[id] != null };
  });
  const total = Math.max(0, Math.max(0, ...colHeights) - gap);

  return (
    <div ref={rootRef} style={{ position: "relative", blockSize: total }}>
      {placed.map(({ id, node, x, y, measured }) => (
        <div
          key={id}
          ref={refFor(id)}
          style={{
            position: "absolute",
            insetBlockStart: 0,
            insetInlineStart: 0,
            inlineSize: colWidth,
            translate: `${x}px ${y}px`,
            visibility: measured && width > 0 ? undefined : "hidden",
          }}
        >
          {node}
        </div>
      ))}
    </div>
  );
}

/** One margin: bare space that keeps what lands on it. No text of its own
 *  (the app decides what the margins say later); a dashed outline marks a
 *  drag over it. `layout="stack"` is the narrow gutter's single column;
 *  `"masonry"` packs the wide margin of an edge-aligned chat. */
function Shelf({
  side,
  saved,
  onSave,
  onRemove,
  layout = "stack",
}: {
  side: "left" | "right";
  saved: MegachatWidgetId[];
  onSave: (id: MegachatWidgetId) => void;
  onRemove: (id: MegachatWidgetId) => void;
  layout?: "stack" | "masonry";
}) {
  const [over, setOver] = useState(false);
  const item = (id: MegachatWidgetId) => (
    <div key={id} data-saved={id} style={{ position: "relative" }}>
      <MegachatWidget id={id} compact />
      <Button
        variant="ghost"
        size="sm"
        tight
        aria-label={`Remove ${WIDGET_TITLES[id]}`}
        onClick={() => onRemove(id)}
        style={{ position: "absolute", insetBlockStart: 2, insetInlineEnd: 2 }}
      >
        <X />
      </Button>
    </div>
  );
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the drop target of the saved-widget shelf.
    <div
      data-shelf={side}
      data-layout={layout}
      data-count={saved.length}
      data-over={over || undefined}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain") as MegachatWidgetId;
        if (id in WIDGET_TITLES) onSave(id);
      }}
      style={{
        blockSize: "100%",
        overflowY: "auto",
        display: layout === "stack" ? "grid" : "block",
        alignContent: "start",
        gap: "calc(var(--sf-unit) / 2)",
        // No padding of its own: the drawer's margin already frames it (flush
        // with the panel edge, one unit from the chat column).
        padding: 0,
        outline: over ? "var(--sf-focus-ring-width, 2px) dashed var(--sf-color-primary)" : "none",
        outlineOffset: "-2px",
      }}
    >
      {layout === "masonry" ? (
        <Masonry items={saved.map((id) => ({ id, node: item(id) }))} />
      ) : (
        saved.map(item)
      )}
    </div>
  );
}

type Saved = { left: MegachatWidgetId[]; right: MegachatWidgetId[] };
const EMPTY: Saved = { left: [], right: [] };

const ALIGN_LABELS: Record<ChatAlign, string> = {
  left: "Chat on the left",
  center: "Chat centered",
  right: "Chat on the right",
};

function readAlign(key: string): ChatAlign {
  try {
    const raw = localStorage.getItem(key);
    return raw === "left" || raw === "right" ? raw : "center";
  } catch {
    return "center";
  }
}

function readSaved(key: string): Saved {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    const valid = (list: unknown): MegachatWidgetId[] =>
      Array.isArray(list) ? list.filter((id): id is MegachatWidgetId => id in WIDGET_TITLES) : [];
    return { left: valid(parsed.left), right: valid(parsed.right) };
  } catch {
    return EMPTY;
  }
}

/** The assistant's reply for a prompt: text plus the widgets it names. */
function replyFor(text: string): ChatMessage["parts"] {
  const t = text.toLowerCase();
  const widgets: MegachatWidgetId[] = [];
  if (/\baum\b|assets/.test(t)) widgets.push("aum");
  if (/flow/.test(t)) widgets.push("flows", "flows-chart");
  if (/chart|plot/.test(t) && !widgets.includes("flows-chart")) widgets.push("flows-chart");
  if (/close|quarter|progress/.test(t)) widgets.push("close");
  if (widgets.length === 0) widgets.push(MEGACHAT_WIDGET_IDS[widgets.length % 4] ?? "aum");
  return [
    {
      type: "text",
      text:
        widgets.length > 1
          ? "Here is what I have. Drag any of these into a side margin to save it."
          : "Here it is. Drag it into a side margin to save it.",
    },
    ...widgets.map((widgetId, i) => ({ type: "widget", partId: `w-${Date.now()}-${i}`, widgetId })),
  ];
}

export interface MegachatDemoProps {
  /** Keep the saved shelves in localStorage under this key; `false` keeps
   *  them for the session only. Default `"sf-megachat-saved"`. */
  persist?: string | false;
  /** Start maximized. Default true. */
  defaultExpanded?: boolean;
}

export function MegachatDemo({
  persist = "sf-megachat-saved",
  defaultExpanded = true,
}: MegachatDemoProps) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Saved>(() => (persist ? readSaved(persist) : EMPTY));
  const [align, setAlign] = useState<ChatAlign>(() =>
    persist ? readAlign(`${persist}-align`) : "center",
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "This is the maximized chat. Ask for AUM, flows, a chart or the quarter close and I answer with widgets; drag any widget into a side margin to save it. The margins keep what you save.",
        },
        { type: "widget", partId: "w-aum", widgetId: "aum" },
      ],
    },
    { id: "2", role: "user", content: "Show me the net flows." },
    {
      id: "3",
      role: "assistant",
      parts: [
        { type: "text", text: "Net flows for September, and the last six months as a chart." },
        { type: "widget", partId: "w-flows", widgetId: "flows" },
        { type: "widget", partId: "w-flows-chart", widgetId: "flows-chart" },
      ],
    },
  ]);

  useEffect(() => {
    if (!persist) return;
    try {
      localStorage.setItem(persist, JSON.stringify(saved));
      localStorage.setItem(`${persist}-align`, align);
    } catch {
      // Storage may be unavailable; the shelf still works for the session.
    }
  }, [persist, saved, align]);

  const save = (side: "left" | "right") => (id: MegachatWidgetId) =>
    setSaved((prev) =>
      prev.left.includes(id) || prev.right.includes(id)
        ? prev
        : { ...prev, [side]: [...prev[side], id] },
    );
  const remove = (side: "left" | "right") => (id: MegachatWidgetId) =>
    setSaved((prev) => ({ ...prev, [side]: prev[side].filter((s) => s !== id) }));
  const removeAnywhere = (id: MegachatWidgetId) =>
    setSaved((prev) => ({
      left: prev.left.filter((s) => s !== id),
      right: prev.right.filter((s) => s !== id),
    }));

  // Centered: a shelf on each side. Aligned to an edge: the one wide margin
  // on the other side holds everything saved, packed as a masonry, and it is
  // the only drop target.
  const shelfSide: "left" | "right" = align === "left" ? "right" : "left";
  const margins =
    align === "center"
      ? {
          left: (
            <Shelf side="left" saved={saved.left} onSave={save("left")} onRemove={remove("left")} />
          ),
          right: (
            <Shelf
              side="right"
              saved={saved.right}
              onSave={save("right")}
              onRemove={remove("right")}
            />
          ),
        }
      : {
          [shelfSide]: (
            <Shelf
              side={shelfSide}
              layout="masonry"
              saved={[...saved.left, ...saved.right]}
              onSave={save(shelfSide)}
              onRemove={removeAnywhere}
            />
          ),
        };

  const alignActions = (
    <>
      {(["left", "center", "right"] as const).map((a) => (
        <Button
          key={a}
          variant="ghost"
          size="sm"
          tight
          aria-label={ALIGN_LABELS[a]}
          title={ALIGN_LABELS[a]}
          aria-pressed={align === a}
          onClick={() => setAlign(a)}
        >
          {a === "left" ? <PanelLeft /> : a === "right" ? <PanelRight /> : <PanelCenter />}
        </Button>
      ))}
    </>
  );

  const handleSubmit = (text: string) => {
    const base = String(Date.now());
    setMessages((prev) => [...prev, { id: `${base}-u`, role: "user", content: text }]);
    setBusy(true);
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: `${base}-a`, role: "assistant", parts: replyFor(text) },
      ]);
      setBusy(false);
    }, 1400);
  };

  const renderPart = (part: { type: string; widgetId?: unknown }): ReactNode =>
    part.type === "widget" &&
    typeof part.widgetId === "string" &&
    part.widgetId in WIDGET_TITLES ? (
      <ChatBlock title={WIDGET_TITLES[part.widgetId as MegachatWidgetId]}>
        <ReplyWidget id={part.widgetId as MegachatWidgetId} />
      </ChatBlock>
    ) : null;

  return (
    <div style={{ blockSize: 560, border: "1px solid var(--sf-color-border-subtle)" }}>
      <ChatDrawer
        open={open}
        onOpenChange={setOpen}
        title="Assistant"
        menu={
          <MenuBar.Root transparent>
            <MenuBar.Menu>
              <MenuBar.Trigger>Conversation</MenuBar.Trigger>
              <MenuBar.Content>
                <MenuBar.Item shortcut="mod+n">New</MenuBar.Item>
                <MenuBar.Item>Rename</MenuBar.Item>
                <MenuBar.Separator />
                <MenuBar.Item>Export as Markdown</MenuBar.Item>
              </MenuBar.Content>
            </MenuBar.Menu>
            <MenuBar.Menu>
              <MenuBar.Trigger>Widgets</MenuBar.Trigger>
              <MenuBar.Content>
                <MenuBar.Item>Clear saved</MenuBar.Item>
                <MenuBar.Item>Save all from this reply</MenuBar.Item>
              </MenuBar.Content>
            </MenuBar.Menu>
            <MenuBar.Menu>
              <MenuBar.Trigger>Help</MenuBar.Trigger>
              <MenuBar.Content>
                <MenuBar.Item shortcut="mod+/">Shortcuts</MenuBar.Item>
              </MenuBar.Content>
            </MenuBar.Menu>
            <MenuBar.Search
              fill
              placeholder="Search the conversation"
              aria-label="Search the conversation"
            />
          </MenuBar.Root>
        }
        actions={alignActions}
        thinking={busy}
        defaultExpanded={defaultExpanded}
        centered
        chatAlign={align}
        defaultChatWidth={720}
        minChatWidth={480}
        maxChatWidth={1200}
        marginMinWidth={200}
        margins={margins}
        messages={messages}
        onSubmit={handleSubmit}
        renderPart={renderPart}
      >
        <div style={{ padding: "var(--sf-unit)" }}>
          <Button onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Open"} assistant</Button>
          <p style={{ margin: "var(--sf-unit) 0 0" }}>
            The app behind the megachat. Leave fullscreen with the header toggle to see it.
          </p>
        </div>
      </ChatDrawer>
    </div>
  );
}
