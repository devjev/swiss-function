/** Card-node sizing + attribute stamping for the Graph's `nodeStyle="card"`.
 *
 *  Pure except for `token()`/canvas reads, both DOM-guarded (the module stays
 *  importable in unit tests without a browser). Card dimensions live in "card
 *  px": the same units the org layout spaces by, mapped to screen pixels by
 *  Sigma's size scaling (`renderer.scaleSize(1)` px per unit). */

import type Graphology from "graphology";
import { token } from "./build";
import type { CardBox } from "./orgLayout";
import type { GraphData } from "./types";

/** Card design constants, in card px. */
export const CARD = {
  padX: 10,
  padY: 8,
  lineGap: 3,
  /** Width of the kind-coloured accent stripe on the leading edge. */
  stripe: 3,
  labelPx: 13,
  sublabelPx: 10.5,
  minWidth: 72,
  maxWidth: 224,
  /** Below this on-screen card height the in-card text is skipped. */
  minTextPx: 9,
} as const;

/** Card height for one or two text lines. */
export function cardHeight(hasSublabel: boolean): number {
  return 2 * CARD.padY + CARD.labelPx + (hasSublabel ? CARD.lineGap + CARD.sublabelPx : 0);
}

/** Canvas-measureText card sizing with an internal cache. `el` resolves the
 *  theme font; without a DOM (unit tests, SSR) falls back to a per-character
 *  estimate. Widths quantize up to 2px so cache keys stay stable. */
export function createCardMeasurer(
  el?: Element | null,
): (label: string, sublabel?: string) => CardBox {
  let ctx: CanvasRenderingContext2D | null = null;
  let family = "system-ui";
  if (typeof document !== "undefined") {
    ctx = document.createElement("canvas").getContext("2d");
    family = token("--sf-font-sans", "system-ui", el);
  }
  const cache = new Map<string, number>();
  const textWidth = (text: string, px: number, weight: string): number => {
    if (!ctx) return text.length * px * 0.55;
    const key = `${weight}|${px}|${text}`;
    let width = cache.get(key);
    if (width === undefined) {
      if (cache.size > 10_000) cache.clear();
      ctx.font = `${weight} ${px}px ${family}`;
      width = ctx.measureText(text).width;
      cache.set(key, width);
    }
    return width;
  };
  return (label, sublabel) => {
    const text = Math.max(
      textWidth(label, CARD.labelPx, "600"),
      sublabel ? textWidth(sublabel, CARD.sublabelPx, "400") : 0,
    );
    const raw = CARD.stripe + 2 * CARD.padX + Math.ceil(text);
    const width = Math.min(CARD.maxWidth, Math.max(CARD.minWidth, 2 * Math.ceil(raw / 2)));
    return { width, height: cardHeight(Boolean(sublabel)) };
  };
}

/** Stamp (or clear) card attributes on the live graph. Call after every
 *  `applyVisuals` — visuals set `label`/`size`/`color` first, cards then
 *  override `type`/`size` and add their dimensions + theme colours. Clearing
 *  restores `type: "circle"`; `applyVisuals` has already restored `size`. */
export function applyCardAttributes(
  g: Graphology,
  data: GraphData,
  el: Element | null | undefined,
  on: boolean,
): void {
  if (!on) {
    for (const n of data.nodes) {
      if (g.hasNode(n.id)) g.mergeNodeAttributes(n.id, { type: "circle" });
    }
    return;
  }
  const measure = createCardMeasurer(el);
  const bg = token("--sf-color-bg", "#ffffff", el);
  const border = token("--sf-color-border", "#e5e7eb", el);
  const sub = token("--sf-color-fg-subtle", "#4b5563", el);
  for (const n of data.nodes) {
    if (!g.hasNode(n.id)) continue;
    const label = (g.getNodeAttribute(n.id, "label") as string | undefined) ?? n.id;
    const sublabel = g.getNodeAttribute(n.id, "sublabel") as string | undefined;
    const box = measure(label, sublabel);
    g.mergeNodeAttributes(n.id, {
      type: "card",
      cardWidth: box.width,
      cardHeight: box.height,
      // Half the card height: Sigma's label grid, hover geometry and arrowhead
      // clamping all read `size` as a radius.
      size: box.height / 2,
      cardBg: bg,
      cardBorder: border,
      cardSub: sub,
    });
  }
}
