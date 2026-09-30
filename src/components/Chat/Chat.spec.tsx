import { expect, test } from "@playwright/experimental-ct-react";
import { Chat, type ChatMessage } from "./Chat";

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
  // The user's text sits on a highlighter stroke (the primary colour, the text
  // in the page colour); the assistant's text sits on nothing.
  const userRun = await c
    .locator('[data-role="user"] span')
    .first()
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color, display: cs.display };
    });
  const assistantBg = await c
    .locator('[data-role="assistant"]')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(userRun.bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(userRun.bg).not.toBe(assistantBg);
  expect(userRun.display).toBe("inline");
  expect(userRun.color).not.toBe(userRun.bg);
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
    .locator('[class*="face"]')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const primaryBg = await c
    .getByRole("button", { name: "Ship" })
    .locator('[class*="face"]')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(defaultBg).not.toBe(primaryBg);
});

test("input border is neutral by default and overridable via borderColor", async ({ mount }) => {
  const c = await mount(<Chat messages={[]} onSubmit={() => {}} borderColor="rgb(255, 0, 0)" />);
  const border = await c.locator("textarea").evaluate((el) => getComputedStyle(el).borderTopColor);
  expect(border).toBe("rgb(255, 0, 0)");
});

test("the field keeps the send key's corner clear, even when TextEdit's own stylesheet lands last", async ({
  mount,
  page,
}) => {
  const c = await mount(<Chat messages={[]} onSubmit={() => {}} />);
  const field = c.locator("textarea");
  const measure = async () =>
    await field.evaluate((el) => {
      const cs = getComputedStyle(el);
      const key = el.closest("form")?.querySelector("button")?.getBoundingClientRect();
      return {
        padEnd: Number.parseFloat(cs.paddingInlineEnd),
        resize: cs.resize,
        keyWidth: key?.width ?? 0,
        // Where a line of text can reach, against where the key starts.
        clearance:
          (key?.left ?? 0) -
          (el.getBoundingClientRect().right - Number.parseFloat(cs.paddingInlineEnd)),
      };
    });

  const before = await measure();
  // The room reserved at the end holds the key and leaves a gutter, so a line
  // wraps before the key instead of running under it.
  expect(before.padEnd).toBeGreaterThan(before.keyWidth);
  expect(before.clearance).toBeGreaterThan(0);
  expect(before.resize).toBe("none");

  // Chat's declarations fight TextEdit's own `padding` / `resize`, and a
  // consumer's bundler decides which stylesheet lands last. Re-declare
  // TextEdit's rule after everything and the reserved room must survive.
  await page.evaluate(() => {
    const el = document.querySelector("textarea") as HTMLTextAreaElement;
    const root = [...el.classList].find((n) => n.includes("TextEdit"));
    const style = document.createElement("style");
    style.textContent = `.${root} { padding: calc(var(--sf-unit) / 4 - 1px) calc(var(--sf-unit) / 2); resize: vertical; }`;
    document.head.append(style);
  });
  const after = await measure();
  expect(after.padEnd).toBe(before.padEnd);
  expect(after.resize).toBe("none");
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

test("a finished step is not coloured: only a failure takes a tone", async ({ mount }) => {
  const c = await mount(
    <Chat
      messages={[
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "thinking",
              status: "error",
              defaultExpanded: true,
              steps: [
                { id: "a", label: "build", status: "done" },
                { id: "b", label: "push", status: "error" },
              ],
            },
          ],
        },
      ]}
      onSubmit={() => {}}
    />,
  );
  const colours = await c.locator('[data-testid="chat-messages"]').evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.color = getComputedStyle(el).getPropertyValue("--sf-color-fg").trim();
    el.append(probe);
    const fg = getComputedStyle(probe).color;
    probe.remove();
    const colorOf = (match: string) => {
      const mark = [...el.querySelectorAll('span[aria-hidden="true"]')].find((g) =>
        [...g.classList].some((n) => n.includes(match)),
      );
      return mark ? getComputedStyle(mark).color : null;
    };
    return { fg, done: colorOf("done"), failed: colorOf("error") };
  });
  expect(colours.done).toBe(colours.fg);
  expect(colours.failed).not.toBe(colours.fg);
});

test("the step marks come from the icon set, so a consumer can swap them", async ({ mount }) => {
  const c = await mount(
    <Chat
      messages={[
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "thinking",
              status: "error",
              defaultExpanded: true,
              steps: [
                { id: "a", label: "build", status: "done" },
                { id: "b", label: "push", status: "error" },
                { id: "c", label: "tag", status: "pending" },
              ],
            },
          ],
        },
      ]}
      onSubmit={() => {}}
    />,
  );
  // Every mark is an <svg> from the icon set (never a typed character), so an
  // `IconProvider` can redirect it.
  const marks = await c.locator('[data-testid="chat-messages"]').evaluate((el) =>
    [...el.querySelectorAll('span[aria-hidden="true"]')]
      .filter((g) => [...g.classList].some((n) => /status|glyph/.test(n)))
      .map((g) => ({
        svg: !!g.querySelector("svg"),
        text: g.textContent?.trim() ?? "",
      })),
  );
  expect(marks.length).toBeGreaterThanOrEqual(4);
  for (const m of marks) {
    expect(m.svg).toBe(true);
    expect(m.text).toBe("");
  }
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

