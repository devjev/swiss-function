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
 *  keeping `breathing` px free (half a unit, so a two-line row is 60px: two
 *  lines plus the breathing). Never below one. */
export function cellLines(rowHeight: number, leading: number, breathing: number): number {
  if (!(leading > 0)) return 1;
  return Math.max(1, Math.floor((rowHeight - breathing) / leading));
}

/** Resolve a CSS length (`var(--sf-unit)`, `calc(...)`) to px in the
 *  context of `parent`, through a hidden probe, so JS clamps agree with the
 *  token the CSS uses. Reads layout: call it at measurement time only. */
export function measureCssLength(parent: HTMLElement, value: string): number {
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;visibility:hidden;width:${value};`;
  parent.appendChild(probe);
  const w = probe.getBoundingClientRect().width;
  probe.remove();
  return w;
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

/** The width an element's contents would take on one line. On a nowrap
 *  body that is its run; on a wrapped body (`overflow: "wrap"`) the run is
 *  folded into lines and its rect is the box, so the lines are summed, plus
 *  the space each break collapsed (a third of the font size, close to a
 *  space's advance). This is what auto-fit reads: the width at which the
 *  value fits on one line. */
export function contentRunWidth(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  if (cs.whiteSpace === "nowrap" || cs.whiteSpace === "pre") return contentInlineSize(el);
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = Array.from(range.getClientRects());
  range.detach();
  if (rects.length <= 1) return rects[0]?.width ?? 0;
  // One rect per line fragment; fragments on the same line (an inline child)
  // are summed the same way, which is right for a run.
  const sum = rects.reduce((acc, r) => acc + r.width, 0);
  const breaks = new Set(rects.map((r) => Math.round(r.top))).size - 1;
  const space = (Number.parseFloat(cs.fontSize) || 0) / 3;
  return sum + Math.max(0, breaks) * space;
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

/** A group title's need as a constraint on the sum of its leaves. */
export interface GroupConstraint {
  /** Indices (into the visible leaves) of the leaves under the group. */
  leafIndices: readonly number[];
  /** The width the group's header needs, in px. */
  need: number;
}

/** The narrowest common width `v` the `targets` may all take so that every
 *  group title still fits: for each group holding targets, its need minus the
 *  widths of its other leaves, shared equally among the targets it holds.
 *  Zero when no group constrains them. */
export function groupFloorFor(
  targets: readonly number[],
  widths: readonly number[],
  groups: readonly GroupConstraint[],
): number {
  let floor = 0;
  for (const g of groups) {
    let held = 0;
    let others = 0;
    for (const i of g.leafIndices) {
      if (targets.includes(i)) held += 1;
      else others += widths[i] ?? 0;
    }
    if (held === 0) continue;
    floor = Math.max(floor, Math.ceil((g.need - others) / held));
  }
  return floor;
}

/** After an auto-fit, raise the fitted leaves so every group title over them
 *  still fits: a group's deficit (its need minus the sum of its leaves) is
 *  shared equally among the fitted leaves it holds. Mutates `widths`. */
export function raiseForGroups(
  widths: number[],
  fitted: ReadonlySet<number>,
  groups: readonly GroupConstraint[],
): void {
  for (const g of groups) {
    const members = g.leafIndices.filter((i) => fitted.has(i));
    if (members.length === 0) continue;
    let sum = 0;
    for (const i of g.leafIndices) sum += widths[i] ?? 0;
    const deficit = g.need - sum;
    if (deficit <= 0) continue;
    const share = Math.ceil(deficit / members.length);
    for (const i of members) widths[i] = (widths[i] ?? 0) + share;
  }
}
