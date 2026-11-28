import { expect, test } from "@playwright/experimental-ct-react";
import { DEFAULT_UNIT_PX as U } from "../../lib/useCssPx";
import { Chat, type ChatMessage } from "./Chat";
import { CompletionHarness, PromptHarness, TableHarness } from "./Chat.harness";

test("the user's turn is a full-width band, the assistant's text sits on the page", async ({
  mount,
}) => {
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
  const shape = await c.getByTestId("chat-messages").evaluate((el) => {
    const user = el.querySelector('[data-role="user"]') as HTMLElement;
    const assistant = el.querySelector('[data-role="assistant"]') as HTMLElement;
    const u = user.getBoundingClientRect();
    const a = assistant.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(user);
    const text = range.getBoundingClientRect();
    return {
      userBg: getComputedStyle(user).backgroundColor,
      assistantBg: getComputedStyle(assistant).backgroundColor,
      // The band runs edge to edge; both voices start in the same column.
      bandWidth: Math.round(u.width),
      scroller: el.clientWidth,
      userTextLeft: Math.round(text.left),
      assistantLeft: Math.round(a.left),
      align: getComputedStyle(user).textAlign,
      font: getComputedStyle(assistant).fontFamily,
      userFont: getComputedStyle(user).fontFamily,
    };
  });
  expect(shape.userBg).not.toBe("rgba(0, 0, 0, 0)");
  expect(shape.assistantBg).toBe("rgba(0, 0, 0, 0)");
  expect(shape.bandWidth).toBe(shape.scroller);
  expect(shape.userTextLeft).toBe(shape.assistantLeft);
  expect(shape.align).toBe("start");
  // One face for the whole window: the terminal's.
  expect(shape.font).toContain("monospace");
  expect(shape.userFont).toBe(shape.font);
});

test("onSubmit fires with the trimmed input text; input clears and stays focused", async ({
  mount,
}) => {
  let received = "";
  const c = await mount(<Chat messages={[]} onSubmit={(t) => (received = t)} sendKey />);
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
  const c = await mount(<Chat messages={[]} onSubmit={() => {}} sendKey />);
  await expect(c.getByRole("button", { name: "Send" })).toBeDisabled();
});

test("the send key is hidden for a mouse by default and absent with sendKey={false}", async ({
  mount,
}) => {
  // A keyboard submits with Enter, as in a terminal; the key is for a finger.
  const c = await mount(
    <div>
      <Chat messages={[]} onSubmit={() => {}} sendLabel="Auto" />
      <Chat messages={[]} onSubmit={() => {}} sendLabel="Never" sendKey={false} />
    </div>,
  );
  await expect(c.locator('button[aria-label="Auto"]')).toHaveCount(1);
  await expect(c.locator('button[aria-label="Auto"]')).toBeHidden();
  await expect(c.locator('button[aria-label="Never"]')).toHaveCount(0);
  // With no key the field keeps no room for one.
  const pad = await c
    .locator("textarea")
    .first()
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return Number.parseFloat(cs.paddingInlineEnd) / Number.parseFloat(cs.lineHeight);
    });
  expect(pad).toBeLessThan(1);
});

test("send button is non-primary by default; sendLabel/sendVariant customize it", async ({
  mount,
}) => {
  // Two chats side by side: the default (ghost) key has no fill and so does
  // not share the primary's, and both captions land.
  const c = await mount(
    <div>
      <Chat messages={[]} onSubmit={() => {}} sendKey sendLabel="Go" />
      <Chat messages={[]} onSubmit={() => {}} sendKey sendVariant="primary" sendLabel="Ship" />
    </div>,
  );
  const defaultBg = await c
    .getByRole("button", { name: "Go" })
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const primaryBg = await c
    .getByRole("button", { name: "Ship" })
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(defaultBg).toBe("rgba(0, 0, 0, 0)");
  expect(defaultBg).not.toBe(primaryBg);
  // A one-unit square on the field's line, a quarter unit off its end edge.
  const key = await c.getByRole("button", { name: "Go" }).boundingBox();
  const field = await c.locator("textarea").first().boundingBox();
  if (!key || !field) throw new Error("no send key");
  expect(key.width).toBeCloseTo(key.height, 0);
  expect(key.height).toBeCloseTo(U, 0);
  expect(field.x + field.width - (key.x + key.width)).toBeCloseTo(key.width / 4, 0);
  expect(field.y + field.height - (key.y + key.height)).toBeCloseTo(0, 0);
});

test("the editor sits between two rules, coloured by borderColor; the field has no box", async ({
  mount,
}) => {
  const c = await mount(
    <Chat
      messages={[]}
      onSubmit={() => {}}
      borderColor="rgb(255, 0, 0)"
      footer={[{ left: "~/app" }]}
    />,
  );
  const shape = await c.locator("form").evaluate((form) => {
    const kids = [...form.children] as HTMLElement[];
    const field = form.querySelector("textarea") as HTMLElement;
    const cs = getComputedStyle(field);
    const stroke = (el: HTMLElement) => getComputedStyle(el, "::after").backgroundColor;
    return {
      order: kids.map((k) => (k.querySelector("textarea") ? "field" : "rule")),
      strokes: [stroke(kids[0] as HTMLElement), stroke(kids[kids.length - 1] as HTMLElement)],
      ruleHeight: kids[0]?.getBoundingClientRect().height ?? 0,
      // A rule runs edge to edge.
      ruleWidth: Math.round(kids[0]?.getBoundingClientRect().width ?? 0),
      formWidth: Math.round(form.getBoundingClientRect().width),
      border: cs.borderTopWidth,
      shadow: cs.boxShadow,
      fieldHeight: field.getBoundingClientRect().height,
    };
  });
  expect(shape.order).toEqual(["rule", "field", "rule"]);
  expect(shape.strokes).toEqual(["rgb(255, 0, 0)", "rgb(255, 0, 0)"]);
  expect(shape.ruleWidth).toBe(shape.formWidth);
  // Every part is one line of the grid.
  expect(shape.ruleHeight).toBeCloseTo(U, 0);
  expect(shape.fieldHeight).toBeCloseTo(U, 0);
  expect(shape.border).toBe("0px");
  expect(shape.shadow).toBe("none");
});

test("with nothing under the editor there is no closing rule", async ({ mount }) => {
  const c = await mount(<Chat messages={[]} onSubmit={() => {}} />);
  const order = await c
    .locator("form")
    .evaluate((form) =>
      [...form.children].map((k) => (k.querySelector("textarea") ? "field" : "rule")),
    );
  expect(order).toEqual(["rule", "field"]);
});

test("the composer shows a prompt sign that takes the accent on focus, and no ring", async ({
  mount,
  page,
}) => {
  const c = await mount(<Chat messages={[]} onSubmit={() => {}} />);
  const input = c.locator("textarea");
  const sign = c.locator("form span[aria-hidden='true']", { hasText: ">" });
  await expect(sign).toHaveCount(1);
  const colour = () => sign.evaluate((el) => getComputedStyle(el).color);

  await input.blur();
  const rest = await colour();
  // A press on the sign lands on the field and focuses it.
  const box = await sign.boundingBox();
  if (!box) throw new Error("no prompt sign");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(input).toBeFocused();
  await expect.poll(colour).not.toBe(rest);
  expect(await input.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");

  // The sign stays on the first line as the field grows.
  const top = (await sign.boundingBox())?.y ?? 0;
  const fieldTop = (await input.boundingBox())?.y ?? 0;
  await input.fill("one");
  await input.press("Shift+Enter");
  await input.pressSequentially("two");
  const grownTop = (await sign.boundingBox())?.y ?? 0;
  const grownFieldTop = (await input.boundingBox())?.y ?? 0;
  expect(grownTop - grownFieldTop).toBeCloseTo(top - fieldTop, 0);
});

test("the field keeps the send key's corner clear, even when TextEdit's own stylesheet lands last", async ({
  mount,
  page,
}) => {
  const c = await mount(<Chat messages={[]} onSubmit={() => {}} sendKey />);
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
    style.textContent = `.${root} { padding: calc(var(--sf-unit) / 4 - 1px) calc(var(--sf-unit) / 2); resize: vertical; border: 1px solid; box-shadow: var(--sf-groove); }`;
    document.head.append(style);
  });
  const after = await measure();
  expect(after.padEnd).toBe(before.padEnd);
  expect(after.resize).toBe("none");
  // The field stays a bare line of the terminal as well.
  const box = await field.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { border: cs.borderTopWidth, shadow: cs.boxShadow, padTop: cs.paddingTop };
  });
  expect(box).toEqual({ border: "0px", shadow: "none", padTop: "0px" });
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
  let sent = 0;
  const c = await mount(<Chat messages={[]} onSubmit={() => sent++} disabled sendKey />);
  await expect(c.locator("textarea")).not.toBeDisabled();
  await c.locator("textarea").fill("a follow-up");
  await expect(c.getByRole("button", { name: "Send" })).toBeDisabled();
  await c.locator("textarea").press("Enter");
  expect(sent).toBe(0);
  await expect(c.locator("textarea")).toHaveValue("a follow-up");
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
    const label = [...el.querySelectorAll("button span")].find((n) => n.textContent === "build");
    return {
      fg,
      text: label ? getComputedStyle(label).color : null,
      done: colorOf("done"),
      failed: colorOf("error"),
    };
  });
  // The mark of a finished step is the text's own colour; a failure is not.
  expect(colours.done).toBe(colours.text);
  expect(colours.failed).not.toBe(colours.text);
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

