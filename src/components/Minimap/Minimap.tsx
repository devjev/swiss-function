import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { mergeRefs } from "../../lib/mergeRefs";
import { prefersReducedMotion } from "../../lib/prefersReducedMotion";
import { usePointerDrag } from "../../lib/usePointerDrag";
import type { MinimapMarker } from "./geometry";
import {
  decimateLabels,
  grabZone,
  markerRailHeight,
  markerRailY,
  railContentHeight,
  railScrollForBand,
  railVisibleNext,
  resolveMarkerHeight,
  resolveMarkerTop,
  scrollTopForRailPress,
  scrollTopForThumbTop,
  thumbGeometry,
} from "./geometry";
import styles from "./Minimap.module.css";

export type { MinimapMarker, MinimapMarkerKind, MinimapMarkerTone } from "./geometry";

/** One unit (24px at the default root font): the minimum grab/focus zone
 *  (WCAG 2.5.8 target size) and the label line-height. The zone is
 *  invisible; the visual band stays honestly proportional so the markers
 *  inside it are exactly the content visible in the main view. */
const MIN_TARGET_PX = 24;

/** Visibility floor for the visual band: a hairline would vanish. */
const MIN_VISUAL_PX = 2;

/** Fallback rail width for the hysteresis test before the rail is measurable. */
const FALLBACK_RAIL_WIDTH = 144;

/** Floor for a block marker's rendered height, so a bare rule stays visible. */
const MIN_MARKER_PX = 2;

/** Rail-px trimmed from the bottom of a block span, so stacked spans (e.g. a
 *  VerticalForm's rows) read as separated blocks rather than one solid fill.
 *  Only spans are trimmed; bare rules keep their floored height. */
const MARKER_GAP_PX = 3;

/** Upper bound on how far `minMarkerSize` may grow the rail content (a backstop
 *  against a pathological tiny span exploding the DOM). Past it, blocks compress
 *  again. */
const MAX_RAIL_SCALE = 40;

/** Per-frame rail scroll while a band drag rests against the rail's top/bottom
 *  edge (a scrollable rail), so the drag can reach content beyond the view. */
const EDGE_SCROLL_STEP = 8;

/** Arrow-key scroll step: one unit, roughly a text line. */
const KEY_STEP_PX = 24;

/** Active-heading threshold: a label click lands its heading exactly at the
 *  top, so the heading with `top <= scrollTop + epsilon` must include it. */
const ACTIVE_EPSILON_PX = 2;

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export interface MinimapProps extends HTMLAttributes<HTMLDivElement> {
  /** Structural markers in content coordinates: `block` spans (dither rules)
   *  and `header` markers. You always supply these as data, so virtualized
   *  hosts work by re-supplying the array whenever their measurements change. */
  markers?: MinimapMarker[];
  /** Which edge the rail occupies. The DOM order (content, then rail) is fixed
   *  regardless, so the tab order is stable. Default `"right"`. */
  side?: "left" | "right";
  /** Rail width in `--sf-unit` multiples; defaults to `--sf-minimap-width` (3u). */
  width?: number;
  /** Accessible name for the viewport indicator (`role="scrollbar"`).
   *  Default "Scroll position". */
  ariaLabel?: string;
  /** Intercepts a header-label jump. Virtualized hosts route jumps through
   *  their own scroller here; without it the component scrolls its own
   *  container so the heading lands at the top. */
  onJump?: (marker: MinimapMarker) => void;
  /** Minimum block-marker height in `--sf-unit` multiples. When set, block
   *  spans never compress below this: once the content is dense enough that they
   *  would, the rail's inner content grows taller than the rail and the rail
   *  itself scrolls (auto-following the viewport band). Unset (default) keeps the
   *  fit-everything proportional overview. */
  minMarkerSize?: number;
  /** Maximum block-marker height in `--sf-unit` multiples. Caps how tall any one
   *  block renders (a sparse document otherwise gives a few very tall blocks);
   *  the capped block leaves a gap after it rather than overlapping. Unset =
   *  no cap. */
  maxMarkerSize?: number;
  /** Where a label-click jump lands the target in the viewport: `"start"`
   *  (default, at the top) or `"center"` (in the middle). Also anchors which
   *  header reads as active. */
  jumpAlign?: "start" | "center";
  /** The scrollable content. The component owns the scroll container; the
   *  parent must constrain the wrapper's height (like Pane). */
  children?: ReactNode;
}

