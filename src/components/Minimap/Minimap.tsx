import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cx } from "../../lib/cx";
import { mergeRefs } from "../../lib/mergeRefs";
import { prefersReducedMotion } from "../../lib/prefersReducedMotion";
import { usePointerDrag } from "../../lib/usePointerDrag";
import type { MinimapMarker, MinimapMarkerKind } from "./geometry";
import {
  bandTopForViewTop,
  buildRailMap,
  decimateLabels,
  grabZone,
  mappedMarkerHeight,
  mappedScrollTopForRailPress,
  mappedScrollTopForThumbTop,
  mappedThumbGeometry,
  type RailMap,
  railContentHeight,
  railScrollForProgress,
  railVisibleNext,
  resolveMarkerHeight,
  resolveMarkerTop,
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

/** Arrow-key scroll step: one unit, roughly a text line. */
const KEY_STEP_PX = 24;

/** Active-heading threshold: a label click lands its heading exactly at the
 *  top, so the heading with `top <= scrollTop + epsilon` must include it. */
const ACTIVE_EPSILON_PX = 2;

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** The extent-bearing markers as content spans, for the rail map. */
function spansOf(
  markers: readonly MinimapMarker[],
  scrollHeight: number,
): { top: number; extent: number }[] {
  const spans: { top: number; extent: number }[] = [];
  for (const marker of markers) {
    const top = resolveMarkerTop(marker, scrollHeight);
    const extent = resolveMarkerHeight(marker, scrollHeight);
    if (top !== null && extent > 0) spans.push({ top, extent });
  }
  return spans;
}

export interface MinimapProps extends HTMLAttributes<HTMLDivElement> {
  /** Structural markers in content coordinates: `block` spans (dither rules)
   *  and `header` markers. You always supply these as data, so virtualized
   *  hosts work by re-supplying the array whenever their measurements change. */
  markers?: MinimapMarker[];
  /** Which edge the rail occupies. The DOM order (content, then rail) is fixed
   *  regardless, so the tab order is stable. Default `"right"`. */
  side?: "left" | "right";
  /** Rail width in `--sf-unit` multiples; defaults to `--sf-minimap-width` (4u). */
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
   *  itself scrolls (in step with the content, like an editor minimap). With
   *  `stretch={false}` it is the rail's scale as much as its floor. Unset (default) keeps the
   *  fit-everything proportional overview. */
  minMarkerSize?: number;
  /** Stretch the markers to fill the rail. On by default: a rail is a map of
   *  the whole document, so its picture spans its height whatever there is to
   *  show. Off (with `minMarkerSize`, which then sets the scale), the markers
   *  keep that size and accumulate from the top, leaving the rail empty below
   *  until the content grows into it and then past it, where the rail scrolls
   *  as it does in min-block mode.
   *
   *  Reach for it when the markers **tile** the content and it grows, like a
   *  conversation, where a few blocks blown up to the rail's full height say
   *  nothing about how much there is. Leave it on when they annotate parts of a
   *  fixed document (the picture would collapse to a sliver of the rail) or
   *  when the rail is an index of names (a smaller picture collides their pills,
   *  so the rail thins them out). */
  stretch?: boolean;
  /** Maximum block-marker height in `--sf-unit` multiples. Caps how tall any one
   *  block renders (a sparse document otherwise gives a few very tall blocks);
   *  the capped block leaves a gap after it rather than overlapping, while every
   *  other marker keeps its proportional size and position (the cap is per
   *  block, never a rescale of the whole rail). Unset = no cap. */
  maxMarkerSize?: number;
  /** Where a label-click jump lands the target in the viewport: `"start"`
   *  (default, at the top) or `"center"` (in the middle). Also anchors which
   *  header reads as active. */
  jumpAlign?: "start" | "center";
  /** Attributes merged onto the scroll element. The component owns that
   *  element, but the semantics of the scrolling region belong to the host: a
   *  chat transcript is a `role="log"`, a document body carries its own label,
   *  and a test needs a handle on the thing that actually scrolls. An
   *  `onScroll` here is the host's; the component listens on its own. The
   *  component's ref, id, class and tabIndex always win. */
  scrollProps?: HTMLAttributes<HTMLDivElement>;
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
    stretch = true,
    maxMarkerSize,
    jumpAlign = "start",
    scrollProps,
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
  const [dragging, setDragging] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  /** The rendered value of var(--sf-unit) in px (label line-height, indent
   *  step), measured through the probe below; 24 only until measured. */
  const [unitPx, setUnitPx] = useState(MIN_TARGET_PX);
  const unitProbeRef = useRef<HTMLDivElement>(null);
  /** The label pill's rendered height (the CSS `--sf-minimap-label-size` plus
   *  its 2px of leading), measured through its own probe. Label decimation
   *  keeps labels this far apart, not a whole unit, so every block that has
   *  room for its pill keeps its label and the rail names what the screen
   *  shows; 14 only until measured. */
  const [labelPx, setLabelPx] = useState(14);
  const labelProbeRef = useRef<HTMLDivElement>(null);
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
  const stretchRef = useRef(true);
  const minMarkerSizeRef = useRef<number | undefined>(undefined);
  const maxMarkerSizeRef = useRef<number | undefined>(undefined);
  const unitPxRef = useRef(MIN_TARGET_PX);
  /** Fraction of the viewport a jump lands the target at (and the active-heading
   *  anchor): 0 = top, 0.5 = center. */
  const anchorFracRef = useRef(0);
  minMarkerSizeRef.current = minMarkerSize;
  stretchRef.current = stretch;
  maxMarkerSizeRef.current = maxMarkerSize;
  unitPxRef.current = unitPx;
  anchorFracRef.current = jumpAlign === "center" ? 0.5 : 0;

  /** The rail's geometry for a content height and rail height: the effective
   *  rail content height (the rail's own height in fit mode; grown so the
   *  smallest span reaches `minMarkerSize` in the dense, scrolling mode) and
   *  the content-to-rail map over it. `maxMarkerSize` is not a whole-rail
   *  scale: the map compresses each outsized block to the cap in place and
   *  moves what follows up, so one outsized block never bunches the other
   *  markers and never leaves a hole behind it.
   *
   *  Built from the live sizes (a scroller's scrollHeight changes without the
   *  scroller itself resizing) and kept until one of its inputs changes: the
   *  per-frame scroll path and the pointer handlers then share one map
   *  instead of rebuilding (and re-sorting the spans) on every frame. */
  const geometryCacheRef = useRef<{
    markers: MinimapMarker[];
    scrollHeight: number;
    railHeight: number;
    unit: number;
    minMarker: number | undefined;
    maxMarker: number | undefined;
    stretch: boolean;
    railContentH: number;
    map: RailMap;
  } | null>(null);
  const railGeometry = useCallback((scrollHeight: number, railHeight: number, unit: number) => {
    const markers = markerListRef.current;
    const minMarker = minMarkerSizeRef.current;
    const maxMarker = maxMarkerSizeRef.current;
    const stretch = stretchRef.current;
    const cached = geometryCacheRef.current;
    if (
      cached &&
      cached.markers === markers &&
      cached.scrollHeight === scrollHeight &&
      cached.railHeight === railHeight &&
      cached.unit === unit &&
      cached.minMarker === minMarker &&
      cached.maxMarker === maxMarker &&
      cached.stretch === stretch
    ) {
      return cached;
    }
    const maxPx = (maxMarker ?? 0) * unit;
    const spanList = spansOf(markers, scrollHeight);
    let railContentH = railHeight;
    if (minMarker && scrollHeight > 0 && railHeight > 0) {
      const natural = buildRailMap(spanList, scrollHeight, railHeight, maxPx);
      const spans = spanList.map((s) => natural.toRail(s.top + s.extent) - natural.toRail(s.top));
      railContentH = railContentHeight(
        spans,
        railHeight,
        minMarker * unit,
        MAX_RAIL_SCALE,
        stretch ? 1 : 0,
      );
    }
    const next = {
      markers,
      scrollHeight,
      railHeight,
      unit,
      minMarker,
      maxMarker,
      stretch,
      railContentH,
      map: buildRailMap(spanList, scrollHeight, railContentH, maxPx),
    };
    geometryCacheRef.current = next;
    return next;
  }, []);

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
    // Read before any style write below, so the frame has no forced layout.
    const railScrollNow = rail?.scrollTop ?? 0;
    // The label metrics live in CSS as var(--sf-unit); measure the rendered
    // value through the probe instead of assuming 24px, so a non-16px root
    // font (or a retuned unit) cannot desynchronize the JS label math from
    // the CSS label boxes.
    const probe = unitProbeRef.current;
    const unit = probe && probe.offsetHeight > 0 ? probe.offsetHeight : MIN_TARGET_PX;
    if (probe && probe.offsetHeight > 0) {
      setUnitPx((prev) => (prev === unit ? prev : unit));
    }
    const labelProbe = labelProbeRef.current;
    if (labelProbe && labelProbe.offsetHeight > 0) {
      const label = labelProbe.offsetHeight;
      setLabelPx((prev) => (prev === label ? prev : label));
    }

    const { railContentH, map: railMap } = railGeometry(scrollHeight, railHeight, unit);

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
      const visual = mappedThumbGeometry(railMap, scroller.scrollTop, clientHeight, MIN_VISUAL_PX);
      thumb.style.transform = `translateY(${visual.top}px)`;
      thumb.style.height = `${visual.height}px`;
      const zone = grabZone(visual, railContentH, MIN_TARGET_PX);
      const zoneEl = zoneRef.current;
      if (zoneEl) {
        zoneEl.style.transform = `translateY(${zone.top}px)`;
        zoneEl.style.height = `${zone.height}px`;
        // The scrollbar's value, written straight to the element: as state it
        // re-rendered every marker and label once per percent scrolled.
        const pct = maxScroll > 0 ? Math.round((scroller.scrollTop / maxScroll) * 100) : 0;
        zoneEl.setAttribute("aria-valuenow", String(pct));
      }
      // Scrollable rail: its scroll is the band's progress through the rail
      // content (see railScrollForProgress), during a drag too, since the
      // drag mapping is the inverse of the same rule.
      if (rail && railContentH > railHeight) {
        const bandTopMax = mappedThumbGeometry(
          railMap,
          Math.max(maxScroll, 0),
          clientHeight,
          MIN_VISUAL_PX,
        ).top;
        const next = railScrollForProgress(
          visual.top,
          visual.height,
          bandTopMax,
          railHeight,
          railContentH,
        );
        if (Math.abs(next - railScrollNow) > 0.5) rail.scrollTop = next;
      }
    }
  }, [railGeometry]);

  /** rAF coalescing: scroll and resize events collapse into one trailing
   *  frame (the useThemeEpoch idiom). */
  const schedule = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(recompute);
  }, [recompute]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Measure before the first paint, and again in the same commit once the
  // rail has appeared (a collapsed rail has no height to measure). Left to
  // the first animation frame, the content painted at full width and then
  // reflowed as the rail came in beside it, with the band and markers a
  // further frame behind.
  // biome-ignore lint/correctness/useExhaustiveDependencies(railVisible): the dependency is the trigger: the rail's box exists only once it is visible.
  useLayoutEffect(() => {
    recompute();
  }, [recompute, railVisible]);

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
   *  indicator and zone visuals are `pointer-events: none`.
   *
   *  The drag works in the rail's VIEWPORT coordinates: the band keeps the
   *  grab offset under the pointer and travels the visible rail from top to
   *  bottom as the content goes from start to end. A scrolling rail follows by
   *  the same rule the scroll path uses (railScrollForProgress), so the
   *  pointer never has to push against an edge to reach the rest. */
  const dragOffsetRef = useRef<number | null>(null);
  /** Pointer Y relative to the rail viewport top. */
  const lastPointerYRef = useRef(0);

  /** Map the last pointer position to a main-content scroll. */
  const applyDragScroll = useCallback(() => {
    const offset = dragOffsetRef.current;
    const scroller = scrollRef.current;
    const rail = railRef.current;
    if (offset === null || !scroller || !rail) return;
    const railH = rail.clientHeight;
    const clientHeight = scroller.clientHeight;
    const { railContentH, map } = railGeometry(scroller.scrollHeight, railH, unitPxRef.current);
    const maxScroll = Math.max(map.scrollHeight - clientHeight, 0);
    const bandTopMax = mappedThumbGeometry(map, maxScroll, clientHeight, MIN_VISUAL_PX).top;
    const bandH = mappedThumbGeometry(map, scroller.scrollTop, clientHeight, MIN_VISUAL_PX).height;
    // The band never renders past the visible rail's edges.
    const viewTop = clampNumber(lastPointerYRef.current - offset, 0, Math.max(railH - bandH, 0));
    const bandTop = bandTopForViewTop(viewTop, bandTopMax, railH, railContentH);
    scroller.scrollTo({
      top: mappedScrollTopForThumbTop(map, bandTop, clientHeight),
      behavior: "instant",
    });
  }, [railGeometry]);

  const railDrag = usePointerDrag({
    onStart: (origin) => {
      const scroller = scrollRef.current;
      const rail = railRef.current;
      if (!scroller || !rail) return;
      const railH = rail.clientHeight;
      const clientHeight = scroller.clientHeight;
      const { railContentH, map } = railGeometry(scroller.scrollHeight, railH, unitPxRef.current);
      const pointerY = origin.y - rail.getBoundingClientRect().top;
      lastPointerYRef.current = pointerY;
      // The band, the zone and the markers are laid out in the rail CONTENT
      // (taller than the rail when it scrolls), so add the rail's own scroll.
      const pressY = pointerY + rail.scrollTop;
      const visual = mappedThumbGeometry(map, scroller.scrollTop, clientHeight, MIN_VISUAL_PX);
      const zone = grabZone(visual, railContentH, MIN_TARGET_PX);
      let bandViewTop = visual.top - rail.scrollTop;
      if (pressY < zone.top || pressY > zone.top + zone.height) {
        scroller.scrollTo({
          top: mappedScrollTopForRailPress(map, pressY, clientHeight),
          behavior: "instant",
        });
        // Where the band will render once the rail has followed the jump.
        const band = mappedThumbGeometry(map, scroller.scrollTop, clientHeight, MIN_VISUAL_PX);
        const maxScroll = Math.max(map.scrollHeight - clientHeight, 0);
        const bandTopMax = mappedThumbGeometry(map, maxScroll, clientHeight, MIN_VISUAL_PX).top;
        bandViewTop =
          band.top - railScrollForProgress(band.top, band.height, bandTopMax, railH, railContentH);
      }
      // Grab offset against the (possibly just moved) band, so the continuing
      // drag is relative either way.
      dragOffsetRef.current = pointerY - bandViewTop;
      setDragging(true);
      schedule();
    },
    onMove: (delta) => {
      const rail = railRef.current;
      if (dragOffsetRef.current === null || !rail) return;
      lastPointerYRef.current = delta.y - rail.getBoundingClientRect().top;
      applyDragScroll();
    },
    onEnd: () => {
      dragOffsetRef.current = null;
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

  /** The render-side content-to-rail map (the same construction as the
   *  measure's), for marker geometry and label placement. */
  const railMap = useMemo(() => {
    const { scrollHeight, railContentH } = sizes;
    return buildRailMap(
      spansOf(markerList, scrollHeight),
      scrollHeight,
      railContentH,
      (maxMarkerSize ?? 0) * unitPx,
    );
  }, [markerList, sizes, maxMarkerSize, unitPx]);

  const resolvedMarkers = useMemo(() => {
    const { scrollHeight, railHeight, railContentH } = sizes;
    if (scrollHeight <= 0 || railContentH <= 0) return [];
    // Scroll mode: the proportional content gaps are already visible, so skip
    // the fit-mode cosmetic trim (which would eat into the 0.5u floor).
    const scrollMode = railContentH > railHeight + 0.5;
    const resolved: Array<{
      key: string;
      y: number;
      height: number;
      tone: MinimapMarker["tone"];
      kind: MinimapMarkerKind;
    }> = [];
    let dropped = 0;
    // Per-block cap (maxMarkerSize): through the rail map, the capped block is
    // exactly the cap and what follows it moves up; nothing else is compressed.
    markerList.forEach((marker, index) => {
      const top = resolveMarkerTop(marker, scrollHeight);
      if (top === null) {
        dropped += 1;
        return;
      }
      const extent = resolveMarkerHeight(marker, scrollHeight);
      const railH = mappedMarkerHeight(railMap, top, extent, MIN_MARKER_PX);
      resolved.push({
        key: marker.id ?? `sf-minimap-${index}`,
        y: railMap.toRail(top),
        // Trim a hair off the bottom of a real span so adjacent blocks separate;
        // leave bare rules (no extent) at their floored height.
        height: extent > 0 && !scrollMode ? Math.max(MIN_MARKER_PX, railH - MARKER_GAP_PX) : railH,
        tone: marker.tone,
        kind: marker.kind ?? "block",
      });
    });
    if (dropped > 0 && !warnedRef.current && process.env.NODE_ENV !== "production") {
      warnedRef.current = true;
      console.warn(`Minimap: ${dropped} marker(s) dropped; each marker needs top or topFraction.`);
    }
    return resolved;
  }, [markerList, sizes, railMap]);

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
      const y = railMap.toRail(top);
      // A header with a real extent is a block span: put the label pill at the
      // span's top, so it lines up with what it names on screen (VerticalForm
      // anchors a field's header at its caption, so the pill sits where the
      // caption sits in the viewport band). A bare header rule has no extent,
      // so center the pill on the rule instead. labelPx is the pill's measured
      // height.
      const hasSpan = resolveMarkerHeight(marker, scrollHeight) > 0;
      const rawLabelTop = hasSpan ? y : y - labelPx / 2;
      headers.push({
        key: marker.id ?? `sf-minimap-h-${index}`,
        marker,
        contentTop: top,
        labelTop: clampNumber(rawLabelTop, 0, Math.max(railContentH - labelPx, 0)),
        level: clampNumber(marker.level ?? 1, 1, 6),
      });
    });
    // Labels collide when their pills would touch: the pill height plus a
    // hair, not a whole unit, so a dense rail keeps as many names as fit.
    const visible = decimateLabels(
      headers.map((h) => ({ y: h.labelTop, level: h.level })),
      labelPx + 2,
    );
    const survivors = headers.filter((_, i) => visible[i]);
    // Active tracking runs over the survivors, so aria-current always lands
    // on a rendered label (a decimated header maps to the label above it).
    headersRef.current = survivors
      .map((h) => ({ key: h.key, top: h.contentTop }))
      .sort((a, b) => a.top - b.top);
    return survivors;
  }, [markerList, sizes, labelPx, railMap]);

  // Re-measure whenever the marker set changes, before paint: the markers feed
  // the rail's content height (the dense, scrolling mode) and the active
  // heading, and a frame's delay showed as the rail resizing after its
  // markers had already drawn.
  // biome-ignore lint/correctness/useExhaustiveDependencies(markerList): the dependency is the trigger, not an input: headersRef is derived from it during render.
  useLayoutEffect(() => {
    recompute();
  }, [recompute, markerList]);

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
      <div
        {...scrollProps}
        ref={setScrollRefs}
        id={scrollId}
        className={cx(styles.scroll, scrollProps?.className)}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll region with its native scrollbar hidden must stay keyboard-scrollable; WebKit never auto-focuses scrollers.
        tabIndex={0}
      >
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
        <div ref={labelProbeRef} className={styles.labelProbe} aria-hidden="true" />
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
                data-kind={marker.kind}
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
            aria-valuenow={0}
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
              style={
                {
                  top: h.labelTop,
                  // Level indent as position, not padding, so the caption's pill
                  // stays tight to its text at every depth. The stylesheet adds
                  // it to the block markers' own inset, so a label's text aligns
                  // with the left edge of the dither blocks and its cap moves in
                  // with it.
                  "--sf-minimap-label-indent": `calc(${h.level - 1} * var(--sf-unit) / 4)`,
                } as CSSProperties
              }
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