// --- The terminal structure ---

const LOG = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n");

const TOOLS: ChatMessage = {
  id: "a1",
  role: "assistant",
  parts: [
    { type: "tool", partId: "t1", name: "$", args: "npm test", output: LOG, note: "Took 2.9s" },
    {
      type: "tool",
      partId: "t2",
      name: "grep",
      args: "foo",
      output: LOG,
      truncate: "head",
      lines: 3,
    },
    { type: "tool", partId: "t3", name: "deploy", status: "error", error: "missing credentials" },
    { type: "tool", partId: "t4", name: "$", args: "sleep 30", status: "running" },
  ],
};

test("a tool part is a band: the call line, the output cut to its last lines, the note", async ({
  mount,
}) => {
  const c = await mount(<Chat messages={[TOOLS]} onSubmit={() => {}} height={700} />);
  const tool = c.locator('[data-status="done"]').first();
  await expect(tool).toContainText("$ npm test");
  // A tail keeps the last five lines and says how many came before.
  await expect(tool.locator("pre")).toHaveText(
    ["line 8", "line 9", "line 10", "line 11", "line 12"].join("\n"),
  );
  await expect(tool.getByRole("button")).toContainText("7 earlier lines");
  await expect(tool).toContainText("Took 2.9s");
  // A head keeps the first ones, with the marker under them.
  const head = c.locator('[data-status="done"]').nth(1);
  await expect(head.locator("pre")).toHaveText(["line 1", "line 2", "line 3"].join("\n"));
  await expect(head.getByRole("button")).toContainText("9 more lines");

  const shape = await c.getByTestId("chat-messages").evaluate((el) => {
    const band = el.querySelector('[data-status="done"]') as HTMLElement;
    const failed = el.querySelector('[data-status="error"]') as HTMLElement;
    return {
      width: Math.round(band.getBoundingClientRect().width),
      scroller: el.clientWidth,
      bg: getComputedStyle(band).backgroundColor,
      failedBg: getComputedStyle(failed).backgroundColor,
      failedMark: getComputedStyle(failed).boxShadow,
      doneMark: getComputedStyle(band).boxShadow,
    };
  });
  // Edge to edge, and one neutral band for every outcome: a failure is told
  // by its leading rule and its message, a finished call by nothing.
  expect(shape.width).toBe(shape.scroller);
  expect(shape.bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(shape.failedBg).toBe(shape.bg);
  expect(shape.doneMark).toBe("none");
  expect(shape.failedMark).not.toBe("none");
  await expect(c.locator('[data-status="error"]')).toContainText("Error: missing credentials");
  // A running call shows the spinner.
  await expect(c.locator('[data-status="running"]').getByRole("status")).toBeVisible();
});

test("a press on a tool's marker expands that tool; Ctrl+O expands and collapses them all", async ({
  mount,
}) => {
  const c = await mount(<Chat messages={[TOOLS]} onSubmit={() => {}} height={700} />);
  const first = c.locator('[data-status="done"]').first();
  const second = c.locator('[data-status="done"]').nth(1);
  const lines = (tool: typeof first) =>
    tool.locator("pre").evaluate((el) => (el.textContent ?? "").split("\n").length);

  await first.getByRole("button").click();
  expect(await lines(first)).toBe(12);
  expect(await lines(second)).toBe(3);
  await expect(first.getByRole("button")).toHaveAttribute("aria-expanded", "true");

  // The key belongs to the transcript: from the editor, every block opens.
  await c.locator("textarea").press("Control+o");
  expect(await lines(first)).toBe(12);
  expect(await lines(second)).toBe(12);
  // Again, and every block shuts, the one opened by hand included.
  await c.locator("textarea").press("Control+o");
  expect(await lines(first)).toBe(5);
  expect(await lines(second)).toBe(3);
});

test("a table part is a real table: numbers in Swiss format, ending their column", async ({
  mount,
}) => {
  const c = await mount(<TableHarness />);
  const table = c.getByRole("table", { name: "Net flows" });
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader")).toHaveText(["Class", "Net", "Share"]);
  await expect(table.getByRole("cell", { name: "1'284'500" })).toBeVisible();
  await expect(table.getByRole("cell", { name: "-190'400.5" })).toBeVisible();
  await expect(table.getByRole("cell", { name: "41%" })).toBeVisible();
  const cells = await table.evaluate((el) => {
    const cell = (text: string) =>
      [...el.querySelectorAll("td, th")].find((c) => c.textContent === text) as HTMLElement;
    const cs = (text: string) => getComputedStyle(cell(text));
    return {
      name: cs("CH A acc").textAlign,
      net: cs("1'284'500").textAlign,
      netHead: cs("Net").textAlign,
      share: cs("41%").textAlign,
      font: cs("CH A acc").fontFamily,
      rule: cs("CH A acc").borderTopWidth,
      rowHeight: (cell("CH A acc").parentElement as HTMLElement).getBoundingClientRect().height,
    };
  });
  expect(cells.name).toBe("start");
  expect(cells.net).toBe("end");
  expect(cells.netHead).toBe("end");
  expect(cells.share).toBe("end");
  expect(cells.font).toContain("monospace");
  expect(cells.rule).toBe("1px");
  // One line of the grid per row, its rule included.
  expect(cells.rowHeight).toBeCloseTo(U, 0);
});

test("a table wider than the transcript scrolls inside itself, and is then reachable by keyboard", async ({
  mount,
}) => {
  const wide = {
    type: "table" as const,
    caption: "Wide",
    columns: Array.from({ length: 8 }, (_, i) => ({ key: `c${i}`, label: `Column ${i}` })),
    rows: [Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`c${i}`, 1000000 + i]))],
  };
  const c = await mount(
    <div style={{ width: 320 }}>
      <Chat messages={[{ id: "a1", role: "assistant", parts: [wide] }]} onSubmit={() => {}} />
    </div>,
  );
  const region = c.getByRole("region", { name: "Wide" });
  await expect(region).toBeVisible();
  await expect(region).toHaveAttribute("tabindex", "0");
  const fit = await c.getByTestId("chat-messages").evaluate((el) => {
    const r = el.querySelector('[role="region"]') as HTMLElement;
    return {
      transcript: el.scrollWidth <= el.clientWidth,
      table: r.scrollWidth > r.clientWidth,
      // No figure is cut: the last cell prints whole.
      last: r.querySelector("td:last-child")?.textContent,
    };
  });
  expect(fit).toEqual({ transcript: true, table: true, last: "1'000'007" });
});

test("header, slots and footer: the banner scrolls with the transcript, the dock stays", async ({
  mount,
}) => {
  const c = await mount(
    <div style={{ width: 360 }}>
      <Chat
        messages={LONG_TRANSCRIPT}
        onSubmit={() => {}}
        height={360}
        header={<span data-testid="banner">agent v1</span>}
        aboveEditor={<span data-testid="above">Queued: next</span>}
        belowEditor={<span data-testid="below">plan 2 of 5</span>}
        footer={[
          { left: "~/src/app (main) with a very long path that has to give way", right: "model" },
          { left: "usage" },
        ]}
      />
    </div>,
  );
  // The banner is the first thing in the transcript, and scrolled out of view
  // at the bottom of a long one.
  const scroller = c.getByTestId("chat-messages");
  expect(
    await scroller.evaluate(
      (el) =>
        el
          .querySelector('[data-testid="banner"]')
          ?.compareDocumentPosition(el.querySelector('[data-role="user"]') as Element) ===
        Node.DOCUMENT_POSITION_FOLLOWING,
    ),
  ).toBe(true);
  await expect(c.getByTestId("banner")).not.toBeInViewport();
  // The dock is outside the scroller, in order: above, editor, below, footer.
  const order = await c.evaluate((root) => {
    const scroll = root.querySelector('[data-testid="chat-messages"]') as HTMLElement;
    const y = (sel: string) => (root.querySelector(sel) as HTMLElement).getBoundingClientRect().top;
    return {
      inside: ["above", "below"].some((id) =>
        scroll.contains(root.querySelector(`[data-testid="${id}"]`)),
      ),
      above: y('[data-testid="above"]'),
      field: y("textarea"),
      below: y('[data-testid="below"]'),
      bottom: scroll.getBoundingClientRect().bottom,
    };
  });
  expect(order.inside).toBe(false);
  expect(order.above).toBeGreaterThanOrEqual(order.bottom);
  expect(order.field).toBeGreaterThan(order.above);
  expect(order.below).toBeGreaterThan(order.field);
  await expect(c.getByText("usage")).toBeVisible();
  // A footer line: the right side whole, the left side cut inside its line.
  const line = await c.getByText("model", { exact: true }).evaluate((right) => {
    const left = right.previousElementSibling as HTMLElement;
    return {
      rightWhole: right.scrollWidth <= right.clientWidth,
      leftCut: left.scrollWidth > left.clientWidth,
      oneLine: (right.parentElement as HTMLElement).getBoundingClientRect().height,
    };
  });
  expect(line.rightWhole).toBe(true);
  expect(line.leftCut).toBe(true);
  expect(line.oneLine).toBeCloseTo(U, 0);
});

