/** Pure geometry for the Minimap rail (issue #73). No DOM: everything here is
 *  unit-testable math. Everything lives on ONE scale, the proportional one
 *  (railY = top / scrollHeight x railHeight): the rail is a fit-only picture
 *  of the whole document, and the viewport indicator is the exact band of that
 *  picture currently visible in the main view, so the markers inside the
 *  indicator always correspond to the content on screen.
 *
 *  A proportional indicator for a very long document is a few px tall and
 *  ungrabbable, but the *visual* must stay honest, so the minimum size (24px,
 *  the WCAG 2.5.8 target) applies to an invisible grab/focus zone centered on
 *  the visual band (grabZone), never to the band itself. */

export type MinimapMarkerKind = "block" | "header";

export type MinimapMarkerTone = "primary" | "success" | "warning" | "danger";

export interface MinimapMarker {
  /** Stable identity (used as the React key when present). */
  id?: string;
  /** Content offset in px. When both `top` and `topFraction` are present, `top` wins. */
  top?: number;
  /** Content offset as a fraction of scrollHeight in [0, 1]. Exactly one of
   *  `top` / `topFraction` is required; a marker with neither is dropped. */
  topFraction?: number;
  /** Extent in content px, for block spans. Optional; a bare rule otherwise. */
  height?: number;
  /** `block` (default): a thin dither rule, decorative. `header`: a
   *  clickable, level-indented text label. */
  kind?: MinimapMarkerKind;
  /** Header text; `header` kind only. */
  label?: string;
  /** Heading depth: drives label indentation and collision-decimation priority. */
  level?: number;
  /** Optional accent; only where the color means something (status, priority). */
  tone?: MinimapMarkerTone;
}

/** Resolve a marker's content offset in px, or null when neither position field
 *  is present (such a marker is dropped; no marker may reach the DOM with a NaN
 *  position). `top` wins when both fields are set. */
export function resolveMarkerTop(marker: MinimapMarker, scrollHeight: number): number | null {
  if (typeof marker.top === "number" && Number.isFinite(marker.top)) return marker.top;
  if (typeof marker.topFraction === "number" && Number.isFinite(marker.topFraction)) {
    return marker.topFraction * scrollHeight;
  }
  return null;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Proportional scale: a content offset's y on the rail, clamped to the rail. */
export function markerRailY(top: number, scrollHeight: number, railHeight: number): number {
  if (scrollHeight <= 0) return 0;
  return clamp((top / scrollHeight) * railHeight, 0, railHeight);
}

/** A content extent's height on the rail (proportional scale), floored so a
 *  short block still reads as a rule. */
export function markerRailHeight(
  height: number,
  scrollHeight: number,
  railHeight: number,
  minPx: number,
): number {
  if (scrollHeight <= 0) return minPx;
  return Math.max((height / scrollHeight) * railHeight, minPx);
}

export interface ThumbGeometry {
  top: number;
  height: number;
}

/** The viewport indicator, on the same proportional scale as the markers: the
 *  band [scrollTop, scrollTop + clientHeight] of the document, scaled into the
 *  rail. The markers inside it are exactly the content visible in the main
 *  view. `minVisual` is a visibility floor only (a hairline band would vanish);
 *  the *interaction* minimum lives in grabZone. With no scrollable overflow
 *  the band fills the rail; the component collapses the rail in that state
 *  anyway (see railVisibleNext). */
export function thumbGeometry(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  railHeight: number,
  minVisual: number,
): ThumbGeometry {
  if (scrollHeight - clientHeight <= 0 || scrollHeight <= 0 || railHeight <= 0) {
    return { top: 0, height: railHeight };
  }
  const height = clamp((clientHeight / scrollHeight) * railHeight, minVisual, railHeight);
  const top = clamp((scrollTop / scrollHeight) * railHeight, 0, railHeight - height);
  return { top, height };
}

/** The invisible grab/focus zone: at least `minTarget` tall (WCAG 2.5.8),
 *  centered on the visual band, clamped into the rail. Presses inside it grab
 *  the indicator; presses outside jump. */
export function grabZone(
  visual: ThumbGeometry,
  railHeight: number,
  minTarget: number,
): ThumbGeometry {
  const height = Math.min(Math.max(visual.height, minTarget), railHeight);
  const center = visual.top + visual.height / 2;
  const top = clamp(center - height / 2, 0, railHeight - height);
  return { top, height };
}

/** Inversion of thumbGeometry's position map: the scrollTop that puts the
 *  visual band's top at `thumbTop`. Same proportional scale, so the band
 *  tracks the pointer 1:1 during a drag. */
export function scrollTopForThumbTop(
  thumbTop: number,
  scrollHeight: number,
  clientHeight: number,
  railHeight: number,
): number {
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= 0 || scrollHeight <= 0 || railHeight <= 0) return 0;
  return clamp((thumbTop / railHeight) * scrollHeight, 0, maxScroll);
}

/** The scrollTop for a press on empty rail at `pressY`: center the *viewport*
 *  on the pressed content position (the press-to-jump gesture, M2). */
export function scrollTopForRailPress(
  pressY: number,
  scrollHeight: number,
  clientHeight: number,
  railHeight: number,
): number {
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= 0 || scrollHeight <= 0 || railHeight <= 0) return 0;
  return clamp((pressY / railHeight) * scrollHeight - clientHeight / 2, 0, maxScroll);
}

/** Rail visibility with hysteresis. Collapsing the rail changes the content
 *  width, and width-dependent content heights (a `width: 100%` image) make a
 *  naive `scrollHeight > clientHeight` test self-referential: hide, widen,
 *  fit, show, narrow, overflow, hide again, a ResizeObserver flicker loop. So:
 *  a hidden rail appears on any overflow, and a visible rail collapses only
 *  when the content would fit with the rail width added back as vertical
 *  slack; between the thresholds the current state holds. */
export function railVisibleNext(
  visible: boolean,
  scrollHeight: number,
  clientHeight: number,
  railWidth: number,
): boolean {
  if (!visible) return scrollHeight > clientHeight;
  return scrollHeight + railWidth > clientHeight;
}

/** One header label as the de-overlap pass sees it. */
export interface LabelCandidate {
  /** Rail y (proportional scale). */
  y: number;
  /** Heading depth; shallower levels win collisions. */
  level: number;
}

/** Collision decimation for header labels (the chart tick-decimation idea):
 *  labels keep a minimum vertical spacing; on collision the deepest-level
 *  labels drop first, then later document order. Returns a visibility flag per
 *  input label, in input order. The dropped labels' block rules stay on the
 *  rail; the sections remain reachable by rail press. */
export function decimateLabels(labels: readonly LabelCandidate[], minSpacing: number): boolean[] {
  // Priority order: shallower level first, then document order.
  const order = labels
    .map((label, index) => ({ ...label, index }))
    .sort((a, b) => a.level - b.level || a.index - b.index);
  const keptYs: number[] = [];
  const visible = new Array<boolean>(labels.length).fill(false);
  for (const candidate of order) {
    const collides = keptYs.some((y) => Math.abs(y - candidate.y) < minSpacing);
    if (!collides) {
      keptYs.push(candidate.y);
      visible[candidate.index] = true;
    }
  }
  return visible;
}
