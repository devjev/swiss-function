import { expect, test } from "@playwright/experimental-ct-react";
import type { ChatMessage } from "../Chat";
import { MenuBar } from "../MenuBar";
import { ChatDrawer } from "./ChatDrawer";
import { MegachatDemo } from "./Megachat.harness";

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

test("megachat: a reply widget dragged into a margin is saved there, and can be removed", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ inlineSize: 1200, blockSize: 640 }}>
      <MegachatDemo persist={false} />
    </div>,
  );
  const widget = c.locator('[data-widget="aum"]').first();
  await expect(widget).toBeVisible();
  const leftShelf = c.locator('[data-shelf="left"]');
  await expect(leftShelf.locator("[data-saved]")).toHaveCount(0);
  await widget.dragTo(leftShelf);
  await expect(leftShelf.locator("[data-saved]")).toHaveCount(1);
  await expect(leftShelf.locator('[data-saved="aum"]')).toBeVisible();
  // Saving copies: the reply keeps its widget.
  await expect(widget).toBeVisible();
  // Dropping it again on the same shelf does not duplicate it.
  await widget.dragTo(leftShelf);
  await expect(leftShelf.locator("[data-saved]")).toHaveCount(1);
  // The other shelf takes its own copy.
  await c.locator('[data-widget="flows-chart"]').first().dragTo(c.locator('[data-shelf="right"]'));
  await expect(c.locator('[data-shelf="right"] [data-saved]')).toHaveCount(1);
  await page.getByRole("button", { name: "Remove AUM" }).click();
  await expect(leftShelf.locator("[data-saved]")).toHaveCount(0);
});

test("the menu slot sits between the title and the actions", async ({ mount }) => {
  const c = await mount(
    <div style={{ inlineSize: 900, blockSize: 400 }}>
      <ChatDrawer
        defaultOpen
        title="Assistant"
        menu={<div data-testid="bar">bar</div>}
        messages={messages}
        onSubmit={() => {}}
      >
        <div>app content</div>
      </ChatDrawer>
    </div>,
  );
  const order = await c.evaluate((root) => {
    const title = root.querySelector("h2");
    const bar = root.querySelector('[data-testid="bar"]');
    const close = root.querySelector('button[aria-label="Close"]');
    if (!title || !bar || !close) return "missing";
    const after = (a: Element, b: Element) =>
      !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    return after(title, bar) && after(bar, close) ? "title, bar, actions" : "wrong";
  });
  expect(order).toBe("title, bar, actions");
});

test("a MenuBar dropdown in the header of the maximized panel paints above it", async ({
  mount,
  page,
}) => {
  await mount(
    <div style={{ inlineSize: 900, blockSize: 400 }}>
      <ChatDrawer
        defaultOpen
        defaultExpanded
        title="Assistant"
        menu={
          <MenuBar.Root transparent>
            <MenuBar.Menu>
              <MenuBar.Trigger>Conversation</MenuBar.Trigger>
              <MenuBar.Content>
                <MenuBar.Item>Rename</MenuBar.Item>
              </MenuBar.Content>
            </MenuBar.Menu>
          </MenuBar.Root>
        }
        messages={messages}
        onSubmit={() => {}}
      >
        <div>app content</div>
      </ChatDrawer>
    </div>,
  );
  await page.getByRole("menuitem", { name: "Conversation" }).click();
  const item = page.getByRole("menuitem", { name: "Rename" });
  await expect(item).toBeVisible();
  // The popup must beat the fullscreen panel's modal band, and be the element
  // under the pointer (not the panel covering it).
  const stacked = await item.evaluate((el) => {
    const panel = document.querySelector('[class*="fullscreen"]');
    const panelZ = panel ? Number.parseInt(getComputedStyle(panel).zIndex, 10) : 0;
    let popupZ = 0;
    for (let node: Element | null = el; node; node = node.parentElement) {
      const z = Number.parseInt(getComputedStyle(node).zIndex, 10);
      if (Number.isFinite(z)) popupZ = Math.max(popupZ, z);
    }
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { above: popupZ > panelZ, hitInside: !!hit && el.contains(hit) };
  });
  expect(stacked).toEqual({ above: true, hitInside: true });
  await item.hover();
  await expect(item).toHaveCSS("background-color", /.+/);
});

test("chatAlign left: one free-edge handle, the column flush left, a drag moves that edge alone", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ inlineSize: 900, blockSize: 420 }}>
      <ChatDrawer
        defaultOpen
        expanded
        centered
        chatAlign="left"
        defaultChatWidth={400}
        minChatWidth={200}
        margins={{ left: <div data-testid="m-left" />, right: <div data-testid="m-right" /> }}
        messages={messages}
        onSubmit={() => {}}
      >
        <div>app content</div>
      </ChatDrawer>
    </div>,
  );
  await expect(c.getByRole("separator", { name: "Resize chat (left edge)" })).toHaveCount(0);
  await expect(c.getByTestId("m-left")).toHaveCount(0);
  await expect(c.getByTestId("m-right")).toBeAttached();
  const right = c.getByRole("separator", { name: "Resize chat (right edge)" });
  // The column starts at the body's left edge.
  const flush = await right.evaluate((el) => {
    const body = el.parentElement as HTMLElement;
    const column = body.querySelector('[class*="centerColumn"]') as HTMLElement;
    return Math.abs(column.getBoundingClientRect().left - body.getBoundingClientRect().left);
  });
  expect(flush).toBeLessThan(1);
  const rb = await right.boundingBox();
  if (!rb) throw new Error("missing box");
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
  await page.mouse.down();
  await page.mouse.move(rb.x + rb.width / 2 + 60, rb.y + rb.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(right).toHaveAttribute("aria-valuenow", "460");
  const ra = await right.boundingBox();
  if (!ra) throw new Error("missing box");
  expect(Math.abs(ra.x - rb.x - 60)).toBeLessThan(3);
});

test("megachat: aligning the chat left leaves one masonry shelf on the right", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ inlineSize: 1100, blockSize: 480 }}>
      <MegachatDemo persist={false} />
    </div>,
  );
  await expect(c.locator("[data-shelf]")).toHaveCount(2);
  await page.getByRole("button", { name: "Chat on the left" }).click();
  await expect(c.locator("[data-shelf]")).toHaveCount(1);
  const shelf = c.locator('[data-shelf="right"]');
  await expect(shelf).toHaveAttribute("data-layout", "masonry");
  await expect(page.getByRole("button", { name: "Chat on the left" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await c.locator('[data-widget="aum"]').first().dragTo(shelf);
  await c.locator('[data-widget="flows"]').first().dragTo(shelf);
  await expect(shelf.locator("[data-saved]")).toHaveCount(2);
  // Both saved widgets are visible (measured and placed), neither on top of the other.
  const boxes = await shelf.locator("[data-saved]").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) };
    }),
  );
  expect(boxes).toHaveLength(2);
  expect(boxes[0]).not.toEqual(boxes[1]);
  await page.getByRole("button", { name: "Chat centered" }).click();
  await expect(c.locator("[data-shelf]")).toHaveCount(2);
});