test("working shows in the editor's top rule and moves nothing; Escape interrupts", async ({
  mount,
}) => {
  let interrupts = 0;
  const chat = (on: boolean | string) => (
    <Chat messages={[]} onSubmit={() => {}} working={on} onInterrupt={() => interrupts++} />
  );
  const c = await mount(chat(false));
  const fieldTop = async () => (await c.locator("textarea").boundingBox())?.y ?? 0;
  const rest = await fieldTop();
  await expect(c.locator("form").getByRole("status")).toHaveCount(0);
  // Not working: Escape is left alone.
  await c.locator("textarea").press("Escape");
  expect(interrupts).toBe(0);

  await c.update(chat(true));
  const status = c.locator("form").getByRole("status");
  await expect(status).toContainText("Working (esc to interrupt)");
  // The indicator sits on the rule's own line, so the field stays where it was.
  expect(await fieldTop()).toBe(rest);
  const onRule = await status.evaluate((el) => {
    const rule = el.parentElement as HTMLElement;
    const a = el.getBoundingClientRect();
    const b = rule.getBoundingClientRect();
    return (
      a.top >= b.top - 1 &&
      a.bottom <= b.bottom + 1 &&
      !!rule.nextElementSibling?.querySelector("textarea")
    );
  });
  expect(onRule).toBe(true);

  await c.locator("textarea").press("Escape");
  expect(interrupts).toBe(1);

  await c.update(chat("Compacting context"));
  await expect(status).toContainText("Compacting context");
});

test("Up and Down walk the earlier messages in an empty field, and leave a draft alone", async ({
  mount,
}) => {
  const c = await mount(
    <Chat
      messages={[
        { id: "1", role: "user", content: "first question" },
        { id: "2", role: "assistant", content: "answer" },
        { id: "3", role: "user", content: "second question" },
      ]}
      onSubmit={() => {}}
    />,
  );
  const field = c.locator("textarea");
  await field.press("ArrowUp");
  await expect(field).toHaveValue("second question");
  await field.press("ArrowUp");
  await expect(field).toHaveValue("first question");
  // The oldest one holds.
  await field.press("ArrowUp");
  await expect(field).toHaveValue("first question");
  await field.press("ArrowDown");
  await expect(field).toHaveValue("second question");
  // Past the newest, the field is empty again.
  await field.press("ArrowDown");
  await expect(field).toHaveValue("");
  // A draft keeps the arrows for moving its caret.
  await field.fill("a draft");
  await field.press("ArrowUp");
  await expect(field).toHaveValue("a draft");
  // An edited recall is a draft too.
  await field.fill("");
  await field.press("ArrowUp");
  await field.pressSequentially(" edited");
  await field.press("ArrowUp");
  await expect(field).toHaveValue("second question edited");
});

test("a reply is set as a terminal sets markdown: one size, fences kept, no boxes", async ({
  mount,
}) => {
  const c = await mount(
    <Chat
      messages={[
        {
          id: "a1",
          role: "assistant",
          content: "# Title\n\n### Sub\n\nText with `code`.\n\n- one\n\n```ts\nconst a = 1;\n```",
        },
      ]}
      onSubmit={() => {}}
    />,
  );
  const m = await c.getByTestId("chat-messages").evaluate((el) => {
    const cs = (sel: string, pseudo?: string) =>
      getComputedStyle(el.querySelector(sel) as Element, pseudo);
    return {
      p: cs("p").fontSize,
      h1: cs("h1").fontSize,
      h1Line: cs("h1").textDecorationLine,
      h3Mark: cs("h3", "::before").content,
      font: cs("p").fontFamily,
      inlineBorder: cs("p code").borderTopWidth,
      inlineBg: cs("p code").backgroundColor,
      preBorder: cs("pre").borderTopWidth,
      preBg: cs("pre").backgroundColor,
      fence: cs("pre", "::before").content,
      bullet: cs("ul").listStyleType,
    };
  });
  expect(m.h1).toBe(m.p);
  expect(m.h1Line).toContain("underline");
  expect(m.h3Mark).toBe('"### "');
  expect(m.font).toContain("monospace");
  expect(m.inlineBorder).toBe("0px");
  expect(m.inlineBg).toBe("rgba(0, 0, 0, 0)");
  expect(m.preBorder).toBe("0px");
  expect(m.preBg).toBe("rgba(0, 0, 0, 0)");
  expect(m.fence).toContain("```");
  expect(m.fence).toContain("ts");
  expect(m.bullet).toBe('"- "');
});

test("entries sit on the grid: a one-line turn is two units, entries one line apart", async ({
  mount,
}) => {
  const c = await mount(
    <Chat
      messages={[
        { id: "1", role: "user", content: "one line" },
        { id: "2", role: "assistant", content: "reply" },
        { id: "3", role: "user", content: "next" },
      ]}
      onSubmit={() => {}}
    />,
  );
  const boxes = await c.getByTestId("chat-messages").evaluate((el) =>
    [...el.querySelectorAll("[data-role]")].map((m) => {
      const r = m.getBoundingClientRect();
      return { top: r.top, height: r.height, bottom: r.bottom };
    }),
  );
  const [user, reply, next] = boxes as [(typeof boxes)[0], (typeof boxes)[0], (typeof boxes)[0]];
  expect(user.height).toBeCloseTo(2 * U, 0);
  expect(reply.height).toBeCloseTo(U, 0);
  expect(reply.top - user.bottom).toBeCloseTo(U, 0);
  expect(next.top - reply.bottom).toBeCloseTo(U, 0);
});

const LONG_TRANSCRIPT: ChatMessage[] = Array.from({ length: 40 }, (_, i) => ({
  id: `m-${i}`,
  role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
  content: `Message ${i}\n\nA second paragraph, so each turn is a few lines tall.`,
}));

const JUMP = 'button[aria-label="Jump to the latest message"]';

test("the transcript opens at the bottom and holds it when the composer grows", async ({
  mount,
}) => {
  // The bug this pins: the ResizeObserver watched the message list alone, so a
  // composer growing under `field-sizing: content` shrank the viewport without
  // the view following. You lost sight of the reply you were answering, by as
  // much as the composer had grown, exactly while typing.
  const c = await mount(<Chat messages={LONG_TRANSCRIPT} onSubmit={() => {}} height={300} />);
  const scroller = c.getByTestId("chat-messages");
  const dist = () =>
    scroller.evaluate((el) => Math.round(el.scrollHeight - el.scrollTop - el.clientHeight));

  await expect.poll(dist).toBe(0);
  const tall = await scroller.evaluate((el) => el.clientHeight);

  await c.getByRole("textbox").fill("one\ntwo\nthree\nfour\nfive");

  // The composer took height from the transcript, and the bottom came with it.
  expect(await scroller.evaluate((el) => el.clientHeight)).toBeLessThan(tall);
  await expect.poll(dist).toBe(0);
});

test("scrolling up stops the view following, and the jump key brings it back", async ({
  mount,
  page,
}) => {
  const c = await mount(<Chat messages={LONG_TRANSCRIPT} onSubmit={() => {}} height={300} />);
  const scroller = c.getByTestId("chat-messages");
  const jump = page.locator(JUMP);
  const dist = () =>
    scroller.evaluate((el) => Math.round(el.scrollHeight - el.scrollTop - el.clientHeight));

  await expect.poll(dist).toBe(0);
  await expect(jump).toHaveCount(0);

  // Any move away from the bottom stops it, however small: the old rule only
  // let go past 32px, so a nudge inside that was pulled straight back.
  await scroller.evaluate((el) => {
    el.scrollTop -= 12;
  });
  await expect(jump).toBeVisible();
  await expect.poll(dist).toBe(12);

  await jump.click();
  await expect.poll(dist).toBe(0);
  await expect(jump).toHaveCount(0);
});

test("scrolling back to the bottom by hand resumes following, no key needed", async ({
  mount,
  page,
}) => {
  const c = await mount(<Chat messages={LONG_TRANSCRIPT} onSubmit={() => {}} height={300} />);
  const scroller = c.getByTestId("chat-messages");
  const jump = page.locator(JUMP);

  await scroller.evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect(jump).toBeVisible();

  await scroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(jump).toHaveCount(0);
});

test("the transcript is a focusable log, and a streaming message is marked busy", async ({
  mount,
}) => {
  const c = await mount(
    <Chat
      messages={[
        { id: "1", role: "user", content: "Question" },
        { id: "2", role: "assistant", content: "Partial rep", isStreaming: true },
      ]}
      onSubmit={() => {}}
    />,
  );
  const scroller = c.getByTestId("chat-messages");
  // A scrollable region has to be reachable by keyboard (WCAG 2.1.1); the
  // composer holds focus the rest of the time, so without this there is no way
  // to page back through the history at all.
  await expect(scroller).toHaveAttribute("tabindex", "0");
  await expect(scroller).toHaveAttribute("role", "log");
  await expect(scroller).toHaveAttribute("aria-label", "Conversation");
  // `aria-busy` while the reply is still arriving, so assistive technology
  // waits for the whole thing rather than announcing each tick of the reveal.
  await expect(c.locator('[data-role="assistant"]')).toHaveAttribute("aria-busy", "true");
  await expect(c.locator('[data-role="user"]')).not.toHaveAttribute("aria-busy");
});

