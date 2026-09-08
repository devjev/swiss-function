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

test("centered: dragging one edge mirrors the other, keeping the column centered", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ inlineSize: 900, blockSize: 420 }}>
      <ChatDrawer
        defaultOpen
        centered
        defaultSize={600}
        defaultChatWidth={300}
        minChatWidth={200}
        messages={messages}
        onSubmit={() => {}}
      >
        <div>app content</div>
      </ChatDrawer>
    </div>,
  );
  const left = c.getByRole("separator", { name: "Resize chat (left edge)" });
  const right = c.getByRole("separator", { name: "Resize chat (right edge)" });
  await expect(left).toBeVisible();
  await expect(right).toBeVisible();

  // The handle hairline sits at its box centre, on the column edge.
  const lb = await left.boundingBox();
  const rb = await right.boundingBox();
  if (!lb || !rb) throw new Error("missing boxes");
  const widthBefore = rb.x + rb.width / 2 - (lb.x + lb.width / 2);
  const midBefore = (lb.x + rb.x + (lb.width + rb.width) / 2) / 2;
  expect(Math.abs(widthBefore - 300)).toBeLessThan(3);

  // Drag the right edge 60px outward: the left edge mirrors, so the width
  // grows by 120 and the midpoint stays put.
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
  await page.mouse.down();
  await page.mouse.move(rb.x + rb.width / 2 + 60, rb.y + rb.height / 2, { steps: 6 });
  await page.mouse.up();

  const la = await left.boundingBox();
  const ra = await right.boundingBox();
  if (!la || !ra) throw new Error("missing boxes");
  const widthAfter = ra.x + ra.width / 2 - (la.x + la.width / 2);
  const midAfter = (la.x + ra.x + (la.width + ra.width) / 2) / 2;
  expect(Math.abs(widthAfter - 420)).toBeLessThan(3);
  expect(Math.abs(midAfter - midBefore)).toBeLessThan(2);
  await expect(right).toHaveAttribute("aria-valuenow", "420");
});

test("centered: arrow keys step the pressed edge, mirrored and clamped", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ inlineSize: 900, blockSize: 420 }}>
      <ChatDrawer
        defaultOpen
        centered
        defaultSize={600}
        defaultChatWidth={300}
        minChatWidth={200}
        messages={messages}
        onSubmit={() => {}}
      >
        <div>app content</div>
      </ChatDrawer>
    </div>,
  );
  const right = c.getByRole("separator", { name: "Resize chat (right edge)" });
  await right.focus();
  // ArrowRight moves the right edge outward by 24; the mirror doubles it.
  await page.keyboard.press("ArrowRight");
  await expect(right).toHaveAttribute("aria-valuenow", "348");
  await page.keyboard.press("ArrowLeft");
  await expect(right).toHaveAttribute("aria-valuenow", "300");

  // On the left edge, ArrowLeft is the outward (grow) direction.
  const left = c.getByRole("separator", { name: "Resize chat (left edge)" });
  await left.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(left).toHaveAttribute("aria-valuenow", "348");

  // Shrinking clamps at minChatWidth.
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  await expect(left).toHaveAttribute("aria-valuenow", "200");
});

test("the SplitPane divider wins the seam hit test (panel drag resizes, no text selection)", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ inlineSize: 900, blockSize: 420 }}>
      <ChatDrawer
        defaultOpen
        defaultSize={400}
        minSize={200}
        messages={messages}
        onSubmit={() => {}}
      >
        <div>app content</div>
      </ChatDrawer>
    </div>,
  );
  const divider = c.getByRole("separator", { name: "Resize panel" });
  const db = await divider.boundingBox();
  if (!db) throw new Error("missing box");

  // Grab the divider at its centre (the seam line, where the panel's content
  // layer used to win the hit test) and drag left: the panel must grow.
  await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2);
  await page.mouse.down();
  await page.mouse.move(db.x + db.width / 2 - 80, db.y + db.height / 2, { steps: 6 });
  await page.mouse.up();

  const after = await divider.boundingBox();
  if (!after) throw new Error("missing box");
  expect(db.x - after.x).toBeGreaterThan(60);
});

