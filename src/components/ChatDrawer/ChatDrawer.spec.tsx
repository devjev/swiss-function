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