test("a hidden transcript comes back to the offset it was left at", async ({ mount }) => {
  // `display: none` destroys a scroll offset, so switching away from a
  // ChatDrawer view and back used to land at the top of the history. Following
  // is off here (the user had scrolled up), which is the case where the offset
  // is the only thing that can restore it; when it is on, the bottom does.
  const c = await mount(<Chat messages={LONG_TRANSCRIPT} onSubmit={() => {}} height={300} />);
  const scroller = c.getByTestId("chat-messages");
  const top = () => scroller.evaluate((el) => Math.round(el.scrollTop));

  await expect
    .poll(() => scroller.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight))
    .toBe(0);
  await scroller.evaluate((el) => {
    el.scrollTop = Math.round(el.scrollHeight / 2);
  });
  const left = await top();
  expect(left).toBeGreaterThan(0);

  await c.evaluate((el: HTMLElement) => {
    el.style.display = "none";
  });
  await c.evaluate((el: HTMLElement) => {
    el.style.display = "";
  });

  await expect.poll(top).toBe(left);
});

// --- The minimap rail -------------------------------------------------------

const QUESTIONS: ChatMessage[] = Array.from({ length: 16 }, (_, i) =>
  i % 2 === 0
    ? { id: `q-${i}`, role: "user" as const, content: `Question ${i / 2 + 1}` }
    : {
        id: `a-${i}`,
        role: "assistant" as const,
        content: `Answer ${(i - 1) / 2 + 1}\n\nA second paragraph, so the reply is a few lines tall.`,
      },
);

test("no rail without the opt-in", async ({ mount }) => {
  const c = await mount(<Chat messages={QUESTIONS} onSubmit={() => {}} height={300} />);
  await expect(c.getByRole("scrollbar")).toHaveCount(0);
  // The transcript keeps its own scrollbar.
  const bar = await c
    .getByTestId("chat-messages")
    .evaluate((el) => getComputedStyle(el).scrollbarWidth);
  expect(bar).not.toBe("none");
});

test("the rail replaces the scrollbar and lists the questions asked", async ({ mount }) => {
  const c = await mount(<Chat minimap messages={QUESTIONS} onSubmit={() => {}} height={300} />);
  const scroller = c.getByTestId("chat-messages");

  // The rail arrives with its chunk (it is loaded on demand), and the native
  // bar is gone — before it lands too, so the swap shows no scrollbar.
  await expect(c.getByRole("scrollbar")).toHaveCount(1);
  expect(await scroller.evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe("none");

  // A label per user message; the replies are blocks, which carry no text.
  for (const n of [1, 2, 8]) {
    await expect(c.getByRole("button", { name: `Question ${n}` })).toBeVisible();
  }
  await expect(c.getByRole("button", { name: /^Answer/ })).toHaveCount(0);

  // The rail carries the two voices the way the transcript does: the user's
  // labels and spans in the accent (the hue of the user's band), the replies
  // in neutral ink.
  const accent = await c.getByRole("button", { name: "Question 1" }).evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--sf-color-primary)";
    el.append(probe);
    const primary = getComputedStyle(probe).color;
    probe.remove();
    return { label: getComputedStyle(el).color, primary };
  });
  expect(accent.label).toBe(accent.primary);
  const tones = await c
    .locator("[data-kind]")
    .evaluateAll((els) =>
      els.map((el) => `${el.getAttribute("data-kind")}:${el.getAttribute("data-tone")}`),
    );
  expect(tones).toContain("header:primary");
  expect(tones).toContain("block:null");
});