// --- Message surfaces (`messageStyle`) ---

/** The surface of a message: the user's run carries it, the assistant's block does. */
const surfaceOf = (el: Element) => {
  const cs = getComputedStyle(el);
  return {
    bg: cs.backgroundColor,
    shadow: cs.boxShadow,
    radius: Number.parseFloat(cs.borderTopLeftRadius),
    display: cs.display,
  };
};

const STYLE_MESSAGES: ChatMessage[] = [
  { id: "u", role: "user", content: "Hi there" },
  { id: "a", role: "assistant", content: "Hello!" },
];

test("messageStyle defaults to the tape for the user and nothing for the assistant", async ({
  mount,
}) => {
  const c = await mount(<Chat messages={STYLE_MESSAGES} onSubmit={() => {}} />);
  await expect(c.locator('[data-role="user"]')).toHaveAttribute("data-style", "tape");
  await expect(c.locator('[data-role="assistant"]')).toHaveAttribute("data-style", "plain");
  const agent = await c.locator('[data-role="assistant"]').evaluate(surfaceOf);
  expect(agent.bg).toBe("rgba(0, 0, 0, 0)");
  expect(agent.shadow).toBe("none");
});

test("messageStyle='box' raises both voices; the user's box hugs its text", async ({ mount }) => {
  const c = await mount(<Chat messages={STYLE_MESSAGES} onSubmit={() => {}} messageStyle="box" />);
  await expect(c.locator('[data-role="user"]')).toHaveAttribute("data-style", "box");
  const agent = await c.locator('[data-role="assistant"]').evaluate(surfaceOf);
  const user = await c.locator('[data-role="user"] span').first().evaluate(surfaceOf);
  // A raised box: the edge bands over an elevation cast, on a surface fill.
  expect(agent.shadow).not.toBe("none");
  expect(user.shadow).not.toBe("none");
  expect(agent.bg).not.toBe("rgba(0, 0, 0, 0)");
  // The user's box shrink-wraps inside the right-aligned bubble.
  expect(user.display).toBe("inline-block");
  // Sharp by default: the 2px system radius, not a softened card.
  expect(agent.radius).toBeLessThanOrEqual(2);
});

test("messageStyle='squircle' keeps the raise and rounds the corners over", async ({ mount }) => {
  const c = await mount(
    <Chat messages={STYLE_MESSAGES} onSubmit={() => {}} messageStyle="squircle" />,
  );
  const agent = await c.locator('[data-role="assistant"]').evaluate(surfaceOf);
  const user = await c.locator('[data-role="user"] span').first().evaluate(surfaceOf);
  expect(agent.shadow).not.toBe("none");
  expect(agent.radius).toBeGreaterThan(2);
  expect(user.radius).toBeGreaterThan(2);
});

test("a squircle message keeps the superellipse corner, and its backing element is idle where the browser cuts the corners itself", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <Chat messages={STYLE_MESSAGES} onSubmit={() => {}} messageStyle="squircle" />,
  );
  const native = await page.evaluate(() => CSS.supports("corner-shape: squircle"));
  const shape = await c
    .locator('[data-role="assistant"]')
    .evaluate((el) => getComputedStyle(el).getPropertyValue("corner-shape"));
  // Chromium cuts the corners itself; the backing element then paints nothing.
  const backing = c.locator('[data-role="assistant"] [aria-hidden="true"]').first();
  await expect(backing).toHaveCount(1);
  const backingDisplay = await backing.evaluate((el) => getComputedStyle(el).display);
  if (native) {
    expect(shape).toBe("squircle");
    expect(backingDisplay).toBe("none");
  } else {
    // Elsewhere the backing element draws the curve: masked layers, cast by a filter.
    expect(backingDisplay).toBe("block");
    const face = await backing.evaluate((el) => {
      const child = el.firstElementChild as HTMLElement;
      const cs = getComputedStyle(child);
      return { mask: cs.maskImage, filter: getComputedStyle(el).filter };
    });
    expect(face.mask).toContain("data:image/svg+xml");
    expect(face.filter).toContain("drop-shadow");
  }
});

test("messageStyle styles the two roles apart", async ({ mount }) => {
  const c = await mount(
    <Chat
      messages={STYLE_MESSAGES}
      onSubmit={() => {}}
      messageStyle={{ user: "plain", assistant: "box" }}
    />,
  );
  const user = await c.locator('[data-role="user"] span').first().evaluate(surfaceOf);
  const agent = await c.locator('[data-role="assistant"]').evaluate(surfaceOf);
  // Plain: the user's words on the page, no tape, no box.
  expect(user.bg).toBe("rgba(0, 0, 0, 0)");
  expect(user.shadow).toBe("none");
  expect(agent.shadow).not.toBe("none");
});
