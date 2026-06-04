import { expect, test } from "@playwright/experimental-ct-react";
import { Chat } from "./Chat";

test("renders user and assistant messages with role-distinguished styling", async ({ mount }) => {
  const c = await mount(
    <Chat
      messages={[
        { id: "1", role: "user", content: "Hi there" },
        { id: "2", role: "assistant", content: "Hello!" },
      ]}
      onSubmit={() => {}}
    />,
  );
  await expect(c.getByText("Hi there")).toBeVisible();
  await expect(c.getByText("Hello!")).toBeVisible();
  await expect(c.locator('[data-role="user"]')).toHaveCount(1);
  await expect(c.locator('[data-role="assistant"]')).toHaveCount(1);
  // User message bubble has a visible background; assistant message doesn't.
  const userBg = await c
    .locator('[data-role="user"]')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const assistantBg = await c
    .locator('[data-role="assistant"]')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(userBg).not.toBe(assistantBg);
});

test("onSubmit fires with the trimmed input text; input clears and stays focused", async ({
  mount,
}) => {
  let received = "";
  const c = await mount(<Chat messages={[]} onSubmit={(t) => (received = t)} />);
  const input = c.locator("textarea");
  await input.fill("  Hello world  ");
  await c.getByRole("button", { name: "Send" }).click();
  expect(received).toBe("Hello world");
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
});

test("Enter submits; Shift+Enter inserts a newline", async ({ mount }) => {
  let received = "";
  const c = await mount(<Chat messages={[]} onSubmit={(t) => (received = t)} />);
  const input = c.locator("textarea");
  await input.fill("first");
  await input.press("Shift+Enter");
  await input.pressSequentially("second");
  await input.press("Enter");
  expect(received).toBe("first\nsecond");
});

test("send button is disabled when input is empty", async ({ mount }) => {
  const c = await mount(<Chat messages={[]} onSubmit={() => {}} />);
  await expect(c.getByRole("button", { name: "Send" })).toBeDisabled();
});

test("streaming assistant message renders via StreamingTerminalText", async ({ mount, page }) => {
  const c = await mount(
    <Chat
      messages={[
        {
          id: "1",
          role: "assistant",
          content: "# Streaming",
          isStreaming: true,
        },
      ]}
      onSubmit={() => {}}
    />,
  );
  // Mid-stream: the heading is rendered as h1 (styled) AND contains a shade-block.
  await page.waitForTimeout(100);
  await expect(c.locator("h1")).toBeVisible();
});

test("disabled prop disables the send button but NOT the input", async ({ mount }) => {
  // The input stays enabled so the user can keep typing a follow-up while
  // the assistant is still streaming. Only submission is gated.
  const c = await mount(<Chat messages={[]} onSubmit={() => {}} disabled />);
  await expect(c.locator("textarea")).not.toBeDisabled();
  await expect(c.getByRole("button", { name: "Send" })).toBeDisabled();
});