test("the scrolling element keeps the transcript's semantics", async ({ mount }) => {
  // The rail owns the scroll element, so the log role, the label and the test
  // handle move onto it rather than being lost to the wrapper.
  const c = await mount(<Chat minimap messages={QUESTIONS} onSubmit={() => {}} height={300} />);
  const scroller = c.getByTestId("chat-messages");
  await expect(scroller).toHaveAttribute("role", "log");
  await expect(scroller).toHaveAttribute("aria-label", "Conversation");
  expect(await scroller.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
});

test("clicking a label jumps the transcript to that question", async ({ mount }) => {
  const c = await mount(<Chat minimap messages={QUESTIONS} onSubmit={() => {}} height={300} />);
  await expect(c.getByRole("scrollbar")).toHaveCount(1);
  const scroller = c.getByTestId("chat-messages");
  const top = () => scroller.evaluate((el) => Math.round(el.scrollTop));

  // Opens at the bottom, as ever.
  await expect
    .poll(() =>
      scroller.evaluate((el) => Math.round(el.scrollHeight - el.scrollTop - el.clientHeight)),
    )
    .toBe(0);
  const bottom = await top();

  // The question's offset within the content, which a scroll does not change
  // (the message and the content move together).
  const target = await c
    .locator('[data-role="user"]')
    .nth(1)
    .evaluate((el) => {
      const content = el.parentElement as HTMLElement;
      return Math.round(el.getBoundingClientRect().top - content.getBoundingClientRect().top);
    });

  await c.getByRole("button", { name: "Question 2" }).click();
  await expect.poll(top).toBeLessThan(bottom);
  // It lands at the top of the view, within a line. The jump is animated, so
  // this polls for where it settles.
  await expect.poll(async () => Math.abs((await top()) - target)).toBeLessThan(28);
});

test("the view still holds the bottom with the rail on", async ({ mount }) => {
  const c = await mount(<Chat minimap messages={QUESTIONS} onSubmit={() => {}} height={300} />);
  await expect(c.getByRole("scrollbar")).toHaveCount(1);
  const scroller = c.getByTestId("chat-messages");
  const dist = () =>
    scroller.evaluate((el) => Math.round(el.scrollHeight - el.scrollTop - el.clientHeight));
  await expect.poll(dist).toBe(0);

  // The composer growing into the transcript moves the bottom; it is followed.
  await c.getByRole("textbox").fill("one\ntwo\nthree\nfour\nfive");
  await expect.poll(dist).toBe(0);
});

test("the rail takes a side and a width", async ({ mount }) => {
  const c = await mount(
    <Chat
      minimap={{ side: "left", width: 8 }}
      messages={QUESTIONS}
      onSubmit={() => {}}
      height={300}
    />,
  );
  const rail = c.getByRole("scrollbar");
  const railBox = await rail.boundingBox();
  const scrollBox = await c.getByTestId("chat-messages").boundingBox();
  if (!railBox || !scrollBox) throw new Error("missing box");
  // On the left of the transcript, and 8u wide.
  expect(railBox.x).toBeLessThan(scrollBox.x);
  expect(Math.round(railBox.width)).toBeGreaterThan(7 * U);
  expect(Math.round(railBox.width)).toBeLessThanOrEqual(8 * U);
});

test("a short conversation's bands keep their size instead of filling the rail", async ({
  mount,
}) => {
  // Three turns stretched down the whole rail say nothing about where you are;
  // the bands keep a floor and accumulate from the top instead.
  const c = await mount(
    <Chat minimap messages={QUESTIONS.slice(0, 6)} onSubmit={() => {}} height={400} />,
  );
  await expect(c.getByRole("scrollbar")).toHaveCount(1);
  const rail = await c.locator('[class*="Minimap-module_rail"]').first().boundingBox();
  const last = await c.locator("[data-kind]").last().boundingBox();
  if (!rail || !last) throw new Error("missing box");
  // The picture ends well above the rail's own bottom.
  expect(last.y + last.height - rail.y).toBeLessThan(rail.height * 0.7);
  // And no single band is a slab: each stays a brick.
  const heights = await c
    .locator("[data-kind]")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(Math.max(...heights)).toBeLessThan(60);
});

test("a long conversation fills the rail and then scrolls it", async ({ mount }) => {
  const long: ChatMessage[] = Array.from({ length: 60 }, (_, i) =>
    i % 2 === 0
      ? { id: `q-${i}`, role: "user" as const, content: `Question ${i / 2 + 1}` }
      : {
          id: `a-${i}`,
          role: "assistant" as const,
          content: `Answer ${(i - 1) / 2 + 1}\n\nA second paragraph, so the reply is a few lines tall.`,
        },
  );
  const c = await mount(<Chat minimap messages={long} onSubmit={() => {}} height={400} />);
  await expect(c.getByRole("scrollbar")).toHaveCount(1);
  // Past the rail's height the bands keep their size and the rail scrolls,
  // following the viewport band (the min-block mode).
  await expect(c.locator('[class*="Minimap-module_rail"]').first()).toHaveAttribute(
    "data-scroll",
    "",
  );
});

test("the rail's width is a variable the page can set, and a prop can override", async ({
  mount,
}) => {
  // Unset, the rail takes `--sf-chat-minimap-width` (5u), so a theme can
  // retune every rail it has without touching a call site.
  const themed = await mount(
    <div style={{ "--sf-chat-minimap-width": "72px" } as React.CSSProperties}>
      <Chat minimap messages={QUESTIONS} onSubmit={() => {}} height={300} />
    </div>,
  );
  await expect(themed.getByRole("scrollbar")).toHaveCount(1);
  const themedRail = await themed.locator('[class*="Minimap-module_rail"]').first().boundingBox();
  expect(Math.round(themedRail?.width ?? 0)).toBe(72);
  await themed.unmount();

  // The prop lands inline, so it wins over the variable for that one chat.
  const pinned = await mount(
    <div style={{ "--sf-chat-minimap-width": "72px" } as React.CSSProperties}>
      <Chat minimap={{ width: 6 }} messages={QUESTIONS} onSubmit={() => {}} height={300} />
    </div>,
  );
  await expect(pinned.getByRole("scrollbar")).toHaveCount(1);
  const pinnedRail = await pinned.locator('[class*="Minimap-module_rail"]').first().boundingBox();
  expect(Math.round(pinnedRail?.width ?? 0)).toBe(6 * U);
});

// --- Completion ---

const logOf = (c: import("@playwright/test").Locator) =>
  c.getByTestId("log").evaluate((el) => (el.textContent ?? "").split("\n").filter(Boolean));

test("`/` at the start opens the commands under the editor; Enter takes one, the next Enter sends", async ({
  mount,
}) => {
  const c = await mount(<CompletionHarness />);
  const field = c.locator("textarea");
  await field.pressSequentially("/");
  const list = c.getByRole("listbox", { name: "Suggestions" });
  await expect(list).toBeVisible();
  // Five lines at a time, and the position when there are more.
  await expect(list.getByRole("option")).toHaveCount(5);
  await expect(c.getByText("(1/7)")).toBeVisible();
  await expect(field).toHaveAttribute("aria-controls", (await list.getAttribute("id")) ?? "");
  await expect(list.getByRole("option", { selected: true })).toContainText("help");

  // The arrows move the cursor (and wrap); the focus stays in the field.
  await field.press("ArrowDown");
  await expect(list.getByRole("option", { selected: true })).toContainText("model");
  const active = await field.getAttribute("aria-activedescendant");
  expect(active).toBe(await list.getByRole("option", { selected: true }).getAttribute("id"));
  await field.press("ArrowUp");
  await field.press("ArrowUp");
  await expect(list.getByRole("option", { selected: true })).toContainText("settings");
  await expect(c.getByText("(7/7)")).toBeVisible();
  await expect(field).toBeFocused();

  await field.press("ArrowDown");
  await field.press("ArrowDown");
  await field.press("Enter");
  await expect(field).toHaveValue("/model ");
  await expect(list).toHaveCount(0);
  await field.press("Enter");
  expect(await logOf(c)).toContain("submit:/model");
});

test("the list sits under the editor's closing rule and lines up its columns", async ({
  mount,
}) => {
  const c = await mount(<CompletionHarness />);
  await c.locator("textarea").pressSequentially("/");
  const shape = await c.locator("form").evaluate((form) => {
    const field = form.querySelector("textarea") as HTMLElement;
    const list = form.querySelector('[role="listbox"]') as HTMLElement;
    const rule = list.parentElement?.previousElementSibling as HTMLElement;
    const options = [...list.querySelectorAll('[role="option"]')] as HTMLElement[];
    const lefts = (sel: string) =>
      options.map((o) =>
        Math.round((o.querySelector(sel) as HTMLElement).getBoundingClientRect().left),
      );
    return {
      below: list.getBoundingClientRect().top >= field.getBoundingClientRect().bottom,
      ruleStroke: getComputedStyle(rule, "::after").height,
      heights: options.map((o) => Math.round(o.getBoundingClientRect().height)),
      descLefts: new Set(
        options.map((o) =>
          Math.round((o.lastElementChild as HTMLElement).getBoundingClientRect().left),
        ),
      ).size,
      labelLefts: new Set(lefts("span:nth-child(2)")).size,
    };
  });
  expect(shape.below).toBe(true);
  expect(shape.ruleStroke).toBe("1px");
  for (const h of shape.heights) expect(h).toBeCloseTo(U, 0);
  expect(shape.labelLefts).toBe(1);
  expect(shape.descLefts).toBe(1);
});

test("`/` counts only at the start; `@` and `#` at the start of any word", async ({ mount }) => {
  const c = await mount(<CompletionHarness />);
  const field = c.locator("textarea");
  await field.pressSequentially("see /");
  await expect(c.getByRole("listbox")).toHaveCount(0);
  await field.pressSequentially(" and@");
  await expect(c.getByRole("listbox")).toHaveCount(0);
  // An empty answer shows nothing.
  await field.pressSequentially(" #");
  await expect.poll(() => logOf(c)).toContain("ask:#");
  await expect(c.getByRole("listbox")).toHaveCount(0);
});

test("an answer that arrives later opens the list; a partial entry asks again for the next step", async ({
  mount,
}) => {
  const c = await mount(<CompletionHarness />);
  const field = c.locator("textarea");
  await field.pressSequentially("read @s");
  const list = c.getByRole("listbox");
  await expect(list.getByRole("option")).toHaveText(["→src/"]);
  await field.press("Tab");
  // A directory: no space after it, and the list asks for what is inside.
  await expect(field).toHaveValue("read @src/");
  await expect(list.getByRole("option")).toHaveText(["→date.ts", "→format.ts"]);
  await field.press("Enter");
  await expect(field).toHaveValue("read @src/date.ts ");
  await expect(list).toHaveCount(0);
  expect(await logOf(c)).not.toContain("submit:read @src/date.ts");
});

test("a press on an entry takes it and keeps the caret in the field", async ({ mount }) => {
  const c = await mount(<CompletionHarness />);
  const field = c.locator("textarea");
  await field.pressSequentially("/");
  await c.getByRole("option", { name: /rename/ }).click();
  await expect(field).toHaveValue("/rename ");
  await expect(field).toBeFocused();
  expect(await field.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(8);
});

test("an entry with an action takes its trigger out of the field and runs", async ({ mount }) => {
  const c = await mount(<CompletionHarness />);
  const field = c.locator("textarea");
  await field.pressSequentially("/cl");
  await field.press("Enter");
  await expect(field).toHaveValue("");
  expect(await logOf(c)).toContain("action:clear");
  expect(await logOf(c)).not.toContain("submit:/clear");
});

test("Escape closes the list for that trigger without interrupting; the next Escape interrupts", async ({
  mount,
}) => {
  const c = await mount(<CompletionHarness working />);
  const field = c.locator("textarea");
  await field.pressSequentially("/m");
  await expect(c.getByRole("listbox")).toBeVisible();
  await field.press("Escape");
  await expect(c.getByRole("listbox")).toHaveCount(0);
  expect(await logOf(c)).not.toContain("interrupt");
  // Typing on in the same command keeps it closed.
  await field.pressSequentially("o");
  await expect(c.getByRole("listbox")).toHaveCount(0);
  // With the list shut, Escape is the chat's again.
  await field.press("Escape");
  expect(await logOf(c)).toContain("interrupt");
  // A new trigger opens it again.
  await field.fill("");
  await field.pressSequentially("/");
  await expect(c.getByRole("listbox")).toBeVisible();
});

test("Up and Down belong to the list while it is open, not to the history", async ({ mount }) => {
  const c = await mount(<CompletionHarness />);
  const field = c.locator("textarea");
  await field.pressSequentially("first");
  await field.press("Enter");
  await field.pressSequentially("/");
  await field.press("ArrowUp");
  await expect(field).toHaveValue("/");
  await expect(c.getByRole("option", { selected: true })).toContainText("settings");
});

test("a narrow chat drops the descriptions and keeps the labels", async ({ mount }) => {
  const c = await mount(<CompletionHarness width={300} />);
  await c.locator("textarea").pressSequentially("/");
  const option = c.getByRole("option").first();
  await expect(option).toContainText("help");
  await expect(option.getByText("# the help command")).toBeHidden();
});

// --- Prompts in the editor's place ---

const answersOf = (c: import("@playwright/test").Locator) =>
  c.getByTestId("answers").evaluate((el) => (el.textContent ?? "").split("\n").filter(Boolean));

test("a select prompt takes the editor's place; the arrows and Enter answer; the draft comes back", async ({
  mount,
}) => {
  const c = await mount(<PromptHarness />);
  const field = c.locator("form textarea");
  await field.fill("a draft");
  await c.getByRole("button", { name: "ask select" }).click();
  const panel = c.getByRole("group", { name: "Pick" });
  await expect(panel).toBeVisible();
  // The editor is gone while the question is open, and the first option has
  // the focus.
  await expect(c.locator("form textarea")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /^Option 1( |$)/ })).toBeFocused();
  await expect(panel.getByText("# the first")).toBeVisible();
  // Ten at a time, and where the cursor is.
  await expect(panel.getByRole("button", { name: /^Option \d+/ })).toHaveCount(10);
  await expect(panel.getByText("(1/14)")).toBeVisible();

  await c.page().keyboard.press("ArrowDown");
  await c.page().keyboard.press("ArrowDown");
  await expect(panel.getByRole("button", { name: /^Option 3$/ })).toBeFocused();
  await c.page().keyboard.press("Enter");
  await expect.poll(() => answersOf(c)).toEqual(["select:o3"]);
  await expect(panel).toHaveCount(0);
  await expect(field).toHaveValue("a draft");
  await expect(field).toBeFocused();
});

