import type { Story } from "@ladle/react";
import { useState } from "react";
import { Button } from "../Button";
import { Chat, ChatBlock, type ChatMessage } from "../Chat";
import { Stat } from "../Stat";
import { ChatDrawer } from "./ChatDrawer";

export default { title: "ChatDrawer" };

const ICON_PROPS = {
  viewBox: "0 0 16 16",
  width: 15,
  height: 15,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
} as const;

const ChatIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the control carries the label.
  <svg {...ICON_PROPS}>
    <path d="M2 3h12v8H6l-3 2v-2H2z" strokeLinejoin="round" />
  </svg>
);
const FilesIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the control carries the label.
  <svg {...ICON_PROPS}>
    <path d="M3 2h6l3 3v9H3z" strokeLinejoin="round" />
    <path d="M9 2v3h3" strokeLinejoin="round" />
  </svg>
);
const PlusIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the control carries the label.
  <svg {...ICON_PROPS}>
    <path d="M8 3v10M3 8h10" strokeLinecap="square" />
  </svg>
);

function Demo({ side, cellSize }: { side?: "left" | "right" | "bottom"; cellSize?: number }) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "1", role: "assistant", content: "Hi! Ask me anything and watch me **think**." },
  ]);

  const handleSubmit = (text: string) => {
    const base = String(Date.now());
    setMessages((prev) => [...prev, { id: `${base}-u`, role: "user", content: text }]);
    setBusy(true);
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `${base}-a`,
          role: "assistant",
          content: `You said: **${text}**.\n\nHere's a considered reply once I'm done thinking.`,
        },
      ]);
      setBusy(false);
    }, 2400);
  };

  return (
    <div style={{ blockSize: 520, border: "1px solid var(--sf-color-border-subtle)" }}>
      <ChatDrawer
        side={side}
        open={open}
        onOpenChange={setOpen}
        title="Assistant"
        thinking={busy}
        cellSize={cellSize}
        defaultSize={380}
        minSize={300}
        maxSize={640}
        messages={messages}
        onSubmit={handleSubmit}
      >
        {/* The main app content — the chat panel pushes it aside. */}
        <div
          style={{
            padding: "var(--sf-unit)",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <Button onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Open"} assistant</Button>
          <h1 style={{ margin: 0 }}>Your app</h1>
          <p style={{ margin: 0 }}>
            The assistant sits beside this content and pushes it — it doesn't overlay. Drag the
            divider to resize the panel. Send a message to watch the thinking ripple bloom.
          </p>
        </div>
      </ChatDrawer>
    </div>
  );
}

/** A resizable chat panel that pushes the app content aside. */
export const Default: Story = () => <Demo side="right" />;

/** Coarser thinking-effect grain: `cellSize` sets the shade-block size in px
 *  (default 7); send a message to compare the chunkier dither. */
export const CoarseGrain: Story = () => <Demo side="right" cellSize={14} />;

/** Left-edge variant. */
export const Left: Story = () => <Demo side="left" />;

/** Centered mode: the chat floats as a centered column instead of filling the
 *  panel. Drag either edge (or arrow-key it) and the opposite edge mirrors the
 *  move, so the column stays centered. Matters when the panel is wide or
 *  fullscreen. */
function CenteredDemo() {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Drag either edge of this chat: the other edge mirrors it, so the column stays centered. Try fullscreen too.",
    },
  ]);

  const handleSubmit = (text: string) => {
    const base = String(Date.now());
    setMessages((prev) => [...prev, { id: `${base}-u`, role: "user", content: text }]);
    setBusy(true);
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: `${base}-a`, role: "assistant", content: `You said: **${text}**.` },
      ]);
      setBusy(false);
    }, 2400);
  };

  return (
    <div style={{ blockSize: 520, border: "1px solid var(--sf-color-border-subtle)" }}>
      <ChatDrawer
        open={open}
        onOpenChange={setOpen}
        title="Assistant"
        thinking={busy}
        defaultSize={640}
        minSize={360}
        centered
        defaultChatWidth={420}
        minChatWidth={280}
        messages={messages}
        onSubmit={handleSubmit}
      >
        <div
          style={{
            padding: "var(--sf-unit)",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <Button onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Open"} assistant</Button>
          <h1 style={{ margin: 0 }}>Your app</h1>
          <p style={{ margin: 0 }}>
            With <code>centered</code>, the chat column floats on the panel's centre axis and both
            gutters show the wash and the thinking effect. Resizing works from either edge,
            mirrored, by pointer or arrow keys.
          </p>
        </div>
      </ChatDrawer>
    </div>
  );
}

export const Centered: Story = () => <CenteredDemo />;

/** Centered mode with app-populated `margins`: the chat reply carries custom
 *  widget parts; drag one into either margin to park it there as a reminder.
 *  The margins take whatever width the column leaves and hide their content
 *  (state preserved) when narrower than `marginMinWidth`. Drag the chat wider
 *  to watch them fold away and come back. */
const MARKET_WIDGETS: Record<
  string,
  { label: string; value: number; decimals?: number; delta: number }
> = {
  eurchf: { label: "EUR/CHF", value: 0.9312, decimals: 4, delta: -0.4 },
  smi: { label: "SMI", value: 12480, delta: 0.8 },
  gold: { label: "Gold USD/oz", value: 2510, delta: 1.2 },
};

function DraggableWidget({ id }: { id: string }) {
  const w = MARKET_WIDGETS[id];
  if (!w) return null;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: story demo drag source; parking is a pointer affordance, removal stays keyboard-reachable.
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      style={{ cursor: "grab" }}
    >
      <Stat
        label={w.label}
        value={w.value}
        decimals={w.decimals}
        delta={w.delta}
        size="sm"
        elevation={1}
      />
    </div>
  );
}

