/** Zoom/pan viewport for the 2D charts (issue #27).
 *
 *  The whole viewport state is one x-domain `[number, number]` (dates as
 *  epoch ms) — a zoomed chart is the same chart rendered with a narrower
 *  domain, so scales, ticks, gridlines and downsampling all just recompute.
 *  No transform matrix, no camera. The finance-chart gesture convention:
 *
 *    drag        pan (starts after a small threshold so point clicks survive)
 *    wheel       zoom anchored at the cursor — plain wheel only after the
 *                chart has been clicked ("armed"), so pages keep scrolling;
 *                ctrl/⌘+wheel (incl. trackpad pinch) always zooms
 *    2-pointer   pinch zoom
 *    dblclick    reset to the full extent
 *    keyboard    ←/→ pan 10% (Shift: 50%), +/- zoom about center,
 *                0/Home reset — on the focusable chart root
 *
 *  No inertia, no tween: the domain changes instantly (reduced-motion posture;
 *  also the cheapest thing to render). Wheel/pointer listeners are attached
 *  natively because React registers `wheel` as passive (preventDefault would
 *  be ignored) — mounted once, reading live state through a ref.
 */

import type { KeyboardEvent, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type Domain = [number, number];

/** Clamp a candidate domain to the data extent and minimum span: the span
 *  caps at the extent (zoom-out floor) and floors at `minSpan` (zoom-in
 *  ceiling); panning past an edge shifts the window back inside. */
export function clampDomain(candidate: Domain, extent: Domain, minSpan: number): Domain {
  const [e0, e1] = extent;
  const extentSpan = e1 - e0;
  let span = candidate[1] - candidate[0];
  span = Math.min(Math.max(span, Math.min(minSpan, extentSpan)), extentSpan);
  let d0 = candidate[0];
  if (d0 < e0) d0 = e0;
  if (d0 + span > e1) d0 = e1 - span;
  return [d0, d0 + span];
}

/** Shrink/grow a domain by `factor` (>1 zooms in) holding the value at
 *  `anchor01` (0..1 fraction across the plot) fixed under the cursor. */
export function zoomDomain(domain: Domain, anchor01: number, factor: number): Domain {
  const span = domain[1] - domain[0];
  const anchorValue = domain[0] + anchor01 * span;
  const newSpan = span / factor;
  const d0 = anchorValue - anchor01 * newSpan;
  return [d0, d0 + newSpan];
}

/** Wheel delta → pixels across browsers (Firefox reports lines/pages). */
function wheelDeltaPx(e: WheelEvent): number {
  return e.deltaY * (e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? 400 : 1);
}

/** Pixels of drag before a pointerdown becomes a pan instead of a click —
 *  keeps point hover/activate working on zoomable charts. */
const PAN_THRESHOLD_PX = 3;

export interface UseViewportOptions {
  /** Full data extent (numbers; dates as epoch ms). */
  extent: Domain;
  /** Controlled visible domain; `null`/omitted = full extent (uncontrolled
   *  state takes over after the first gesture). */
  domain?: Domain | null;
  /** Fires on every viewport change; `null` = reset to the full extent. */
  onDomainChange?: (domain: Domain | null) => void;
  /** Smallest visible span (zoom-in ceiling), e.g. ~4 data points. */
  minSpan: number;
  /** The plot element that owns the gestures. */
  plotRef: RefObject<HTMLElement | null>;
  /** When false the hook is inert (no listeners, full extent). */
  enabled: boolean;
  /** While true, pointer pan/pinch and dblclick-reset are ignored (an
   *  annotation tool is armed and owns the pointer) — wheel zoom and
   *  keyboard stay live. The hook deliberately knows nothing else about
   *  annotation tools. */
  suspended?: boolean;
  /** Formats a domain value for the aria-live range announcement. */
  formatValue: (value: number) => string;
  /** Which screen axis the domain maps to. `"x"` (default) is the horizontal
   *  finance-chart posture; `"y"` windows a vertical *value* axis instead —
   *  gestures read the cursor's vertical position and the value grows upward
   *  (the SVG px axis is inverted), so wheel/drag/marquee all run top-to-bottom.
   *  The domain semantics are identical; only the pixel mapping flips. */
  axis?: "x" | "y";
}

export interface Viewport {
  /** The resolved visible domain — feed this to the scales. */
  domain: Domain;
  isZoomed: boolean;
  reset: () => void;
  /** Step zoom about the center (factor 2) — for toolbar buttons. */
  zoomIn: () => void;
  zoomOut: () => void;
  /** Marquee ("zoom to region") mode: while armed, dragging on the plot
   *  selects a band instead of panning; releasing applies it as the new
   *  visible window and disarms (one gesture per arming, like the annotation
   *  tools). Escape cancels/disarms. */
  marqueeArmed: boolean;
  setMarqueeArmed: (armed: boolean) => void;
  /** In-flight selection as 0..1 plot-width fractions, or null — the chart
   *  renders this as a full-height band. */
  marquee: [number, number] | null;
  /** Spread onto the chart root: makes it focusable and keyboard-navigable. */
  rootProps: {
    tabIndex: number;
    onKeyDown: (e: KeyboardEvent) => void;
    "aria-keyshortcuts": string;
  };
  /** Latest human-readable range for an aria-live region ("" until the first
   *  gesture). */
  announcement: string;
}

export function useViewport({
  extent,
  domain: controlledDomain,
  onDomainChange,
  minSpan,
  plotRef,
  enabled,
  suspended = false,
  formatValue,
  axis = "x",
}: UseViewportOptions): Viewport {
  const [uncontrolled, setUncontrolled] = useState<Domain | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [marqueeArmed, setMarqueeArmed] = useState(false);
  const [marquee, setMarquee] = useState<[number, number] | null>(null);

  const raw = controlledDomain !== undefined ? controlledDomain : uncontrolled;
  const domain = useMemo<Domain>(
    () => (raw && enabled ? clampDomain(raw, extent, minSpan) : extent),
    [raw, enabled, extent, minSpan],
  );
  const isZoomed = enabled && (domain[0] !== extent[0] || domain[1] !== extent[1]);

  // Live values for the natively-attached listeners (mounted once below).
  const extentRef = useRef({ extent, minSpan });
  extentRef.current = { extent, minSpan };
  const domainRef = useRef(domain);
  domainRef.current = domain;
  const onDomainChangeRef = useRef(onDomainChange);
  onDomainChangeRef.current = onDomainChange;
  const formatValueRef = useRef(formatValue);
  formatValueRef.current = formatValue;
  const suspendedRef = useRef(suspended);
  suspendedRef.current = suspended;
  const marqueeArmedRef = useRef(marqueeArmed);
  marqueeArmedRef.current = marqueeArmed;

  const apply = useCallback((next: Domain | null) => {
    const { extent: fullExtent, minSpan: span } = extentRef.current;
    const clamped = next ? clampDomain(next, fullExtent, span) : null;
    // A zoom-out that lands exactly on the full extent is a reset.
    const isFull = clamped && clamped[0] === fullExtent[0] && clamped[1] === fullExtent[1];
    const result = isFull ? null : clamped;
    setUncontrolled(result);
    onDomainChangeRef.current?.(result);
    setAnnouncement(
      result
        ? `Showing ${formatValueRef.current(result[0])} to ${formatValueRef.current(result[1])}`
        : "Showing full range",
    );
  }, []);

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !enabled) return;

    /** Plain wheel zooms only once the user has engaged the chart — otherwise
     *  a chart in an article would hijack page scrolling. */
    let armed = false;
    const pointers = new Map<number, { x: number; y: number }>();
    let drag: { startClient: number; startDomain: Domain; panning: boolean } | null = null;
    let pinchDist = 0;
    let suppressClick = false;
    /** In-flight marquee: start fraction + px, or null. */
    let marqueeDrag: { start: number; startPx: number } | null = null;

    /** The gesture coordinate on the active axis. */
    const axisClient = (e: { clientX: number; clientY: number }) =>
      axis === "x" ? e.clientX : e.clientY;
    /** Cursor position as a 0..1 fraction across the domain (0 = d0). For the
     *  y axis the pixel direction is inverted (plot top = domain max), so the
     *  fraction is flipped — a value grows as the cursor moves up. */
    const fraction = (client: number) => {
      const rect = el.getBoundingClientRect();
      const size = axis === "x" ? rect.width : rect.height;
      const start = axis === "x" ? rect.left : rect.top;
      if (size <= 0) return 0.5;
      const f = (client - start) / size;
      return axis === "x" ? f : 1 - f;
    };
    const clamp01 = (f: number) => Math.min(1, Math.max(0, f));

    const onWheel = (e: WheelEvent) => {
      // An armed marquee owns the next gesture entirely — residual trackpad
      // scroll must not zoom underneath the user before they can drag.
      if (marqueeArmedRef.current) return;
      const pinch = e.ctrlKey || e.metaKey;
      if (!armed && !pinch) return;
      e.preventDefault();
      const delta = wheelDeltaPx(e) * (pinch ? 0.01 : 0.002);
      apply(zoomDomain(domainRef.current, fraction(axisClient(e)), 2 ** -delta));
    };

    /** Annotation elements own their pointerdowns (select/drag in the
     *  editor) — a pan must never start from one. */
    const onAnnotation = (e: Event) =>
      e.target instanceof Element && e.target.closest("[data-annotation]") != null;

    const onPointerDown = (e: PointerEvent) => {
      armed = true;
      if (suspendedRef.current || onAnnotation(e)) return;
      if (e.button !== 0) return;
      if (marqueeArmedRef.current) {
        // Only the plot background starts a selection — a press on the
        // overlaid toolbar (arming/disarming clicks) must not.
        if (e.target instanceof Element && e.target.closest("button,[role='toolbar']")) return;
        marqueeDrag = { start: clamp01(fraction(axisClient(e))), startPx: axisClient(e) };
        setMarquee(null);
        el.setPointerCapture(e.pointerId);
        return;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        if (a && b) pinchDist = Math.hypot(b.x - a.x, b.y - a.y);
        drag = null;
      } else if (pointers.size === 1) {
        drag = { startClient: axisClient(e), startDomain: domainRef.current, panning: false };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (marqueeDrag) {
        setMarquee([marqueeDrag.start, clamp01(fraction(axisClient(e)))]);
        return;
      }
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        if (!a || !b || pinchDist === 0) return;
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (dist > 0) {
          const mid = axis === "x" ? (a.x + b.x) / 2 : (a.y + b.y) / 2;
          apply(zoomDomain(domainRef.current, fraction(mid), dist / pinchDist));
          pinchDist = dist;
        }
        return;
      }

      if (!drag) return;
      const delta = axisClient(e) - drag.startClient;
      if (!drag.panning) {
        if (Math.abs(delta) < PAN_THRESHOLD_PX) return;
        drag.panning = true;
        el.setPointerCapture(e.pointerId);
      }
      const rect = el.getBoundingClientRect();
      const size = axis === "x" ? rect.width : rect.height;
      if (size <= 0) return;
      const span = drag.startDomain[1] - drag.startDomain[0];
      // x: content follows the cursor (drag right → earlier data shifts in).
      // y: the pixel axis is inverted, so dragging down reveals higher values.
      const shift = ((axis === "x" ? -delta : delta) / size) * span;
      apply([drag.startDomain[0] + shift, drag.startDomain[1] + shift]);
    };

    const onPointerEnd = (e: PointerEvent) => {
      if (marqueeDrag) {
        // pointercancel carries no meaningful coordinates (clientX ≈ 0) —
        // applying from it would zoom to a bogus region instantly.
        if (e.type === "pointercancel") {
          marqueeDrag = null;
          setMarquee(null);
          return;
        }
        const from = marqueeDrag.start;
        const to = clamp01(fraction(axisClient(e)));
        // Ignore sub-threshold drags (a stray click must not zoom into
        // nothing); the mode stays armed for a retry.
        if (Math.abs(axisClient(e) - marqueeDrag.startPx) >= 8) {
          const [d0, d1] = domainRef.current;
          const span = d1 - d0;
          const lo = Math.min(from, to);
          const hi = Math.max(from, to);
          apply([d0 + lo * span, d0 + hi * span]);
          setMarqueeArmed(false);
          suppressClick = true;
        }
        marqueeDrag = null;
        setMarquee(null);
        return;
      }
      pointers.delete(e.pointerId);
      pinchDist = 0;
      if (drag?.panning) suppressClick = true;
      if (pointers.size === 0) drag = null;
    };

    /** A drag that panned must not also activate the point it started on. */
    const onClickCapture = (e: MouseEvent) => {
      if (suppressClick) {
        suppressClick = false;
        e.stopPropagation();
        e.preventDefault();
      }
    };

    const onPointerLeave = () => {
      if (pointers.size === 0) armed = false;
    };

    const onDblClick = (e: MouseEvent) => {
      // Impatient repeat-clicks while aiming a marquee must not reset.
      if (suspendedRef.current || marqueeArmedRef.current || onAnnotation(e)) return;
      e.preventDefault();
      apply(null);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerEnd);
    el.addEventListener("pointercancel", onPointerEnd);
    el.addEventListener("pointerleave", onPointerLeave);
    el.addEventListener("dblclick", onDblClick);
    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerEnd);
      el.removeEventListener("pointercancel", onPointerEnd);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("dblclick", onDblClick);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [enabled, plotRef, apply, axis]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      const [d0, d1] = domainRef.current;
      const span = d1 - d0;
      const panStep = span * (e.shiftKey ? 0.5 : 0.1);
      // On the value (y) axis Up/Down pan the domain (up = higher values); on
      // the x axis Left/Right do. The off-axis pair is ignored so it can scroll
      // or move focus normally.
      const panDown = axis === "y" ? "ArrowDown" : "ArrowLeft";
      const panUp = axis === "y" ? "ArrowUp" : "ArrowRight";
      switch (e.key) {
        case panDown:
          apply([d0 - panStep, d1 - panStep]);
          break;
        case panUp:
          apply([d0 + panStep, d1 + panStep]);
          break;
        case "+":
        case "=":
          apply(zoomDomain(domainRef.current, 0.5, 2));
          break;
        case "-":
        case "_":
          apply(zoomDomain(domainRef.current, 0.5, 0.5));
          break;
        case "0":
        case "Home":
          apply(null);
          break;
        case "Escape":
          if (!marqueeArmedRef.current) return;
          setMarqueeArmed(false);
          setMarquee(null);
          // Don't let a fullscreen chart also exit on the same keypress.
          e.stopPropagation();
          break;
        default:
          return;
      }
      e.preventDefault();
    },
    [enabled, apply, axis],
  );

  const reset = useCallback(() => apply(null), [apply]);
  const zoomIn = useCallback(() => apply(zoomDomain(domainRef.current, 0.5, 2)), [apply]);
  const zoomOut = useCallback(() => apply(zoomDomain(domainRef.current, 0.5, 0.5)), [apply]);

  return {
    domain,
    isZoomed,
    reset,
    zoomIn,
    zoomOut,
    marqueeArmed: enabled && marqueeArmed,
    setMarqueeArmed,
    marquee: enabled && marqueeArmed ? marquee : null,
    rootProps: {
      tabIndex: 0,
      onKeyDown,
      "aria-keyshortcuts": axis === "y" ? "ArrowUp ArrowDown + - 0" : "ArrowLeft ArrowRight + - 0",
    },
    announcement,
  };
}