test("a long list scrolls with the cursor; the arrows wrap", async ({ mount }) => {
  const c = await mount(<PromptHarness />);
  await c.getByRole("button", { name: "ask long" }).click();
  const panel = c.getByRole("group", { name: "Pick one of many" });
  await expect(panel.getByRole("button", { name: /^Option \d+/ })).toHaveCount(5);
  await c.page().keyboard.press("ArrowUp");
  await expect(panel.getByRole("button", { name: /^Option 14$/ })).toBeFocused();
  await expect(panel.getByText("(14/14)")).toBeVisible();
  await c.page().keyboard.press("Home");
  await expect(panel.getByRole("button", { name: /Option 1\b/ })).toBeFocused();
});

test("Escape cancels a prompt without interrupting the run; [Cancel] does the same", async ({
  mount,
}) => {
  const c = await mount(<PromptHarness working />);
  await c.getByRole("button", { name: "ask select" }).click();
  // The panel is loaded on demand: answer it once it is there, as a user does.
  await expect(c.getByRole("button", { name: /^Option 1( |$)/ })).toBeFocused();
  await c.page().keyboard.press("Escape");
  await expect.poll(() => answersOf(c)).toEqual(["select:undefined"]);
  await c.getByRole("button", { name: "ask input" }).click();
  await c.getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => answersOf(c)).toEqual(["select:undefined", "input:undefined"]);
  // With no prompt open, Escape interrupts.
  await c.locator("form textarea").press("Escape");
  await expect.poll(() => answersOf(c)).toContain("interrupt");
});

test("a confirm starts on No, and Escape answers no", async ({ mount }) => {
  const c = await mount(<PromptHarness />);
  await c.getByRole("button", { name: "ask confirm" }).click();
  const panel = c.getByRole("group", { name: "Delete?" });
  await expect(panel.getByText("It cannot be undone.")).toBeVisible();
  await expect(panel.getByRole("button", { name: /No/ })).toBeFocused();
  // A confirm's No is its cancel: no separate key.
  await expect(panel.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  await c.page().keyboard.press("Enter");
  await c.getByRole("button", { name: "ask confirm" }).click();
  await expect(c.getByRole("button", { name: /^No$/ })).toBeFocused();
  await c.page().keyboard.press("ArrowUp");
  await c.page().keyboard.press("Enter");
  await c.getByRole("button", { name: "ask confirm" }).click();
  await expect(c.getByRole("button", { name: /^No$/ })).toBeFocused();
  await c.page().keyboard.press("Escape");
  await expect.poll(() => answersOf(c)).toEqual(["confirm:false", "confirm:true", "confirm:false"]);
});

test("an input prompt answers with its line on Enter", async ({ mount }) => {
  const c = await mount(<PromptHarness />);
  await c.getByRole("button", { name: "ask input" }).click();
  const line = c.getByRole("textbox", { name: "Name" });
  await expect(line).toBeFocused();
  await expect(line).toHaveValue("draft");
  await line.pressSequentially(" two");
  await line.press("Enter");
  await expect.poll(() => answersOf(c)).toEqual(["input:draft two"]);
});

test("custom content answers through close; a new question withdraws the open one", async ({
  mount,
}) => {
  const c = await mount(<PromptHarness />);
  await c.getByRole("button", { name: "ask custom" }).click();
  await c.getByRole("button", { name: "finish" }).click();
  await expect.poll(() => answersOf(c)).toEqual(["custom:done"]);
  await c.getByRole("button", { name: "ask twice" }).click();
  // The first question resolves as cancelled; the second is on screen.
  await expect.poll(() => answersOf(c)).toEqual(["custom:done", "first:undefined"]);
  await expect(c.getByRole("group", { name: "Second" })).toBeVisible();
  await c.page().keyboard.press("ArrowUp");
  await c.page().keyboard.press("Enter");
  await expect.poll(() => answersOf(c)).toEqual(["custom:done", "first:undefined", "second:true"]);
});

test("the prompt keeps the grid: title, a blank line, the options, a blank line, the keys", async ({
  mount,
}) => {
  const c = await mount(<PromptHarness />);
  await c.getByRole("button", { name: "ask confirm" }).click();
  const rows = await c.getByRole("group", { name: "Delete?" }).evaluate((panel) => {
    const top = panel.getBoundingClientRect().top;
    const at = (el: Element | null) =>
      el ? Math.round((el.getBoundingClientRect().top - top) * 100) / 100 : -1;
    const buttons = [...panel.querySelectorAll("button")];
    return {
      message: at(panel.firstElementChild?.lastElementChild ?? null),
      yes: at(buttons[0] ?? null),
      no: at(buttons[1] ?? null),
      keys: at(panel.lastElementChild),
      height: panel.getBoundingClientRect().height,
    };
  });
  expect(rows.message).toBeCloseTo(U, 0);
  expect(rows.yes).toBeCloseTo(3 * U, 0);
  expect(rows.no).toBeCloseTo(4 * U, 0);
  expect(rows.keys).toBeCloseTo(6 * U, 0);
  expect(rows.height).toBeCloseTo(7 * U, 0);
});

test.describe("with a finger", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("a tap on an entry takes it", async ({ mount }) => {
    const c = await mount(<CompletionHarness />);
    const field = c.locator("textarea");
    await field.tap();
    await field.pressSequentially("/");
    await c.getByRole("option", { name: /clear/ }).tap();
    // An action: the command leaves the field and runs.
    await expect(field).toHaveValue("");
    expect(await logOf(c)).toContain("action:clear");
    await field.pressSequentially("/re");
    await c.getByRole("option", { name: /rename/ }).tap();
    await expect(field).toHaveValue("/rename ");
  });

  test("a tap on an option answers a prompt, and [Cancel] stands in for Escape", async ({
    mount,
  }) => {
    const p = await mount(<PromptHarness />);
    await p.getByRole("button", { name: "ask select" }).tap();
    const panel = p.getByRole("group", { name: "Pick" });
    // A finger gets the [Cancel] key; the key hints are a keyboard's.
    await expect(panel.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(panel.getByText(/enter accept/)).toBeHidden();
    await panel.getByRole("button", { name: /^Option 2$/ }).tap();
    await expect.poll(() => answersOf(p)).toEqual(["select:o2"]);
  });
});

test("a prompt taller than the chat: the transcript keeps three lines and the dock scrolls", async ({
  mount,
}) => {
  const c = await mount(<PromptHarness short />);
  await c.getByRole("button", { name: "ask select" }).click();
  await expect(c.getByRole("button", { name: /^Option 1( |$)/ })).toBeFocused();
  const fit = await c.evaluate((root) => {
    const scroller = root.querySelector('[data-testid="chat-messages"]') as HTMLElement;
    const chat = scroller.parentElement as HTMLElement;
    const dock = scroller.nextElementSibling as HTMLElement;
    const line = Number.parseFloat(getComputedStyle(scroller).lineHeight);
    return {
      transcriptLines: Math.round(scroller.getBoundingClientRect().height / line),
      dockScrolls: dock.scrollHeight > dock.clientHeight,
      inside: dock.getBoundingClientRect().bottom <= chat.getBoundingClientRect().bottom + 0.5,
    };
  });
  expect(fit).toEqual({ transcriptLines: 3, dockScrolls: true, inside: true });
  // The cursor stays in view as it moves down the list.
  await c.page().keyboard.press("End");
  const last = c.getByRole("button", { name: /^Option 14$/ });
  await expect(last).toBeFocused();
  await expect(last).toBeInViewport();
});

// --- The log variant ---

const LOG_SESSION: ChatMessage[] = [
  { id: "u1", role: "user", content: "Fix the date test" },
  {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "text", text: "Running the tests." },
      { type: "tool", partId: "t1", name: "$", args: "npm test", output: LOG, note: "Took 2.9s" },
      { type: "tool", partId: "t2", name: "deploy", status: "error", error: "missing credentials" },
      { type: "tool", partId: "t3", name: "$", args: "sleep 30", status: "running" },
    ],
  },
  { id: "u2", role: "user", content: "Thanks" },
];