function ParkZone({
  parked,
  onPark,
  onRemove,
}: {
  parked: string[];
  onPark: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: story demo drop target for the parked-widget pattern.
    <div
      style={{
        blockSize: "100%",
        display: "grid",
        alignContent: "start",
        gap: "calc(var(--sf-unit) / 2)",
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        if (id in MARKET_WIDGETS) onPark(id);
      }}
    >
      <p style={{ margin: 0, fontSize: "var(--sf-font-size-sm)" }}>
        Drop a widget here to keep it in view.
      </p>
      {parked.map((id) => {
        const w = MARKET_WIDGETS[id];
        if (!w) return null;
        return (
          <div key={id} style={{ position: "relative" }}>
            <Stat
              label={w.label}
              value={w.value}
              decimals={w.decimals}
              delta={w.delta}
              size="sm"
              elevation={1}
            />
            <button
              type="button"
              aria-label={`Remove ${w.label}`}
              onClick={() => onRemove(id)}
              style={{
                position: "absolute",
                insetBlockStart: 4,
                insetInlineEnd: 4,
                border: 0,
                padding: 2,
                background: "transparent",
                cursor: "pointer",
                color: "var(--sf-color-fg)",
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

function CenteredMarginsDemo() {
  const [open, setOpen] = useState(true);
  const [parkedLeft, setParkedLeft] = useState<string[]>([]);
  const [parkedRight, setParkedRight] = useState<string[]>(["gold"]);

  const park = (setter: typeof setParkedLeft) => (id: string) =>
    setter((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const remove = (setter: typeof setParkedLeft) => (id: string) =>
    setter((prev) => prev.filter((p) => p !== id));

  const messages: ChatMessage[] = [
    {
      id: "1",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "Here are the market widgets you asked for. Drag one into a side margin to keep it in view while we talk.",
        },
        { type: "widget", partId: "w1", widgetId: "eurchf" },
        { type: "widget", partId: "w2", widgetId: "smi" },
      ],
    },
  ];

  return (
    <div style={{ blockSize: 560, border: "1px solid var(--sf-color-border-subtle)" }}>
      <ChatDrawer
        open={open}
        onOpenChange={setOpen}
        title="Assistant"
        defaultSize={780}
        minSize={360}
        centered
        defaultChatWidth={400}
        minChatWidth={280}
        margins={{
          left: (
            <ParkZone
              parked={parkedLeft}
              onPark={park(setParkedLeft)}
              onRemove={remove(setParkedLeft)}
            />
          ),
          right: (
            <ParkZone
              parked={parkedRight}
              onPark={park(setParkedRight)}
              onRemove={remove(setParkedRight)}
            />
          ),
        }}
        messages={messages}
        onSubmit={() => {}}
        renderPart={(part) =>
          part.type === "widget" ? (
            <ChatBlock title="widget">
              <DraggableWidget id={String((part as { widgetId?: unknown }).widgetId)} />
            </ChatBlock>
          ) : null
        }
      >
        <div
          style={{
            padding: "var(--sf-unit)",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <Button onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Open"} assistant</Button>
          <h1 style={{ margin: 0 }}>Your app</h1>
          <p style={{ margin: 0 }}>
            The margins beside the centered chat are app-owned slots: here they park widgets dragged
            out of the conversation. Widen the chat (or shrink the panel) and the margin content
            hides once it drops under <code>marginMinWidth</code>; give it room and it returns,
            state intact.
          </p>
        </div>
      </ChatDrawer>
    </div>
  );
}

export const CenteredMargins: Story = () => <CenteredMarginsDemo />;

/** Multi-view mode: the header is an icon bar — one icon per view (chat + a
 *  Files panel) plus a custom "New chat" action — and the body swaps to match. */
function ViewsDemo() {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "1", role: "assistant", content: "This chat is one of several **views**." },
  ]);

  const handleSubmit = (text: string) => {
    const base = String(Date.now());
    setMessages((prev) => [...prev, { id: `${base}-u`, role: "user", content: text }]);
    setBusy(true);
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: `${base}-a`, role: "assistant", content: `You said: **${text}**.` },
      ]);
      setBusy(false);
    }, 2400);
  };

  const reset = () =>
    setMessages([{ id: "1", role: "assistant", content: "Fresh chat. What's next?" }]);

  return (
    <div style={{ blockSize: 520, border: "1px solid var(--sf-color-border-subtle)" }}>
      <ChatDrawer
        open={open}
        onOpenChange={setOpen}
        title="Workspace"
        thinking={busy}
        defaultSize={400}
        minSize={320}
        maxSize={640}
        actions={
          <button
            type="button"
            onClick={reset}
            aria-label="New chat"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              inlineSize: "calc(var(--sf-unit) * 1.25)",
              blockSize: "calc(var(--sf-unit) * 1.25)",
              padding: 0,
              background: "transparent",
              color: "var(--sf-color-fg)",
              border: 0,
              borderRadius: "var(--sf-radius-default)",
              cursor: "pointer",
            }}
          >
            <PlusIcon />
          </button>
        }
        views={[
          {
            id: "chat",
            icon: <ChatIcon />,
            label: "Chat",
            content: (
              <Chat
                height="100%"
                style={{ boxShadow: "var(--sf-elevation-2)" }}
                messages={messages}
                onSubmit={handleSubmit}
                disabled={busy}
              />
            ),
          },
          {
            id: "files",
            icon: <FilesIcon />,
            label: "Files",
            content: (
              <div
                style={{
                  blockSize: "100%",
                  padding: "var(--sf-unit)",
                  background: "var(--sf-color-bg)",
                  boxShadow: "var(--sf-elevation-2)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <h3 style={{ margin: 0 }}>Files</h3>
                <p style={{ margin: 0 }}>
                  Any content can live in a view — switch back to chat with the header icons.
                </p>
              </div>
            ),
          },
        ]}
      >
        <div
          style={{
            padding: "var(--sf-unit)",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <Button onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Open"} workspace</Button>
          <h1 style={{ margin: 0 }}>Your app</h1>
          <p style={{ margin: 0 }}>
            The drawer header carries one icon per view plus your own action icons. Click an icon to
            swap the panel body; the chat view keeps its state while you're away.
          </p>
        </div>
      </ChatDrawer>
    </div>
  );
}

export const Views: Story = () => <ViewsDemo />;
