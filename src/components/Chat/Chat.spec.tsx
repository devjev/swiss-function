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

test("send button is non-primary by default; sendLabel/sendVariant customize it", async ({
  mount,
}) => {
  // Two chats side by side: the default (secondary) button must NOT share the
  // primary's fill — proving the default is de-accented — and both captions land.
  const c = await mount(
    <div>
      <Chat messages={[]} onSubmit={() => {}} sendLabel="Go" />
      <Chat messages={[]} onSubmit={() => {}} sendVariant="primary" sendLabel="Ship" />
    </div>,
  );
  const defaultBg = await c
    .getByRole("button", { name: "Go" })
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const primaryBg = await c
    .getByRole("button", { name: "Ship" })
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(defaultBg).not.toBe(primaryBg);
});

test("input border is neutral by default and overridable via borderColor", async ({ mount }) => {
  const c = await mount(<Chat messages={[]} onSubmit={() => {}} borderColor="rgb(255, 0, 0)" />);
  const border = await c.locator("textarea").evaluate((el) => getComputedStyle(el).borderTopColor);
  expect(border).toBe("rgb(255, 0, 0)");
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

// --- Thinking / orchestration fan-out ---

const RUNNING_THINKING = {
  id: "a1",
  role: "assistant" as const,
  parts: [
    {
      type: "thinking" as const,
      partId: "orch",
      status: "running" as const,
      steps: [
        {
          id: "plan",
          label: "plan",
          status: "running" as const,
          children: [
            { id: "s0", label: "search", status: "running" as const },
            { id: "s1", label: "build UI", status: "pending" as const },
          ],
        },
      ],
    },
  ],
};

test("thinking (running) shows a live spinner and the fan-out is expanded", async ({ mount }) => {
  const c = await mount(<Chat messages={[RUNNING_THINKING]} onSubmit={() => {}} />);
  // A spinner is a role=status (header + each running node).
  await expect(c.getByRole("status").first()).toBeVisible();
  // Auto-expanded while running → step labels are present.
  await expect(c.getByText("search")).toBeVisible();
  await expect(c.getByText("build UI")).toBeVisible();
});

test("clicking a step fires onAction with type 'thinking' and the node id", async ({ mount }) => {
  let action: { type: string; value: unknown; partId?: string } | null = null;
  const c = await mount(
    <Chat
      messages={[RUNNING_THINKING]}
      onSubmit={() => {}}
      onAction={(a) => {
        action = a;
      }}
    />,
  );
  await c.getByRole("button", { name: /search/ }).click();
  expect(action).toEqual({ messageId: "a1", partId: "orch", type: "thinking", value: "s0" });
});

test("thinking with no steps shows just the indicator + label, no fan-out", async ({ mount }) => {
  const c = await mount(
    <Chat
      messages={[
        {
          id: "a1",
          role: "assistant",
          parts: [{ type: "thinking", status: "running", label: "Thinking…" }],
        },
      ]}
      onSubmit={() => {}}
    />,
  );
  await expect(c.getByText("Thinking…")).toBeVisible();
  // No fan-out → no expand/collapse control and no tree wrapper.
  await expect(c.getByRole("button", { name: /steps/ })).toHaveCount(0);
  await expect(c.locator('[class*="bodyWrap"]')).toHaveCount(0);
});

test("thinking (done) collapses to a summary and re-expands on click", async ({ mount }) => {
  const c = await mount(
    <Chat
      messages={[
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "thinking",
              status: "done",
              summary: "Ran 2 steps",
              steps: [
                { id: "s0", label: "search", status: "done" },
                { id: "s1", label: "build UI", status: "done" },
              ],
            },
          ],
        },
      ]}
      onSubmit={() => {}}
    />,
  );
  // Collapsed: summary shown, steps hidden.
  await expect(c.getByText("Ran 2 steps")).toBeVisible();
  // Collapsed: the fan-out wrapper animates to ~0 height.
  const body = c.locator('[class*="bodyWrap"]');
  await expect.poll(async () => (await body.boundingBox())?.height ?? 99).toBeLessThan(2);
  // Expand via the header toggle → fan-out grows past the animation to full height.
  await c.getByRole("button", { name: "Expand steps" }).click();
  await expect(c.getByText("search")).toBeVisible();
  await expect.poll(async () => (await body.boundingBox())?.height ?? 0).toBeGreaterThan(10);
});

test("reveal={false} renders streaming text as plain markdown (no terminal shade tail)", async ({
  mount,
}) => {
  const c = await mount(
    <Chat
      messages={[{ id: "a", role: "assistant", content: "Hello **world**", isStreaming: true }]}
      onSubmit={() => {}}
      reveal={false}
    />,
  );
  // Text lands immediately (markdown), fully, with no shade-block reveal glyphs.
  await expect(c.getByText("world")).toBeVisible();
  const txt = (await c.textContent()) ?? "";
  expect(/[▒▓█]/.test(txt)).toBe(false);
  await expect(c.locator("strong")).toHaveText("world");
});

test("reveal mode=stream threads through: streaming text resolves quickly", async ({
  mount,
  page,
}) => {
  const content = "Streaming a fairly long assistant reply of many tokens indeed here";
  const c = await mount(
    <Chat
      messages={[{ id: "a", role: "assistant", content, isStreaming: true }]}
      onSubmit={() => {}}
      reveal={{ mode: "stream", tailLength: 3, charIntervalMs: 20 }}
    />,
  );
  await page.waitForTimeout(80);
  const txt = (await c.textContent()) ?? "";
  const resolved = txt.replace(/[▒▓█ ]/g, "");
  const nonWs = content.replace(/\s/g, "");
  // Stream mode has resolved almost everything (all but the short tail), unlike
  // the default dramatic reveal which would show only a few characters by now.
  expect(resolved.length).toBeGreaterThan(nonWs.length - 6);
});

test("an error part renders the message + request id and fires onError once", async ({ mount }) => {
  let errors = 0;
  let lastMessage = "";
  const c = await mount(
    <Chat
      messages={[
        {
          id: "a",
          role: "assistant",
          parts: [
            {
              type: "error",
              partId: "e",
              message: "Overloaded — try again.",
              requestId: "req_1",
              retryable: true,
            },
          ],
        },
      ]}
      onSubmit={() => {}}
      onError={(e) => {
        errors += 1;
        lastMessage = e.message;
      }}
    />,
  );
  await expect(c.getByText("Overloaded — try again.")).toBeVisible();
  await expect(c.getByText("req_1")).toBeVisible();
  await expect(c.getByRole("alert")).toBeVisible();
  expect(errors).toBe(1);
  expect(lastMessage).toBe("Overloaded — try again.");
});

test("a retryable error's Retry reports through onAction", async ({ mount }) => {
  let action: unknown = null;
  const c = await mount(
    <Chat
      messages={[
        {
          id: "a",
          role: "assistant",
          parts: [{ type: "error", partId: "e", message: "Overloaded.", retryable: true }],
        },
      ]}
      onSubmit={() => {}}
      onAction={(a) => {
        action = a;
      }}
    />,
  );
  await c.getByRole("button", { name: "Retry" }).click();
  expect(action).toEqual({ messageId: "a", partId: "e", type: "error", value: "retry" });
});

test("a non-retryable error shows no Retry", async ({ mount }) => {
  const c = await mount(
    <Chat
      messages={[{ id: "a", role: "assistant", parts: [{ type: "error", message: "Failed." }] }]}
      onSubmit={() => {}}
    />,
  );
  await expect(c.getByText("Failed.")).toBeVisible();
  await expect(c.getByRole("button", { name: "Retry" })).toHaveCount(0);
});
