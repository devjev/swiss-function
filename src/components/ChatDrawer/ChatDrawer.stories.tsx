import type { Story } from "@ladle/react";
import { useState } from "react";
import { Button } from "../Button";
import { Chat, type ChatMessage } from "../Chat";
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

function Demo({ side }: { side?: "left" | "right" | "bottom" }) {
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

/** Left-edge variant. */
export const Left: Story = () => <Demo side="left" />;

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
