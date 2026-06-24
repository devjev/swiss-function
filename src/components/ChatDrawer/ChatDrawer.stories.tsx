import type { Story } from "@ladle/react";
import { useState } from "react";
import { Button } from "../Button";
import type { ChatMessage } from "../Chat";
import { ChatDrawer } from "./ChatDrawer";

export default { title: "ChatDrawer" };

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
