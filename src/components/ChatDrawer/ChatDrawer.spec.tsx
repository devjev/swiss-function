import { expect, test } from "@playwright/experimental-ct-react";
import type { ChatMessage } from "../Chat";
import { ChatDrawer } from "./ChatDrawer";

const messages: ChatMessage[] = [{ id: "1", role: "assistant", content: "Hello" }];

test("open shows the chat input in the pushed panel", async ({ mount }) => {
  const c = await mount(
    <div style={{ inlineSize: 800, blockSize: 400 }}>
      <ChatDrawer defaultOpen messages={messages} onSubmit={() => {}}>
        <div>app content</div>
      </ChatDrawer>
    </div>,
  );
  await expect(c.getByText("app content")).toBeVisible();
  await expect(c.getByPlaceholder("Ask anything…")).toBeVisible();
  // The resize divider is present while open.
  await expect(c.getByRole("separator")).toBeVisible();
});

test("header has a fullscreen toggle and a close button", async ({ mount }) => {
  const c = await mount(
    <div style={{ inlineSize: 800, blockSize: 400 }}>
      <ChatDrawer defaultOpen title="Assistant" messages={messages} onSubmit={() => {}}>
        <div>app content</div>
      </ChatDrawer>
    </div>,
  );
  await expect(c.getByRole("heading", { name: "Assistant" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Close", exact: true })).toBeVisible();
  const fs = c.getByRole("button", { name: "Enter fullscreen" });
  await expect(fs).toBeVisible();
  await fs.click();
  await expect(c.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
});

test("thinking mounts the effect canvas", async ({ mount }) => {
  const c = await mount(
    <div style={{ inlineSize: 800, blockSize: 400 }}>
      <ChatDrawer defaultOpen thinking messages={messages} onSubmit={() => {}}>
        <div>app content</div>
      </ChatDrawer>
    </div>,
  );
  await expect(c.locator("canvas")).toHaveCount(1);
});

test("forwards reveal to the inner Chat (mode=stream resolves streaming text fast)", async ({
  mount,
  page,
}) => {
  const content = "Streaming a fairly long assistant reply of many tokens indeed here";
  const c = await mount(
    <div style={{ inlineSize: 800, blockSize: 400 }}>
      <ChatDrawer
        defaultOpen
        messages={[{ id: "a", role: "assistant", content, isStreaming: true }]}
        onSubmit={() => {}}
        reveal={{ mode: "stream", tailLength: 3, charIntervalMs: 20 }}
      >
        <div>app content</div>
      </ChatDrawer>
    </div>,
  );
  await page.waitForTimeout(80);
  const txt = (await c.textContent()) ?? "";
  const resolved = txt.replace(/[▒▓█ ]/g, "");
  const nonWs = content.replace(/\s/g, "");
  // With reveal forwarded, stream mode has resolved almost everything already;
  // the default dramatic reveal would show only a few characters by now.
  expect(resolved.length).toBeGreaterThan(nonWs.length - 6);
});

test("forwards reveal={false}: streaming text lands as plain markdown", async ({ mount }) => {
  const c = await mount(
    <div style={{ inlineSize: 800, blockSize: 400 }}>
      <ChatDrawer
        defaultOpen
        messages={[{ id: "a", role: "assistant", content: "Hello **world**", isStreaming: true }]}
        onSubmit={() => {}}
        reveal={false}
      >
        <div>app content</div>
      </ChatDrawer>
    </div>,
  );
  await expect(c.getByText("world")).toBeVisible();
  const txt = (await c.textContent()) ?? "";
  expect(/[▒▓█]/.test(txt)).toBe(false);
});
