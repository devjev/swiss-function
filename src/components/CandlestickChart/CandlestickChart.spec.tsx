import { expect, test } from "@playwright/experimental-ct-react";
import type { Candle } from "./CandlestickChart";
import { CandlestickChart } from "./CandlestickChart";

// Pins the delegated-hover contract of the memo'd candle layer (issue #14):
// pointer events always target the inner wick/body/hit nodes — never the
// per-candle <g> — so hover must resolve via closest("[data-idx]").

const CANDLES: Candle[] = [
  { x: 1, open: 100, high: 108, low: 97, close: 105 },
  { x: 2, open: 105, high: 111, low: 103, close: 104 },
  { x: 3, open: 104, high: 106, low: 95, close: 98 },
  { x: 4, open: 98, high: 103, low: 96, close: 102 },
  { x: 5, open: 102, high: 110, low: 101, close: 109 },
  { x: 6, open: 109, high: 112, low: 104, close: 106 },
];

test("renders one candle group per datum with a11y attrs", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <CandlestickChart candles={CANDLES} height={240} />
    </div>,
  );
  await expect(c.locator("g[data-idx]")).toHaveCount(6);
  const candle = c.locator("g[data-idx='0']");
  await expect(candle).toHaveAttribute("role", "button");
  await expect(candle).toHaveAttribute("aria-label", "1: open 100, high 108, low 97, close 105");
});

test("hover resolves through the inner hit rect to the candle tooltip", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <CandlestickChart candles={CANDLES} height={240} />
    </div>,
  );
  // The pointer target is a candle's transparent full-height hit <rect> (the
  // last rect in its group — never the <g>), exercising the
  // closest("[data-idx]") lookup. Hovering the svg's center instead would be
  // geometry-dependent: it can land in the band-padding gap between hit rects.
  await c.locator("g[data-idx='2'] rect").last().hover();
  await expect(page.getByRole("tooltip")).toContainText("O 104");
  await expect(c.locator("[data-hovered='true']")).toHaveCount(1);
  await page.mouse.move(1, 1);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("focusing a candle shows its OHLC tooltip; blur hides it", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <CandlestickChart candles={CANDLES} height={240} />
    </div>,
  );
  const candle = c.locator("g[data-idx='3']");
  await candle.focus();
  await expect(page.getByRole("tooltip")).toContainText("O 98");
  await candle.blur();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});