test("centered margins: content shows when wide, hides under marginMinWidth, returns", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ inlineSize: 900, blockSize: 420 }}>
      <ChatDrawer
        defaultOpen
        centered
        defaultSize={600}
        defaultChatWidth={240}
        minChatWidth={200}
        marginMinWidth={120}
        margins={{ left: <div>left note</div>, right: <div>right note</div> }}
        messages={messages}
        onSubmit={() => {}}
      >
        <div>app content</div>
      </ChatDrawer>
    </div>,
  );
  // Gutters ≈ (552 − 240) / 2 = 156px ≥ 120 → visible on both sides.
  await expect(c.getByText("left note")).toBeVisible();
  await expect(c.getByText("right note")).toBeVisible();

  // Widen the chat until the gutters drop under the threshold: 240 + 2×50 =
  // 340 → gutters ≈ 106px < 120 → both sides hide, but stay mounted.
  const right = c.getByRole("separator", { name: "Resize chat (right edge)" });
  const rb = await right.boundingBox();
  if (!rb) throw new Error("missing box");
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
  await page.mouse.down();
  await page.mouse.move(rb.x + rb.width / 2 + 50, rb.y + rb.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(c.getByText("left note")).toBeHidden();
  await expect(c.getByText("right note")).toBeHidden();
  await expect(c.getByText("left note")).toHaveCount(1); // mounted, display: none

  // Shrink one keyboard step (340 − 48 = 292 → gutters ≈ 130px) → back.
  await right.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(c.getByText("left note")).toBeVisible();
  await expect(c.getByText("right note")).toBeVisible();
});

test("margins render only in centered mode", async ({ mount }) => {
  const c = await mount(
    <div style={{ inlineSize: 900, blockSize: 420 }}>
      <ChatDrawer
        defaultOpen
        margins={{ left: <div>left note</div> }}
        messages={messages}
        onSubmit={() => {}}
      >
        <div>app content</div>
      </ChatDrawer>
    </div>,
  );
  await expect(c.getByText("left note")).toHaveCount(0);
});

test("non-centered has no edge handles", async ({ mount }) => {
  const c = await mount(
    <div style={{ inlineSize: 900, blockSize: 420 }}>
      <ChatDrawer defaultOpen messages={messages} onSubmit={() => {}}>
        <div>app content</div>
      </ChatDrawer>
    </div>,
  );
  // Only the SplitPane divider remains.
  await expect(c.getByRole("separator")).toHaveCount(1);
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

test("fullscreen is controllable from outside (expanded / onExpandedChange)", async ({ mount }) => {
  let reported: boolean | null = null;
  const c = await mount(
    <div style={{ inlineSize: 800, blockSize: 400 }}>
      <ChatDrawer
        defaultOpen
        title="Assistant"
        messages={messages}
        onSubmit={() => {}}
        expanded
        onExpandedChange={(next) => {
          reported = next;
        }}
      >
        <div>app content</div>
      </ChatDrawer>
    </div>,
  );
  // Controlled on: the header shows the exit toggle without any click.
  const exit = c.getByRole("button", { name: "Exit fullscreen" });
  await expect(exit).toBeVisible();
  await exit.click();
  // Still controlled on; the change was reported for the owner to apply.
  await expect(c.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
  expect(reported).toBe(false);
});

test("megachat: maximized and centered, a left-edge drag mirrors to the right edge", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ inlineSize: 900, blockSize: 420 }}>
      <ChatDrawer
        defaultOpen
        expanded
        centered
        defaultChatWidth={400}
        minChatWidth={200}
        messages={messages}
        onSubmit={() => {}}
      >
        <div>app content</div>
      </ChatDrawer>
    </div>,
  );
  // Maximized: the panel is a fixed viewport overlay.
  const fixed = await page.evaluate(() => {
    const el = document.querySelector('[class*="fullscreen"]');
    return el ? getComputedStyle(el).position : null;
  });
  expect(fixed).toBe("fixed");
  const left = c.getByRole("separator", { name: "Resize chat (left edge)" });
  const right = c.getByRole("separator", { name: "Resize chat (right edge)" });
  const lb = await left.boundingBox();
  const rb = await right.boundingBox();
  if (!lb || !rb) throw new Error("missing boxes");
  const widthBefore = rb.x + rb.width / 2 - (lb.x + lb.width / 2);
  const midBefore = (lb.x + rb.x + (lb.width + rb.width) / 2) / 2;
  expect(Math.abs(widthBefore - 400)).toBeLessThan(3);
  // Pull the LEFT edge 60px to the left: the right edge mirrors to the right.
  await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2);
  await page.mouse.down();
  await page.mouse.move(lb.x + lb.width / 2 - 60, lb.y + lb.height / 2, { steps: 6 });
  await page.mouse.up();
  const la = await left.boundingBox();
  const ra = await right.boundingBox();
  if (!la || !ra) throw new Error("missing boxes");
  const widthAfter = ra.x + ra.width / 2 - (la.x + la.width / 2);
  const midAfter = (la.x + ra.x + (la.width + ra.width) / 2) / 2;
  expect(Math.abs(widthAfter - 520)).toBeLessThan(3);
  expect(Math.abs(midAfter - midBefore)).toBeLessThan(2);
  expect(Math.abs(ra.x + ra.width / 2 - (rb.x + rb.width / 2) - 60)).toBeLessThan(3);
  await expect(left).toHaveAttribute("aria-valuenow", "520");
});