test('variant="log": no blank lines and no bands; the user line starts with a sign, a reply is indented', async ({
  mount,
}) => {
  const c = await mount(
    <Chat variant="log" messages={LOG_SESSION} onSubmit={() => {}} height={600} />,
  );
  const shape = await c.evaluate((root) => {
    const scroller = root.querySelector('[data-testid="chat-messages"]') as HTMLElement;
    const msgs = [...scroller.querySelectorAll("[data-role]")] as HTMLElement[];
    const box = (el: Element) => el.getBoundingClientRect();
    const user = msgs[0] as HTMLElement;
    const sign = user.querySelector('[aria-hidden="true"]') as HTMLElement;
    const text = user.querySelector("[data-user-text]") as HTMLElement;
    const reply = msgs[1] as HTMLElement;
    const firstLine = reply.querySelector("p") as HTMLElement;
    const ch = text.getBoundingClientRect().left - sign.getBoundingClientRect().left;
    return {
      gaps: msgs.slice(1).map((m, i) => Math.round(box(m).top - box(msgs[i] as Element).bottom)),
      userBg: getComputedStyle(user).backgroundColor,
      sign: sign.textContent,
      signColor: getComputedStyle(sign).color,
      // The reply starts where the user's text does: two cells in.
      replyIndent: Math.round(box(firstLine).left - box(sign).left),
      textIndent: Math.round(ch),
      border: getComputedStyle(root).borderTopWidth,
      toolBg: getComputedStyle(reply.querySelector("[data-status]") as Element).backgroundColor,
    };
  });
  expect(shape.gaps).toEqual([0, 0]);
  expect(shape.userBg).toBe("rgba(0, 0, 0, 0)");
  expect(shape.sign).toBe(">");
  expect(shape.replyIndent).toBe(shape.textIndent);
  expect(shape.textIndent).toBeGreaterThan(0);
  // The log fills its holder: no frame by default.
  expect(shape.border).toBe("0px");
  expect(shape.toolBg).toBe("rgba(0, 0, 0, 0)");
  // The sign is the line's mark, not its text.
  await expect(c.getByRole("article", { name: "You" }).first()).toHaveText(">Fix the date test");
  expect(
    await c
      .getByRole("article", { name: "You" })
      .first()
      .evaluate((el) => el.querySelector('[aria-hidden="true"]')?.textContent),
  ).toBe(">");
});

test('variant="log": a tool call is one line with its status, the output folded to one line', async ({
  mount,
}) => {
  const c = await mount(
    <Chat variant="log" messages={LOG_SESSION} onSubmit={() => {}} height={600} />,
  );
  const done = c.locator('[data-status="done"]');
  const lines = await done.evaluate((el) => {
    const line = Number.parseFloat(getComputedStyle(el).lineHeight);
    return Math.round(el.getBoundingClientRect().height / line);
  });
  // The call, and one folded line of output.
  expect(lines).toBe(2);
  await expect(done).toContainText("$ npm test");
  await expect(done).toContainText("Took 2.9s");
  await expect(done.locator("pre")).toHaveText("line 12");
  const more = done.getByRole("button", { name: "Show 11 more lines" });
  await expect(more).toContainText("+11 lines");
  // The status sits on the call's line, at its end.
  const ends = await done.evaluate((el) => {
    const call = el.firstElementChild as HTMLElement;
    const status = call.lastElementChild as HTMLElement;
    return {
      sameLine: Math.abs(status.getBoundingClientRect().top - call.getBoundingClientRect().top) < 1,
      atEnd:
        Math.abs(status.getBoundingClientRect().right - call.getBoundingClientRect().right) < 1,
      mark: !!status.querySelector("svg"),
    };
  });
  expect(ends).toEqual({ sameLine: true, atEnd: true, mark: true });

  await more.click();
  await expect(done.locator("pre")).toHaveText(
    Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n"),
  );
  await expect(done.getByRole("button", { name: "Fold the output" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  // Ctrl+O folds and opens every call.
  await c.locator("textarea").press("Control+o");
  await expect(done.locator("pre")).toHaveText(
    Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n"),
  );
  await c.locator("textarea").press("Control+o");
  await expect(done.locator("pre")).toHaveText("line 12");

  // A failure: the mark and the message in the danger colour.
  const failed = c.locator('[data-status="error"]');
  await expect(failed).toContainText("Error: missing credentials");
  const colours = await failed.evaluate((el) => {
    const mark = el.querySelector('[data-mark="error"]') as HTMLElement;
    return { mark: getComputedStyle(mark).color, text: getComputedStyle(el).color };
  });
  expect(colours.mark).not.toBe(colours.text);
  await expect(c.locator('[data-status="running"]').getByRole("status")).toBeVisible();
});

test('variant="log" keeps a frame when asked; a band in the log has no surface', async ({
  mount,
}) => {
  const c = await mount(
    <Chat
      variant="log"
      frame
      messages={[
        {
          id: "a1",
          role: "assistant",
          parts: [{ type: "choices", prompt: "Pick one:", options: [{ id: "a", label: "A" }] }],
        },
      ]}
      onSubmit={() => {}}
    />,
  );
  expect(await c.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("1px");
  const band = await c.locator('[data-variant="band"]').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, pad: cs.paddingTop };
  });
  expect(band).toEqual({ bg: "rgba(0, 0, 0, 0)", pad: "0px" });
});

test("the rail's labels are the questions, without the log's sign", async ({ mount }) => {
  const c = await mount(
    <Chat variant="log" minimap messages={QUESTIONS} onSubmit={() => {}} height={300} />,
  );
  await expect(c.getByRole("button", { name: "Question 1" })).toBeVisible();
  await expect(c.getByRole("button", { name: /^>/ })).toHaveCount(0);
});

test("code in a reply: the log view shows it highlighted with no fences; the terminal view keeps them", async ({
  mount,
}) => {
  const reply: ChatMessage[] = [
    { id: "a1", role: "assistant", content: "Here:\n\n```ts\nconst a: number = 1;\n```" },
  ];
  const c = await mount(
    <div>
      <Chat variant="log" messages={reply} onSubmit={() => {}} />
      <Chat messages={reply} onSubmit={() => {}} />
    </div>,
  );
  await expect(c.locator('pre [data-token="keyword"]')).toHaveCount(2);
  const fences = await c.evaluate((root) =>
    [...root.querySelectorAll("pre")].map((pre) => ({
      fence: getComputedStyle(pre, "::before").display,
      tokens: pre.querySelectorAll("[data-token]").length,
    })),
  );
  expect(fences[0]?.fence).toBe("none");
  expect(fences[1]?.fence).toBe("block");
  for (const f of fences) expect(f.tokens).toBeGreaterThan(0);
});

test("a code block still being revealed is highlighted once its text has landed", async ({
  mount,
}) => {
  const content = "```js\nconst answer = compute(42);\n```";
  const c = await mount(
    <Chat
      variant="log"
      messages={[{ id: "a", role: "assistant", content, isStreaming: true }]}
      onSubmit={() => {}}
      reveal={{ charIntervalMs: 15 }}
    />,
  );
  await c.update(
    <Chat
      variant="log"
      messages={[{ id: "a", role: "assistant", content, isStreaming: false }]}
      onSubmit={() => {}}
      reveal={{ charIntervalMs: 15 }}
    />,
  );
  await expect(c.locator('pre [data-token="keyword"]')).toHaveText("const");
  await expect(c.locator("pre")).toHaveText("const answer = compute(42);");
});

test("in the log view code sits one cell in, with a blank line after it where it ends the text", async ({
  mount,
}) => {
  const c = await mount(
    <Chat
      variant="log"
      messages={[
        {
          id: "a1",
          role: "assistant",
          parts: [
            { type: "text", text: "The fix:\n\n```ts\nconst a = 1;\n```" },
            { type: "tool", name: "$", args: "npm test" },
          ],
        },
        { id: "u2", role: "user", content: "Next" },
      ]}
      onSubmit={() => {}}
    />,
  );
  const m = await c.getByTestId("chat-messages").evaluate((el) => {
    const pre = el.querySelector("pre") as HTMLElement;
    const p = el.querySelector("p") as HTMLElement;
    const tool = el.querySelector("[data-status]") as HTMLElement;
    const ch = (() => {
      const probe = document.createElement("span");
      probe.textContent = "0";
      pre.append(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    })();
    const code = pre.querySelector("code") as HTMLElement;
    return {
      indent: (code.getBoundingClientRect().left - p.getBoundingClientRect().left) / ch,
      gap: Math.round(tool.getBoundingClientRect().top - pre.getBoundingClientRect().bottom),
    };
  });
  expect(m.indent).toBeCloseTo(1, 1);
  expect(m.gap).toBe(U);
});

test("in the log view the user's text is set in the accent, the reply in ink", async ({
  mount,
}) => {
  const c = await mount(
    <Chat
      variant="log"
      messages={[
        { id: "u1", role: "user", content: "A question" },
        { id: "a1", role: "assistant", content: "An answer" },
      ]}
      onSubmit={() => {}}
    />,
  );
  const colours = await c.getByTestId("chat-messages").evaluate((el) => {
    const probe = (value: string) => {
      const span = document.createElement("span");
      span.style.color = value;
      el.append(span);
      const out = getComputedStyle(span).color;
      span.remove();
      return out;
    };
    return {
      user: getComputedStyle(el.querySelector("[data-user-text]") as Element).color,
      reply: getComputedStyle(el.querySelector('[data-role="assistant"] p') as Element).color,
      primary: probe("var(--sf-color-primary)"),
      fg: probe("var(--sf-color-fg)"),
    };
  });
  expect(colours.user).toBe(colours.primary);
  expect(colours.reply).toBe(colours.fg);
  expect(colours.user).not.toBe(colours.reply);
});

// --- Faces ---

const FACE_SESSION: ChatMessage[] = [
  { id: "u1", role: "user", content: "A question" },
  {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "text", text: "Use `formatDate` here.\n\n```ts\nconst a = 1;\n```" },
      { type: "tool", name: "$", args: "npm test" },
      {
        type: "tree",
        roots: [{ id: "r", label: "root", children: [{ id: "c", label: "child" }] }],
      },
    ],
  },
];