interface RailSizes {
  scrollHeight: number;
  clientHeight: number;
  /** The rail viewport height. */
  railHeight: number;
  /** The rail's inner content height: `railHeight` in fit mode, taller when
   *  `minMarkerSize` forces the min-block scrollable rail. */
  railContentH: number;
}

const SIZES_ZERO: RailSizes = {
  scrollHeight: 0,
  clientHeight: 0,
  railHeight: 0,
  railContentH: 0,
};

/**
 * Minimap: a scroll-overview rail beside a component-owned scroll container
 * (issue #73). Markers are data, not a scaled DOM clone: `block` markers are
 * thin dither rules (the density read); `header` markers render their text as
 * clickable, level-indented labels with active tracking. A viewport indicator
 * frames the exact band of the document visible in the main view; the rail
 * collapses (with hysteresis) when the content fits.
 *
 * The forwarded ref targets the scroll element: the useful handle for reading
 * the scroll offset, programmatic scrolling, or a virtualizer's
 * `getScrollElement`. Wrapper-level styling goes through className/style.
 */
export const Minimap = forwardRef<HTMLDivElement, MinimapProps>(function Minimap(
  {
    markers,
    side = "right",
    width,
    ariaLabel = "Scroll position",
    onJump,
    minMarkerSize,
    maxMarkerSize,
    jumpAlign = "start",
    children,
    className,
    style,
    ...rest
  },
  forwardedRef,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const scrollId = useId();

  const [sizes, setSizes] = useState<RailSizes>(SIZES_ZERO);
  const [railVisible, setRailVisible] = useState(false);
  /** Integer percent scrolled, for aria-valuenow: re-renders at most 100 times
   *  across a full scroll, not per frame. */
  const [pct, setPct] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  /** The rendered value of var(--sf-unit) in px (label line-height, indent
   *  step), measured through the probe below; 24 only until measured. */
  const [unitPx, setUnitPx] = useState(MIN_TARGET_PX);
  const unitProbeRef = useRef<HTMLDivElement>(null);
  /** Rendered (decimation-surviving) header labels as (key, content top),
   *  sorted, read by the rAF recompute for active tracking without retying
   *  the callback. Survivors only: aria-current must land on a label that is
   *  actually in the DOM, so a decimated header maps to the surviving label
   *  above it. */
  const headersRef = useRef<Array<{ key: string; top: number }>>([]);
  // The hysteresis test needs the rail width while deciding to *hide*, when the
  // rail is still measurable; the last measurement covers the hidden state.
  const railWidthRef = useRef(FALLBACK_RAIL_WIDTH);
  const rafRef = useRef(0);
  // Read by the rAF recompute and the pointer handlers without retying their
  // callbacks: the live marker list / min-block prop feed the effective rail
  // content height, which the drag math and the rail auto-scroll both need.
  const markerListRef = useRef<MinimapMarker[]>([]);
  const minMarkerSizeRef = useRef<number | undefined>(undefined);
  const railContentHRef = useRef(0);
  const draggingRef = useRef(false);
  /** Fraction of the viewport a jump lands the target at (and the active-heading
   *  anchor): 0 = top, 0.5 = center. */
  const anchorFracRef = useRef(0);
  minMarkerSizeRef.current = minMarkerSize;
  anchorFracRef.current = jumpAlign === "center" ? 0.5 : 0;

  /** Single read path: one measurement per frame drives the thumb (imperative
   *  style write, no re-render), the sizes state (marker re-render, only when
   *  a value actually changed), and the hysteresis visibility. */
  const recompute = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const scrollHeight = scroller.scrollHeight;
    const clientHeight = scroller.clientHeight;
    const rail = railRef.current;
    if (rail) {
      railWidthRef.current = rail.offsetWidth || railWidthRef.current;
    }
    const railHeight = rail?.clientHeight ?? 0;
    // The label metrics live in CSS as var(--sf-unit); measure the rendered
    // value through the probe instead of assuming 24px, so a non-16px root
    // font (or a retuned unit) cannot desynchronize the JS label math from
    // the CSS label boxes.
    const probe = unitProbeRef.current;
    const unit = probe && probe.offsetHeight > 0 ? probe.offsetHeight : MIN_TARGET_PX;
    if (probe && probe.offsetHeight > 0) {
      setUnitPx((prev) => (prev === unit ? prev : unit));
    }

    // Effective rail content height (min-block mode): grow so the smallest span
    // block reaches minMarkerSize; otherwise the rail is its own height (fit).
    let railContentH = railHeight;
    const minMarker = minMarkerSizeRef.current;
    if (minMarker && minMarker > 0 && scrollHeight > 0 && railHeight > 0) {
      const spans: number[] = [];
      for (const marker of markerListRef.current) {
        const extent = resolveMarkerHeight(marker, scrollHeight);
        if (extent > 0) spans.push((extent / scrollHeight) * railHeight);
      }
      railContentH = railContentHeight(spans, railHeight, minMarker * unit, MAX_RAIL_SCALE);
    }
    railContentHRef.current = railContentH;

    // Visibility feeds on the CONTENT wrapper's height, not scrollHeight: the
    // DOM floors a scroll element's scrollHeight at its clientHeight, which
    // would make the hysteresis hide-branch unreachable and the rail
    // permanent once shown.
    const contentHeight = contentRef.current?.offsetHeight ?? scrollHeight;
    setRailVisible((visible) =>
      railVisibleNext(visible, contentHeight, clientHeight, railWidthRef.current),
    );
    setSizes((prev) =>
      prev.scrollHeight === scrollHeight &&
      prev.clientHeight === clientHeight &&
      prev.railHeight === railHeight &&
      prev.railContentH === railContentH
        ? prev
        : { scrollHeight, clientHeight, railHeight, railContentH },
    );

    const maxScroll = scrollHeight - clientHeight;
    setPct(maxScroll > 0 ? Math.round((scroller.scrollTop / maxScroll) * 100) : 0);

    // Active heading: the last header at or above the anchor line (top edge, or
    // the viewport middle when jumps center), with the at-bottom clamp (a final
    // section shorter than the viewport can never satisfy the base rule, so full
    // scroll activates the last marker) and an at-top clamp (at rest the first
    // header is active, so the indicator is never empty and never a mid-list one
    // just because the anchor sits below the top).
    const headers = headersRef.current;
    const anchorPx =
      anchorFracRef.current > 0 ? clientHeight * anchorFracRef.current : ACTIVE_EPSILON_PX;
    if (headers.length === 0) {
      setActiveKey(null);
    } else if (scroller.scrollTop <= 1) {
      setActiveKey(headers[0]?.key ?? null);
    } else if (maxScroll > 0 && scroller.scrollTop >= maxScroll - 1) {
      setActiveKey(headers[headers.length - 1]?.key ?? null);
    } else {
      let active: string | null = headers[0]?.key ?? null;
      for (const header of headers) {
        if (header.top <= scroller.scrollTop + anchorPx) active = header.key;
        else break;
      }
      setActiveKey(active);
    }

    const thumb = thumbRef.current;
    if (thumb && railContentH > 0) {
      // The band and markers live on the rail-CONTENT scale (railContentH), so
      // they align whether or not the rail scrolls.
      const visual = thumbGeometry(
        scroller.scrollTop,
        scrollHeight,
        clientHeight,
        railContentH,
        MIN_VISUAL_PX,
      );
      thumb.style.transform = `translateY(${visual.top}px)`;
      thumb.style.height = `${visual.height}px`;
      const zone = grabZone(visual, railContentH, MIN_TARGET_PX);
      const zoneEl = zoneRef.current;
      if (zoneEl) {
        zoneEl.style.transform = `translateY(${zone.top}px)`;
        zoneEl.style.height = `${zone.height}px`;
      }
      // Scrollable rail: keep the band (its grab zone) in view by following the
      // scroll, unless a drag is in progress (that would fight the drag mapping).
      if (rail && railContentH > railHeight && !draggingRef.current) {
        const next = railScrollForBand(
          zone.top,
          zone.height,
          railHeight,
          railContentH,
          rail.scrollTop,
          MIN_TARGET_PX,
        );
        if (Math.abs(next - rail.scrollTop) > 0.5) {
          rail.scrollTo({ top: next, behavior: "instant" });
        }
      }
    }
  }, []);

  /** rAF coalescing: scroll and resize events collapse into one trailing
   *  frame (the useThemeEpoch idiom). */
  const schedule = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(recompute);
  }, [recompute]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Observers live in ref callbacks, not mount effects (the useCollapse
  // rationale): the rail detaches whenever the collapse swaps it out, and a
  // mount-time effect would never re-observe it.
  const scrollObserverRef = useRef<ResizeObserver | null>(null);
  const scrollCleanupRef = useRef<(() => void) | null>(null);
  const setScrollNode = useCallback(
    (node: HTMLDivElement | null) => {
      scrollObserverRef.current?.disconnect();
      scrollObserverRef.current = null;
      scrollCleanupRef.current?.();
      scrollCleanupRef.current = null;
      scrollRef.current = node;
      if (node) {
        // Native passive listener (we never preventDefault a scroll), rAF-coalesced.
        node.addEventListener("scroll", schedule, { passive: true });
        scrollCleanupRef.current = () => node.removeEventListener("scroll", schedule);
        if (typeof ResizeObserver !== "undefined") {
          const observer = new ResizeObserver(schedule);
          observer.observe(node);
          scrollObserverRef.current = observer;
        }
        schedule();
      }
    },
    [schedule],
  );

  // The content wrapper gets its own observer: the scroll element's border box
  // is the viewport and does not resize when content grows (images finishing
  // loading while the user is idle would otherwise leave everything stale).
  const contentObserverRef = useRef<ResizeObserver | null>(null);
  const setContentNode = useCallback(
    (node: HTMLDivElement | null) => {
      contentObserverRef.current?.disconnect();
      contentObserverRef.current = null;
      contentRef.current = node;
      if (node && typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(schedule);
        observer.observe(node);
        contentObserverRef.current = observer;
      }
    },
    [schedule],
  );

  const railObserverRef = useRef<ResizeObserver | null>(null);
  const railWheelCleanupRef = useRef<(() => void) | null>(null);
  const setRailNode = useCallback(
    (node: HTMLDivElement | null) => {
      railObserverRef.current?.disconnect();
      railObserverRef.current = null;
      railWheelCleanupRef.current?.();
      railWheelCleanupRef.current = null;
      railRef.current = node;
      if (node) {
        // Wheel over the rail forwards to the content scroll; without this the
        // rail is a dead zone for the wheel along the content edge. Native
        // listener with `passive: false` (React attaches wheel passively at
        // the root); preventDefault only when the delta was actually consumed,
        // so scroll chaining to an outer page scroller keeps working at the
        // content's extremes.
        const onWheel = (event: WheelEvent) => {
          const scroller = scrollRef.current;
          if (!scroller) return;
          // deltaMode normalization: 1 = lines (Firefox on Linux), 2 = pages.
          const scale =
            event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroller.clientHeight : 1;
          const before = scroller.scrollTop;
          scroller.scrollTo({ top: before + event.deltaY * scale, behavior: "instant" });
          if (scroller.scrollTop !== before) event.preventDefault();
        };
        node.addEventListener("wheel", onWheel, { passive: false });
        railWheelCleanupRef.current = () => node.removeEventListener("wheel", onWheel);
        if (typeof ResizeObserver !== "undefined") {
          const observer = new ResizeObserver(schedule);
          observer.observe(node);
          railObserverRef.current = observer;
        }
        schedule();
      }
    },
    [schedule],
  );

  /** Single pointerdown owner for the rail: a press inside the grab zone
   *  starts a relative drag (preserving the grab offset); a press outside
   *  recenters the viewport on the pressed content position and continues as
   *  the same drag. One owner, no indicator/rail handler arbitration: the
   *  indicator and zone visuals are `pointer-events: none`. */
  const dragOffsetRef = useRef<number | null>(null);
  /** Pointer Y relative to the rail VIEWPORT top (not content), the input to the
   *  drag mapping and the edge auto-scroll. */
  const lastPointerYRef = useRef(0);
  const edgeRafRef = useRef(0);
  const edgeDirRef = useRef(0);

  /** Map the last pointer position (in rail-content coords) to a main-content
   *  scroll. Reused by onMove and by the edge auto-scroll loop. */
  const applyDragScroll = useCallback(() => {
    const offset = dragOffsetRef.current;
    const scroller = scrollRef.current;
    const rail = railRef.current;
    if (offset === null || !scroller || !rail) return;
    const railContentH = railContentHRef.current || rail.clientHeight;
    const pointerContentY = lastPointerYRef.current + rail.scrollTop;
    scroller.scrollTo({
      top: scrollTopForThumbTop(
        pointerContentY - offset,
        scroller.scrollHeight,
        scroller.clientHeight,
        railContentH,
      ),
      behavior: "instant",
    });
  }, []);

  const stopEdgeScroll = useCallback(() => {
    cancelAnimationFrame(edgeRafRef.current);
    edgeRafRef.current = 0;
    edgeDirRef.current = 0;
  }, []);

  /** While the drag rests against a rail edge, scroll the rail one step per
   *  frame and re-map the band, so the band (and the main content) keeps moving
   *  even though the pointer is stationary. Stops at the rail's scroll extent. */
  const edgeTick = useCallback(() => {
    const rail = railRef.current;
    const dir = edgeDirRef.current;
    if (!rail || dir === 0) {
      edgeRafRef.current = 0;
      return;
    }
    const maxRailScroll = rail.scrollHeight - rail.clientHeight;
    const next = clampNumber(rail.scrollTop + dir * EDGE_SCROLL_STEP, 0, maxRailScroll);
    rail.scrollTop = next;
    applyDragScroll();
    if ((dir > 0 && next >= maxRailScroll) || (dir < 0 && next <= 0)) {
      edgeRafRef.current = 0;
      return;
    }
    edgeRafRef.current = requestAnimationFrame(edgeTick);
  }, [applyDragScroll]);

  useEffect(() => stopEdgeScroll, [stopEdgeScroll]);

  const railDrag = usePointerDrag({
    onStart: (origin) => {
      const scroller = scrollRef.current;
      const rail = railRef.current;
      if (!scroller || !rail) return;
      // Rail-CONTENT coordinates: the band and markers are laid out in the
      // (possibly taller, scrollable) content, so add the rail's own scroll.
      const railContentH = railContentHRef.current || rail.clientHeight;
      const railRect = rail.getBoundingClientRect();
      lastPointerYRef.current = origin.y - railRect.top;
      const pressY = origin.y - railRect.top + rail.scrollTop;
      const scrollHeight = scroller.scrollHeight;
      const clientHeight = scroller.clientHeight;
      const visual = thumbGeometry(
        scroller.scrollTop,
        scrollHeight,
        clientHeight,
        railContentH,
        MIN_VISUAL_PX,
      );
      const zone = grabZone(visual, railContentH, MIN_TARGET_PX);
      if (pressY < zone.top || pressY > zone.top + zone.height) {
        scroller.scrollTo({
          top: scrollTopForRailPress(pressY, scrollHeight, clientHeight, railContentH),
          behavior: "instant",
        });
      }
      // Grab offset against the (possibly just moved) band, so the continuing
      // drag is relative either way.
      const band = thumbGeometry(
        scroller.scrollTop,
        scrollHeight,
        clientHeight,
        railContentH,
        MIN_VISUAL_PX,
      );
      dragOffsetRef.current = pressY - band.top;
      draggingRef.current = true;
      setDragging(true);
      schedule();
    },
    onMove: (delta) => {
      const rail = railRef.current;
      if (dragOffsetRef.current === null || !rail) return;
      const viewportY = delta.y - rail.getBoundingClientRect().top;
      lastPointerYRef.current = viewportY;
      applyDragScroll();
      // Edge auto-scroll (only when the rail itself scrolls): while the pointer
      // rests within a unit of the top/bottom edge, keep the rail scrolling so
      // the band can reach content beyond the visible rail.
      const railH = rail.clientHeight;
      const canScroll = rail.scrollHeight > railH + 1;
      let dir = 0;
      if (canScroll) {
        if (viewportY >= railH - MIN_TARGET_PX) dir = 1;
        else if (viewportY <= MIN_TARGET_PX) dir = -1;
      }
      edgeDirRef.current = dir;
      if (dir !== 0) {
        if (edgeRafRef.current === 0) edgeRafRef.current = requestAnimationFrame(edgeTick);
      } else {
        stopEdgeScroll();
      }
    },
    onEnd: () => {
      dragOffsetRef.current = null;
      draggingRef.current = false;
      stopEdgeScroll();
      setDragging(false);
    },
  });

  /** Keyboard scrollbar path (WAI-ARIA scrollbar: Down means toward the end).
   *  All steps scroll instantly. */
  const onIndicatorKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const clientHeight = scroller.clientHeight;
    const maxScroll = scroller.scrollHeight - clientHeight;
    let target: number;
    switch (event.key) {
      case "ArrowDown":
        target = scroller.scrollTop + KEY_STEP_PX;
        break;
      case "ArrowUp":
        target = scroller.scrollTop - KEY_STEP_PX;
        break;
      case "PageDown":
        target = scroller.scrollTop + clientHeight;
        break;
      case "PageUp":
        target = scroller.scrollTop - clientHeight;
        break;
      case "Home":
        target = 0;
        break;
      case "End":
        target = maxScroll;
        break;
      default:
        return;
    }
    event.preventDefault();
    scroller.scrollTo({
      top: Math.min(Math.max(target, 0), maxScroll),
      behavior: "instant",
    });
  }, []);

  const markerList = useMemo<MinimapMarker[]>(() => markers ?? [], [markers]);
  markerListRef.current = markerList;
  const warnedRef = useRef(false);

  const resolvedMarkers = useMemo(() => {
    const { scrollHeight, railHeight, railContentH } = sizes;
    if (scrollHeight <= 0 || railContentH <= 0) return [];
    // Scroll mode: the proportional content gaps are already visible, so skip
    // the fit-mode cosmetic trim (which would eat into the 0.5u floor).
    const scrollMode = railContentH > railHeight + 0.5;
    const maxBlockPx = maxMarkerSize ? maxMarkerSize * unitPx : Number.POSITIVE_INFINITY;
    const resolved: Array<{
      key: string;
      y: number;
      height: number;
      tone: MinimapMarker["tone"];
    }> = [];
    let dropped = 0;
    markerList.forEach((marker, index) => {
      const top = resolveMarkerTop(marker, scrollHeight);
      if (top === null) {
        dropped += 1;
        return;
      }
      const extent = resolveMarkerHeight(marker, scrollHeight);
      let railH = markerRailHeight(extent, scrollHeight, railContentH, MIN_MARKER_PX);
      // Cap a real span at maxMarkerSize (bare rules keep their floor).
      if (extent > 0 && railH > maxBlockPx) railH = maxBlockPx;
      resolved.push({
        key: marker.id ?? `sf-minimap-${index}`,
        y: markerRailY(top, scrollHeight, railContentH),
        // Trim a hair off the bottom of a real span so adjacent blocks separate;
        // leave bare rules (no extent) at their floored height.
        height: extent > 0 && !scrollMode ? Math.max(MIN_MARKER_PX, railH - MARKER_GAP_PX) : railH,
        tone: marker.tone,
      });
    });
    if (dropped > 0 && !warnedRef.current && process.env.NODE_ENV !== "production") {
      warnedRef.current = true;
      console.warn(`Minimap: ${dropped} marker(s) dropped; each marker needs top or topFraction.`);
    }
    return resolved;
  }, [markerList, sizes, unitPx, maxMarkerSize]);

  /** Header labels: one clickable, level-indented, truncated button per
   *  header marker, at the marker's rail position (centered on its rule,
   *  clamped into the rail). Colliding labels decimate deepest-level-first;
   *  the losers are not rendered at all (nothing invisible stays in the tab
   *  order), while their dither rules remain on the rail. */
  const headerLabels = useMemo(() => {
    const { scrollHeight, railContentH } = sizes;
    if (scrollHeight <= 0 || railContentH <= 0) {
      headersRef.current = [];
      return [];
    }
    const headers: Array<{
      key: string;
      marker: MinimapMarker;
      contentTop: number;
      labelTop: number;
      level: number;
    }> = [];
    markerList.forEach((marker, index) => {
      if (marker.kind !== "header" || !marker.label) return;
      const top = resolveMarkerTop(marker, scrollHeight);
      if (top === null) return;
      const y = markerRailY(top, scrollHeight, railContentH);
      // A header with a real extent is a block span: put the label at the
      // block's top, so it lines up with the block (and with the viewport band
      // when that content is scrolled to the top). A bare header rule has no
      // extent, so center the one-unit label box on the rule instead. unitPx is
      // the measured var(--sf-unit).
      const hasSpan = resolveMarkerHeight(marker, scrollHeight) > 0;
      const rawLabelTop = hasSpan ? y : y - unitPx / 2;
      headers.push({
        key: marker.id ?? `sf-minimap-h-${index}`,
        marker,
        contentTop: top,
        labelTop: clampNumber(rawLabelTop, 0, Math.max(railContentH - unitPx, 0)),
        level: clampNumber(marker.level ?? 1, 1, 6),
      });
    });
    const visible = decimateLabels(
      headers.map((h) => ({ y: h.labelTop, level: h.level })),
      unitPx,
    );
    const survivors = headers.filter((_, i) => visible[i]);
    // Active tracking runs over the survivors, so aria-current always lands
    // on a rendered label (a decimated header maps to the label above it).
    headersRef.current = survivors
      .map((h) => ({ key: h.key, top: h.contentTop }))
      .sort((a, b) => a.top - b.top);
    return survivors;
  }, [markerList, sizes, unitPx]);

  // Re-run active tracking whenever the marker set changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies(markerList): the dependency is the trigger, not an input — headersRef is derived from it during render.
  useEffect(() => {
    schedule();
  }, [schedule, markerList]);

  const jumpToMarker = useCallback(
    (marker: MinimapMarker, contentTop: number) => {
      if (onJump) {
        onJump(marker);
        return;
      }
      const scroller = scrollRef.current;
      if (!scroller) return;
      // Land the heading at the start of the viewport, or the block's MIDDLE at
      // the viewport middle when jumpAlign="center" (adding half the marker's
      // own extent; scrollTo clamps a negative top to 0). Smooth unless the user
      // asked for reduced motion ("instant", not "auto": "auto" defers to the
      // cascade and could still animate under a consumer's scroll-behavior).
      const anchorFrac = anchorFracRef.current;
      const half = anchorFrac > 0 ? resolveMarkerHeight(marker, scroller.scrollHeight) / 2 : 0;
      scroller.scrollTo({
        top: contentTop + half - scroller.clientHeight * anchorFrac,
        behavior: prefersReducedMotion() ? "instant" : "smooth",
      });
    },
    [onJump],
  );

  // Stable merged ref: an inline mergeRefs(...) would mint a new callback-ref
  // identity every render, and React would detach/reattach the scroll element
  // (tearing down the listener and ResizeObserver, spamming the consumer's
  // forwarded ref with null/node pairs) on every pct/active re-render.
  const setScrollRefs = useMemo(
    () => mergeRefs<HTMLDivElement>(setScrollNode, forwardedRef),
    [setScrollNode, forwardedRef],
  );

  const wrapperStyle =
    width !== undefined
      ? ({ ...style, "--sf-minimap-width": `calc(var(--sf-unit) * ${width})` } as CSSProperties)
      : style;

  // Scroll mode: the inner content is taller than the rail, so the rail scrolls.
  const railScrollMode = sizes.railContentH > sizes.railHeight + 0.5;

  return (
    <div
      {...rest}
      className={cx(styles.wrapper, className)}
      style={wrapperStyle}
      data-side={side === "left" ? "left" : undefined}
      data-collapsed={railVisible ? undefined : ""}
    >
      {/* tabIndex: the native scrollbar is hidden, and only Chromium/Firefox
          auto-focus scrollers (and only when no focusable child exists), so an
          explicit stop keeps the content keyboard-scrollable everywhere. */}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll region with its native scrollbar hidden must stay keyboard-scrollable; WebKit never auto-focuses scrollers. */}
      <div ref={setScrollRefs} id={scrollId} className={styles.scroll} tabIndex={0}>
        <div ref={setContentNode} className={styles.content}>
          {children}
        </div>
      </div>
      {/* The rail strip is the single pointerdown owner: the indicator visual
          and the grab zone are pointer-events: none, so no press arbitration
          exists between layers. Block markers are decorative (aria-hidden);
          the zone carries the scrollbar semantics and the keyboard path. */}
      <div
        ref={setRailNode}
        className={styles.rail}
        data-scroll={railScrollMode ? "" : undefined}
        data-dragging={dragging ? "" : undefined}
        onPointerDown={railDrag.onPointerDown}
      >
        {/* Measures the rendered var(--sf-unit) for the JS label math. */}
        <div ref={unitProbeRef} className={styles.unitProbe} aria-hidden="true" />
        {/* Inner content: the rail's own height in fit mode, taller and
            scrollable when minMarkerSize keeps blocks at their floor. Markers,
            indicator, zone and labels are positioned within it. */}
        <div className={styles.track} style={{ blockSize: sizes.railContentH || undefined }}>
          <div className={styles.markers} aria-hidden="true">
            {resolvedMarkers.map((marker) => (
              <div
                key={marker.key}
                className={styles.marker}
                data-tone={marker.tone}
                style={{ top: marker.y, height: marker.height }}
              />
            ))}
          </div>
          <div ref={thumbRef} className={styles.indicator} aria-hidden="true" />
          <div
            ref={zoneRef}
            className={styles.zone}
            role="scrollbar"
            tabIndex={0}
            aria-controls={scrollId}
            aria-orientation="vertical"
            aria-label={ariaLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            onKeyDown={onIndicatorKeyDown}
            onPointerDown={(event) => {
              // The zone sits above the labels: grabbing the focus marker wins
              // wherever the band covers a label (the label is clickable again
              // once the band moves away). Forward to the rail drag handler,
              // whose zone hit-test resolves this press to a relative drag.
              event.stopPropagation();
              railDrag.onPointerDown(event);
            }}
          />
          {/* Labels stack topmost; pointerdown stops propagation so a label
            press never starts a rail jump or drag, it only clicks. */}
          {headerLabels.map((h) => (
            <button
              key={h.key}
              type="button"
              className={styles.label}
              data-tone={h.marker.tone}
              data-emphasis={h.marker.emphasis ? "" : undefined}
              style={{
                top: h.labelTop,
                // Level indent as position, not padding, so the caption's pill
                // stays tight to its text at every depth. The base `--sf-unit / 4`
                // matches the block markers' inline inset, so a label's text
                // aligns with the left edge of the dither blocks; each level adds a
                // half-unit.
                insetInlineStart: `calc(var(--sf-unit) / 4 + ${h.level - 1} * var(--sf-unit) / 4)`,
              }}
              aria-current={activeKey === h.key ? "true" : undefined}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => jumpToMarker(h.marker, h.contentTop)}
            >
              {h.marker.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
