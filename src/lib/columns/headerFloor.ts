/** Content-aware column floors (issue #102).
 *
 *  A column is never narrower than its header needs on its declared line
 *  count: the floor is `max(declared minimum, measured header need)`. The
 *  need is read off the rendered header (its padding, every in-flow piece of
 *  chrome, and the label on N lines), so it is right for any font, padding,
 *  size or unit. Shared by DataTable and Explorer.
 *
 *  The pure parts (combining, the N-line search, the row's line count) are
 *  here so they test without a DOM; `measureHeaderNeed` is the one DOM
 *  reader, kept small and called only at measurement time (mount, a font or
 *  size change), never per drag frame. */

/** The floor a column resolves to: its declared minimum in px, raised to the
 *  measured header need when that is known and larger. */
export function combineFloor(declaredMinPx: number, needPx: number | undefined): number {
  if (needPx == null || !Number.isFinite(needPx)) return declaredMinPx;
  return Math.max(declaredMinPx, needPx);
}

/** The narrowest integer width at which text fits in `lines` lines, by binary
 *  search over `countLines(width)`, which must be monotone (a wider box never
 *  needs more lines). `lo` is the min-content width (the longest unbreakable
 *  run: no width below it helps), `hi` the max-content width (one line). For
 *  `lines <= 1` the answer is `hi` without a search. */
export function narrowestWidthForLines(
  countLines: (width: number) => number,
  lo: number,
  hi: number,
  lines: number,
): number {
  const one = Math.ceil(hi);
  if (lines <= 1) return one;
  // Never below the longest run, rounded up: a box a hair narrower than the
  // widest word overflows it by a fraction and earns an ellipsis.
  let low = Math.max(0, Math.ceil(lo));
  let high = Math.max(low, one);
  if (countLines(low) <= lines) return low;
  // Invariant: countLines(low) > lines, countLines(high) <= lines.
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (countLines(mid) <= lines) high = mid;
    else low = mid;
  }
  return high;
}

/** Lines of text a row of `rowHeight` px can hold at `leading` px per line,
 *  keeping `breathing` px free (half a unit: a two-line row is 60px, not a
 *  48px stack of two bare lines). Never below one. */
export function cellLines(rowHeight: number, leading: number, breathing: number): number {
  if (!(leading > 0)) return 1;
  return Math.max(1, Math.floor((rowHeight - breathing) / leading));
}

export interface HeaderNeedOptions {
  /** The header's label element (the title). Measured on `lines` lines. */
  label: HTMLElement;
  /** Lines the label may take. Default 1. */
  lines?: number;
}

/** The inline extent of an element's contents, fractional, regardless of the
 *  box it is squeezed into: a Range over the contents reports the laid-out
 *  run, where `scrollWidth` is an integer and `offsetWidth` the clipped box. */
export function contentInlineSize(el: HTMLElement): number {
  const range = document.createRange();
  range.selectNodeContents(el);
  const w = range.getBoundingClientRect().width;
  range.detach();
  return w;
}

/** The width a header cell needs so that its label stays on `lines` lines
 *  with every piece of chrome in place: the cell's inline padding, each
 *  in-flow child (chevron, filter, a reserved sort arrow), the gaps between
 *  them, and the label's own need (its one-line run, or the narrowest width
 *  that holds it in N lines). Absolutely positioned children (the resize
 *  handle, the select zone) sit outside the flow and are skipped. Reads
 *  layout, so call it at measurement time only. */
export function measureHeaderNeed(
  cell: HTMLElement,
  { label, lines = 1 }: HeaderNeedOptions,
): number {
  const cs = getComputedStyle(cell);
  const padding =
    (Number.parseFloat(cs.paddingInlineStart) || 0) + (Number.parseFloat(cs.paddingInlineEnd) || 0);
  const gap = Number.parseFloat(cs.columnGap) || 0;
  let chrome = 0;
  let inFlow = 0;
  for (const child of Array.from(cell.children) as HTMLElement[]) {
    if (getComputedStyle(child).position === "absolute") continue;
    inFlow += 1;
    if (child === label) continue;
    // A flex item's margins are part of its footprint on the line.
    const ccs = getComputedStyle(child);
    chrome +=
      child.getBoundingClientRect().width +
      (Number.parseFloat(ccs.marginInlineStart) || 0) +
      (Number.parseFloat(ccs.marginInlineEnd) || 0);
  }
  const labelNeed = lines > 1 ? narrowestLabelWidth(label, lines) : contentInlineSize(label);
  const gaps = Math.max(0, inFlow - 1) * gap;
  return Math.ceil(padding + chrome + gaps + labelNeed);
}

/** The narrowest width that holds `label` in `lines` lines: a hidden clone
 *  next to it (same inherited font), laid out at candidate widths, its line
 *  count read from its height. About eight layouts per call. */
function narrowestLabelWidth(label: HTMLElement, lines: number): number {
  const probe = label.cloneNode(true) as HTMLElement;
  probe.removeAttribute("id");
  probe.setAttribute("aria-hidden", "true");
  const style = probe.style;
  style.position = "absolute";
  style.visibility = "hidden";
  style.pointerEvents = "none";
  style.display = "block";
  style.whiteSpace = "normal";
  style.overflow = "visible";
  style.inlineSize = "min-content";
  style.maxInlineSize = "none";
  style.minInlineSize = "0";
  style.webkitLineClamp = "unset";
  // Greedy breaking for the search; `balance` on the real label never adds a
  // line, so the count agrees.
  style.setProperty("text-wrap", "wrap");
  label.parentElement?.appendChild(probe);
  try {
    const lineHeight = Number.parseFloat(getComputedStyle(probe).lineHeight) || 0;
    const lo = probe.getBoundingClientRect().width;
    style.inlineSize = "max-content";
    const hi = probe.getBoundingClientRect().width;
    const countLines = (width: number): number => {
      style.inlineSize = `${width}px`;
      const h = probe.getBoundingClientRect().height;
      return lineHeight > 0 ? Math.round(h / lineHeight) : 1;
    };
    return narrowestWidthForLines(countLines, lo, hi, lines);
  } finally {
    probe.remove();
  }
}