/** The computed face of each role's text, and of the faces to compare with. */
const facesOf = (root: HTMLElement) => {
  const face = (sel: string) => getComputedStyle(root.querySelector(sel) as Element).fontFamily;
  const probe = (value: string) => {
    const span = document.createElement("span");
    span.style.fontFamily = value;
    root.append(span);
    const out = getComputedStyle(span).fontFamily;
    span.remove();
    return out;
  };
  return {
    user: face("[data-user-text]"),
    editor: face("textarea"),
    reply: face('[data-role="assistant"] p'),
    inlineCode: face('[data-role="assistant"] p code'),
    block: face("pre code"),
    tool: face("[data-status]"),
    guide: getComputedStyle(
      [...root.querySelectorAll('[data-role="assistant"] button span')].find((s) =>
        (s.textContent ?? "").includes("└"),
      ) as Element,
    ).fontFamily,
    mono: probe("var(--sf-font-mono)"),
    sans: probe("var(--sf-font-sans)"),
  };
};

test("the chat is monospace throughout by default", async ({ mount }) => {
  const c = await mount(<Chat messages={FACE_SESSION} onSubmit={() => {}} height={500} />);
  const f = await c.evaluate(facesOf);
  for (const role of ["user", "editor", "reply", "inlineCode", "block", "tool", "guide"] as const) {
    expect(f[role], role).toBe(f.mono);
  }
});

test("fonts sets the text, user and code faces apart; the tree guides stay monospace", async ({
  mount,
}) => {
  const c = await mount(
    <Chat
      messages={FACE_SESSION}
      onSubmit={() => {}}
      height={500}
      fonts={{ text: "var(--sf-font-sans)", user: "serif", code: "var(--sf-font-mono)" }}
    />,
  );
  const f = await c.evaluate(facesOf);
  expect(f.reply).toBe(f.sans);
  expect(f.user).toBe("serif");
  expect(f.editor).toBe("serif");
  expect(f.inlineCode).toBe(f.mono);
  expect(f.block).toBe(f.mono);
  expect(f.tool).toBe(f.mono);
  expect(f.guide).toBe(f.mono);
});

test("the faces are variables an app sets once; the prop wins for one chat", async ({ mount }) => {
  const c = await mount(
    <div
      style={{ "--sf-chat-font": "serif", "--sf-chat-font-code": "cursive" } as React.CSSProperties}
    >
      <Chat messages={FACE_SESSION} onSubmit={() => {}} height={500} />
      <Chat
        messages={FACE_SESSION}
        onSubmit={() => {}}
        height={500}
        fonts={{ text: "var(--sf-font-sans)" }}
      />
    </div>,
  );
  const [app, own] = await c.evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>("[data-variant]")]
      .filter((el) => el.hasAttribute("data-frame"))
      .map((chat) => ({
        reply: getComputedStyle(chat.querySelector('[data-role="assistant"] p') as Element)
          .fontFamily,
        // The user face follows the text face when it is not set.
        user: getComputedStyle(chat.querySelector("[data-user-text]") as Element).fontFamily,
        code: getComputedStyle(chat.querySelector("pre code") as Element).fontFamily,
      })),
  );
  expect(app).toEqual({ reply: "serif", user: "serif", code: "cursive" });
  expect(own?.reply).not.toBe("serif");
  expect(own?.user).toBe(own?.reply);
  expect(own?.code).toBe("cursive");
});

test("a line mixing the text face and code stays one unit tall", async ({ mount }) => {
  const c = await mount(
    <Chat
      variant="log"
      messages={[
        {
          id: "a1",
          role: "assistant",
          content: "Call `formatDate` and `parse` on it.\n\n- `one` item\n- `two` items",
        },
      ]}
      onSubmit={() => {}}
      fonts={{ text: "var(--sf-font-sans)" }}
    />,
  );
  const heights = await c
    .getByTestId("chat-messages")
    .evaluate((el) =>
      [...el.querySelectorAll("p, li")].map((n) => Math.round(n.getBoundingClientRect().height)),
    );
  for (const h of heights) expect(h).toBe(U);
});

// --- A phone and its keyboard ---

/** The test browser has no on-screen keyboard: make its visual viewport report
 *  one, `covered` px tall, and say so as a phone does (a resize event). */
const raiseKeyboard = (page: import("@playwright/test").Page, covered: number) =>
  page.evaluate((px) => {
    const viewport = window.visualViewport;
    if (!viewport) throw new Error("no visualViewport");
    const full = document.documentElement.clientHeight;
    Object.defineProperty(viewport, "height", { configurable: true, get: () => full - px });
    viewport.dispatchEvent(new Event("resize"));
  }, covered);

test.describe("on a phone", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("Return breaks the line; the send key sends and the keyboard stays up", async ({
    mount,
  }) => {
    const sent: string[] = [];
    const c = await mount(<Chat messages={[]} onSubmit={(t) => sent.push(t)} />);
    const field = c.locator("textarea");
    await expect(field).toHaveAttribute("enterkeyhint", "enter");
    await field.tap();
    await field.pressSequentially("one");
    await field.press("Enter");
    await field.pressSequentially("two");
    await expect(field).toHaveValue("one\ntwo");
    expect(sent).toEqual([]);
    await c.getByRole("button", { name: "Send" }).tap();
    await expect.poll(() => sent).toEqual(["one\ntwo"]);
    await expect(field).toHaveValue("");
    // The field kept the focus, so the keyboard did not drop and rise again.
    await expect(field).toBeFocused();
    // A hardware keyboard on a tablet sends with Ctrl+Enter.
    await field.pressSequentially("three");
    await field.press("Control+Enter");
    await expect.poll(() => sent).toEqual(["one\ntwo", "three"]);
  });

  test("the chat raises no keyboard on its own: not on mount, not when a run ends, not on the jump key", async ({
    mount,
  }) => {
    const c = await mount(
      <Chat messages={LONG_TRANSCRIPT} onSubmit={() => {}} height={400} disabled />,
    );
    const field = c.locator("textarea");
    await expect(field).not.toBeFocused();
    await c.update(<Chat messages={LONG_TRANSCRIPT} onSubmit={() => {}} height={400} />);
    await expect(field).not.toBeFocused();
    await c.getByTestId("chat-messages").evaluate((el) => {
      el.scrollTop = 0;
    });
    await c.getByRole("button", { name: "Jump to the latest message" }).tap();
    await expect(field).not.toBeFocused();
  });

  test("a finger stops a run with the [stop] key, where a keyboard has Escape", async ({
    mount,
  }) => {
    let stops = 0;
    const c = await mount(
      <Chat messages={[]} onSubmit={() => {}} working onInterrupt={() => stops++} />,
    );
    await expect(c.getByText("(esc to interrupt)")).toBeHidden();
    await c.getByRole("button", { name: "[stop]" }).tap();
    expect(stops).toBe(1);
  });

  test("a tap anywhere on the editor block puts the caret in the field", async ({ mount }) => {
    const c = await mount(<Chat messages={[]} onSubmit={() => {}} footer={[{ left: "~/app" }]} />);
    const rule = c.locator("form > div").first();
    await rule.tap();
    await expect(c.locator("textarea")).toBeFocused();
  });

  test("with the keyboard up for the field, the status lines step aside", async ({
    mount,
    page,
  }) => {
    const c = await mount(
      <Chat
        messages={LONG_TRANSCRIPT}
        onSubmit={() => {}}
        height={600}
        footer={[{ left: "~/app", right: "model" }, { left: "usage" }]}
      />,
    );
    await expect(c.getByText("usage")).toBeVisible();
    const before = await c.getByTestId("chat-messages").evaluate((el) => el.clientHeight);
    await raiseKeyboard(page, 300);
    // The keyboard alone is not the chat's: nothing changes until its field
    // has the focus.
    await expect(c.getByText("usage")).toBeVisible();
    await c.locator("textarea").tap();
    await expect(c.getByText("usage")).toBeHidden();
    const after = await c.getByTestId("chat-messages").evaluate((el) => el.clientHeight);
    expect(after).toBeGreaterThan(before);
    await c.locator("textarea").blur();
    await expect(c.getByText("usage")).toBeVisible();
  });

  test("a scroll that reaches the transcript's end stops there", async ({ mount }) => {
    const c = await mount(<Chat messages={LONG_TRANSCRIPT} onSubmit={() => {}} height={400} />);
    expect(
      await c
        .getByTestId("chat-messages")
        .evaluate((el) => getComputedStyle(el).overscrollBehaviorY),
    ).toBe("contain");
  });
});

test("with a mouse and keyboard, Enter sends and the keyboard's Return says so", async ({
  mount,
}) => {
  const c = await mount(<Chat messages={[]} onSubmit={() => {}} />);
  await expect(c.locator("textarea")).toHaveAttribute("enterkeyhint", "send");
  await expect(c.locator("textarea")).toBeFocused();
});
