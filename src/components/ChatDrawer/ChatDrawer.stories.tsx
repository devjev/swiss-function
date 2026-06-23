import type { Story } from "@ladle/react";
import { useState } from "react";
import { Button } from "../Button";
import type { ChatMessage } from "../Chat";
import { ChatDrawer, type ChatDrawerProps } from "./ChatDrawer";

export default { title: "ChatDrawer" };

type DemoProps = Pick<ChatDrawerProps, "side" | "padding" | "effect" | "color" | "speed">;

function Demo({ side, padding, effect, color, speed }: DemoProps) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "1", role: "assistant", content: "Hi! Ask me anything and watch me **think**." },
  ]);

  const handleSubmit = (text: string) => {
    const base = String(Date.now());
    setMessages((prev) => [...prev, { id: `${base}-u`, role: "user", content: text }]);
    setBusy(true);
    // Simulate an LLM call: thinking for a beat, then a reply.
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
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <p>Thinking events: {events.length ? events.join(" → ") : "—"}</p>
      <ChatDrawer
        open={open}
        onOpenChange={setOpen}
        trigger={<Button>Open chat</Button>}
        title="Assistant"
        side={side}
        padding={padding}
        effect={effect}
        color={color}
        speed={speed}
        thinking={busy}
        onThinkingStart={() => setEvents((e) => [...e, "start"])}
        onThinkingEnd={() => setEvents((e) => [...e, "end"])}
        messages={messages}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

/**
 * A chat in a right-edge drawer. Send a message: while the agent "thinks", a
 * ripple blooms from the centre and fills the 1u padding frame around the chat,
 * then clears when the reply lands. `onThinkingStart`/`End` fire on the edges.
 */
export const Default: Story = () => (
  <Demo side="right" padding={1} effect="ripple" color="var(--sf-color-primary)" speed={1} />
);

/**
 * A bottom drawer with a larger padding gutter and a different effect/colour/
 * speed — the same thinking bloom, more of it on show.
 */
export const BottomVariant: Story = () => (
  <Demo side="bottom" padding={2} effect="plasma" color="var(--sf-color-success)" speed={1.6} />
);
