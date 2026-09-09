import type { DragEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../Button";
import type { ChatMessage } from "../Chat";
import { PanelCenter, PanelLeft, PanelRight, X } from "../Icon";
import { MenuBar } from "../MenuBar";
import {
  ChartWidget,
  KpiWidget,
  ProgressWidget,
  type WidgetParam,
  type WidgetParamValues,
  type WidgetShellProps,
} from "../Widget";
import { type ChatAlign, ChatDrawer } from "./ChatDrawer";

/** The megachat demo: the assistant maximized as a centered column, replying
 *  with widgets (a KPI card, a chart, a progress card) that you drag into a
 *  margin to save them. A widget carries its input parameters in its title
 *  bar (a month, an as-of date and a currency) or, with more of them, behind
 *  a settings key; every instance keeps its own values, and a drag onto a
 *  shelf takes them along. The margins are a shelf: what lands there stays
 *  through the conversation and, with `persist`, across reloads; each saved
 *  widget has a remove button. Shared by the story and the component test. */

export type MegachatWidgetId = "aum" | "flows" | "flows-chart" | "close";

const WIDGET_TITLES: Record<MegachatWidgetId, string> = {
  aum: "AUM",
  flows: "Net flows",
  "flows-chart": "Net flows by month",
  close: "Quarter close",
};

export const MEGACHAT_WIDGET_IDS = Object.keys(WIDGET_TITLES) as MegachatWidgetId[];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Net flows per month of 2026, in MCHF. */
const FLOWS = [7.9, 4.2, 11.0, 12.4, -3.1, 8.8, 15.2, -6.7, 9.3, 5.1, -2.2, 10.6];
const FX: Record<string, number> = { CHF: 1, USD: 1.12, EUR: 1.04 };
const CURRENCIES = [
  { value: "CHF", label: "CHF" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
];

/** Default parameter values per widget; every instance starts from these. */
export const WIDGET_DEFAULTS: Record<MegachatWidgetId, WidgetParamValues> = {
  aum: { asOf: new Date(2026, 8, 8), ccy: "CHF" },
  flows: { month: new Date(2026, 8, 1) },
  "flows-chart": { from: new Date(2026, 3, 1), to: new Date(2026, 8, 1), ccy: "CHF", basis: "net" },
  close: {},
};

const asDate = (v: unknown, fallback: Date): Date => (v instanceof Date ? v : fallback);
const asText = (v: unknown, fallback: string): string => (typeof v === "string" ? v : fallback);

/** The parameter list of a widget at the given values. */
function paramsFor(id: MegachatWidgetId, values: WidgetParamValues): WidgetParam[] {
  const d = WIDGET_DEFAULTS[id];
  switch (id) {
    case "aum":
      return [
        { id: "asOf", label: "As of", type: "date", value: asDate(values.asOf, d.asOf as Date) },
        {
          id: "ccy",
          label: "Currency",
          type: "select",
          value: asText(values.ccy, "CHF"),
          options: CURRENCIES,
        },
      ];
    case "flows":
      return [
        {
          id: "month",
          label: "Month",
          type: "date",
          precision: "month",
          value: asDate(values.month, d.month as Date),
        },
      ];
    case "flows-chart":
      return [
        {
          id: "from",
          label: "From",
          type: "date",
          precision: "month",
          value: asDate(values.from, d.from as Date),
        },
        {
          id: "to",
          label: "To",
          type: "date",
          precision: "month",
          value: asDate(values.to, d.to as Date),
        },
        {
          id: "ccy",
          label: "Currency",
          type: "select",
          value: asText(values.ccy, "CHF"),
          options: CURRENCIES,
        },
        {
          id: "basis",
          label: "Basis",
          type: "select",
          value: asText(values.basis, "net"),
          options: [
            { value: "net", label: "Net of fees" },
            { value: "gross", label: "Gross" },
          ],
        },
      ];
    default:
      return [];
  }
}

const monthIndex = (date: Date) => date.getMonth();
const fx = (ccy: string) => FX[ccy] ?? 1;

export interface MegachatWidgetProps extends Omit<WidgetShellProps, "title" | "params"> {
  id: MegachatWidgetId;
  /** The instance's parameter values (defaults fill what is missing). */
  values: WidgetParamValues;
  onValuesChange: (values: WidgetParamValues) => void;
  /** The shelf form: `size="sm"`, elevated. */
  compact?: boolean;
}

/** The widget for an id at the given parameter values: the reply's size, or
 *  `compact` for the shelf, where the margin is narrower. The data is derived
 *  from the values (a fixed table scaled by month, currency and basis). */
export function MegachatWidget({
  id,
  values,
  onValuesChange,
  compact,
  ...shell
}: MegachatWidgetProps) {
  const common = {
    title: WIDGET_TITLES[id],
    params: paramsFor(id, values),
    onParamsChange: (next: WidgetParamValues) => onValuesChange(next),
    size: compact ? ("sm" as const) : ("md" as const),
    elevation: compact ? (1 as const) : (0 as const),
    ...shell,
  };
  switch (id) {
    case "aum": {
      const asOf = asDate(values.asOf, WIDGET_DEFAULTS.aum.asOf as Date);
      const ccy = asText(values.ccy, "CHF");
      const growth = 1 + 0.004 * (monthIndex(asOf) - 8);
      return (
        <KpiWidget
          {...common}
          value={Math.round(1284500 * growth * fx(ccy))}
          unit={compact ? undefined : `k${ccy}`}
          delta={2.1}
          trend={[1180, 1195, 1210, 1204, 1230, 1262, 1284].map((v) => v * growth)}
        />
      );
    }
    case "flows": {
      const m = monthIndex(asDate(values.month, WIDGET_DEFAULTS.flows.month as Date));
      const prev = FLOWS[(m + 11) % 12] ?? 1;
      const cur = FLOWS[m] ?? 0;
      return (
        <KpiWidget
          {...common}
          value={Math.round(cur * 1000)}
          unit={compact ? undefined : "kCHF"}
          delta={Math.round(((cur - prev) / Math.abs(prev)) * 10) / 10}
        />
      );
    }
    case "flows-chart": {
      const from = monthIndex(asDate(values.from, WIDGET_DEFAULTS["flows-chart"].from as Date));
      const to = monthIndex(asDate(values.to, WIDGET_DEFAULTS["flows-chart"].to as Date));
      const ccy = asText(values.ccy, "CHF");
      const gross = values.basis === "gross";
      const months: number[] = [];
      for (let m = from; months.length < 12; m = (m + 1) % 12) {
        months.push(m);
        if (m === to) break;
      }
      return (
        <ChartWidget
          {...common}
          categories={months.map((m) => MONTHS[m] ?? "")}
          series={[
            {
              name: `${gross ? "Gross" : "Net"} flows (M${ccy})`,
              values: months.map(
                (m) => +((FLOWS[m] ?? 0) * (gross ? 1.6 : 1) * fx(ccy)).toFixed(1),
              ),
            },
          ]}
        />
      );
    }
    case "close":
      return <ProgressWidget {...common} value={78} label={compact ? undefined : "7 of 9 steps"} />;
    default:
      return null;
  }
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

/** What a drag carries: the widget id and the source instance whose
 *  parameter values the shelf copy inherits. */
const TRANSFER = "text/plain";
const encodeTransfer = (id: MegachatWidgetId, sourceKey: string) => `${id}|${sourceKey}`;
const decodeTransfer = (data: string): { id: MegachatWidgetId; sourceKey: string } | null => {
  const [id, sourceKey = ""] = data.split("|");
  return id && id in WIDGET_TITLES ? { id: id as MegachatWidgetId, sourceKey } : null;
};

/** One margin: bare space that keeps what lands on it. No text of its own
 *  (the app decides what the margins say later); a dashed outline marks a
 *  drag over it. `layout="stack"` is the narrow gutter's single column;
 *  `"masonry"` packs the wide margin of an edge-aligned chat. */
function Shelf({
  side,
  saved,
  valuesFor,
  onValuesChange,
  onSave,
  onRemove,
  layout = "stack",
}: {
  side: "left" | "right";
  saved: MegachatWidgetId[];
  valuesFor: (id: MegachatWidgetId) => WidgetParamValues;
  onValuesChange: (id: MegachatWidgetId, values: WidgetParamValues) => void;
  onSave: (id: MegachatWidgetId, sourceKey: string) => void;
  onRemove: (id: MegachatWidgetId) => void;
  layout?: "stack" | "masonry";
}) {
  const [over, setOver] = useState(false);
  const item = (id: MegachatWidgetId) => (
    <div key={id} data-saved={id}>
      <MegachatWidget
        id={id}
        compact
        values={valuesFor(id)}
        onValuesChange={(v) => onValuesChange(id, v)}
        actions={
          <Button
            variant="ghost"
            size="sm"
            tight
            aria-label={`Remove ${WIDGET_TITLES[id]}`}
            onClick={() => onRemove(id)}
          >
            <X />
          </Button>
        }
      />
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
        const t = decodeTransfer(e.dataTransfer.getData(TRANSFER));
        if (t) onSave(t.id, t.sourceKey);
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
type InstanceValues = Record<string, WidgetParamValues>;

const ALIGN_LABELS: Record<ChatAlign, string> = {
  left: "Chat on the left",
  center: "Chat centered",
  right: "Chat on the right",
};

/** The shelf instance of a widget: one per id, saved once anywhere. */
const shelfKey = (id: MegachatWidgetId) => `shelf:${id}`;

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

/** Instance values round-trip through JSON with dates tagged. */
function serializeValues(values: InstanceValues): string {
  return JSON.stringify(values, function replacer(this: Record<string, unknown>, key, value) {
    const raw = this[key];
    return raw instanceof Date ? { $date: raw.toISOString() } : value;
  });
}
function readValues(key: string): InstanceValues {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    return JSON.parse(raw, (_k, value) =>
      value && typeof value === "object" && "$date" in value ? new Date(value.$date) : value,
    ) as InstanceValues;
  } catch {
    return {};
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
          ? "Here is what I have. Change a parameter in a title bar to refresh a widget, and drag any of them into a side margin to save it."
          : "Here it is. Change a parameter in its title bar to refresh it, and drag it into a side margin to save it.",
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
  // Parameter values per widget instance: a reply part (by its partId) or a
  // shelf copy (`shelf:<id>`). Missing keys fall back to the defaults.
  const [instValues, setInstValues] = useState<InstanceValues>(() =>
    persist ? readValues(`${persist}-params`) : {},
  );
  const valuesFor = (key: string, id: MegachatWidgetId) => instValues[key] ?? WIDGET_DEFAULTS[id];
  const setValuesFor = (key: string) => (values: WidgetParamValues) =>
    setInstValues((prev) => ({ ...prev, [key]: values }));

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "This is the maximized chat. Ask for AUM, flows, a chart or the quarter close and I answer with widgets. A widget carries its inputs in its title bar (or behind the sliders key when there are several); drag any widget into a side margin to save it with its current inputs.",
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
      localStorage.setItem(`${persist}-params`, serializeValues(instValues));
    } catch {
      // Storage may be unavailable; the shelf still works for the session.
    }
  }, [persist, saved, align, instValues]);

  /** Save a widget to a side, its shelf copy inheriting the source's values. */
  const save = (side: "left" | "right") => (id: MegachatWidgetId, sourceKey: string) => {
    setSaved((prev) =>
      prev.left.includes(id) || prev.right.includes(id)
        ? prev
        : { ...prev, [side]: [...prev[side], id] },
    );
    setInstValues((prev) => {
      const source = prev[sourceKey];
      return source ? { ...prev, [shelfKey(id)]: source } : prev;
    });
  };
  const remove = (side: "left" | "right") => (id: MegachatWidgetId) =>
    setSaved((prev) => ({ ...prev, [side]: prev[side].filter((s) => s !== id) }));
  const removeAnywhere = (id: MegachatWidgetId) =>
    setSaved((prev) => ({
      left: prev.left.filter((s) => s !== id),
      right: prev.right.filter((s) => s !== id),
    }));
  const shelfValuesFor = (id: MegachatWidgetId) => valuesFor(shelfKey(id), id);
  const shelfValuesChange = (id: MegachatWidgetId, values: WidgetParamValues) =>
    setValuesFor(shelfKey(id))(values);

  /** Save every widget of the last reply to the shelf. */
  const saveLastReply = () => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    const target: "left" | "right" = align === "left" ? "right" : "left";
    for (const part of last?.parts ?? []) {
      const p = part as { type: string; partId?: unknown; widgetId?: unknown };
      if (p.type === "widget" && typeof p.widgetId === "string" && p.widgetId in WIDGET_TITLES) {
        save(target)(p.widgetId as MegachatWidgetId, typeof p.partId === "string" ? p.partId : "");
      }
    }
  };

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

  /** A reply widget: the widget itself is the drag source (HTML drag and
   *  drop, so it also works between windows); the shelf reads the id and the
   *  source instance from the transfer. */
  const renderPart = (part: { type: string; partId?: unknown; widgetId?: unknown }): ReactNode => {
    if (
      part.type !== "widget" ||
      typeof part.widgetId !== "string" ||
      !(part.widgetId in WIDGET_TITLES)
    ) {
      return null;
    }
    const id = part.widgetId as MegachatWidgetId;
    const key = typeof part.partId === "string" ? part.partId : `w-${id}`;
    return (
      <MegachatWidget
        id={id}
        values={valuesFor(key, id)}
        onValuesChange={setValuesFor(key)}
        draggable
        data-widget={id}
        onDragStart={(e: DragEvent<HTMLDivElement>) => {
          e.dataTransfer.setData(TRANSFER, encodeTransfer(id, key));
          e.dataTransfer.effectAllowed = "copy";
        }}
        style={{ cursor: "grab" }}
      />
    );
  };

  // Centered: a shelf on each side. Aligned to an edge: the one wide margin
  // on the other side holds everything saved, packed as a masonry, and it is
  // the only drop target.
  const shelfSide: "left" | "right" = align === "left" ? "right" : "left";
  const shelfCommon = { valuesFor: shelfValuesFor, onValuesChange: shelfValuesChange };
  const margins =
    align === "center"
      ? {
          left: (
            <Shelf
              side="left"
              saved={saved.left}
              onSave={save("left")}
              onRemove={remove("left")}
              {...shelfCommon}
            />
          ),
          right: (
            <Shelf
              side="right"
              saved={saved.right}
              onSave={save("right")}
              onRemove={remove("right")}
              {...shelfCommon}
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
              {...shelfCommon}
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
                <MenuBar.Item onClick={() => setSaved(EMPTY)}>Clear saved</MenuBar.Item>
                <MenuBar.Item onClick={saveLastReply}>Save all from the last reply</MenuBar.Item>
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
