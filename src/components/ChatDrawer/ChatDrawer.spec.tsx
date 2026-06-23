import { expect, test } from "@playwright/experimental-ct-react";
import { Button } from "../Button";
import type { ChatMessage } from "../Chat";
import { ChatDrawer } from "./ChatDrawer";

const messages: ChatMessage[] = [{ id: "1", role: "assistant", content: "Hello" }];

test("opens from the trigger and shows the chat input", async ({ mount, page }) => {
  await mount(
    <ChatDrawer trigger={<Button>Open chat</Button>} messages={messages} onSubmit={() => {}} />,
  );
  await expect(page.getByPlaceholder("Ask anything…")).toHaveCount(0);
  await page.getByRole("button", { name: "Open chat" }).click();
  await expect(page.getByPlaceholder("Ask anything…")).toBeVisible();
});

test("shows the thinking background only while thinking", async ({ mount, page }) => {
  const c = await mount(
    <ChatDrawer
      defaultOpen
      trigger={<Button>Open chat</Button>}
      messages={messages}
      onSubmit={() => {}}
    />,
  );
  // Idle → no effect canvas behind the chat.
  await expect(page.locator("canvas")).toHaveCount(0);

  await c.update(
    <ChatDrawer
      defaultOpen
      thinking
      trigger={<Button>Open chat</Button>}
      messages={messages}
      onSubmit={() => {}}
    />,
  );
  // Thinking → the NonIdealState effect mounts.
  await expect(page.locator("canvas")).toHaveCount(1);
});
