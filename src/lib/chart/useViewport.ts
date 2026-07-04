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
  /** Formats a domain value for the aria-live range announcement. */
  formatValue: (value: number) => string;
}

export interface Viewport {
  /** The resolved visible domain — feed this to the scales. */
  domain: Domain;
  isZoomed: boolean;
  reset: () => void;
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
  formatValue,
}: UseViewportOptions): Viewport {
  const [uncontrolled, setUncontrolled] = useState<Domain | null>(null);
  const [announcement, setAnnouncement] = useState("");

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
    let drag: { startX: number; startDomain: Domain; panning: boolean } | null = null;
    let pinchDist = 0;
    let suppressClick = false;

    const fraction = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
    };

    const onWheel = (e: WheelEvent) => {
      const pinch = e.ctrlKey || e.metaKey;
      if (!armed && !pinch) return;
      e.preventDefault();
      const delta = wheelDeltaPx(e) * (pinch ? 0.01 : 0.002);
      apply(zoomDomain(domainRef.current, fraction(e.clientX), 2 ** -delta));
    };

    const onPointerDown = (e: PointerEvent) => {
      armed = true;
      if (e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        if (a && b) pinchDist = Math.hypot(b.x - a.x, b.y - a.y);
        drag = null;
      } else if (pointers.size === 1) {
        drag = { startX: e.clientX, startDomain: domainRef.current, panning: false };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        if (!a || !b || pinchDist === 0) return;
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (dist > 0) {
          apply(zoomDomain(domainRef.current, fraction((a.x + b.x) / 2), dist / pinchDist));
          pinchDist = dist;
        }
        return;
      }

      if (!drag) return;
      const dx = e.clientX - drag.startX;
      if (!drag.panning) {
        if (Math.abs(dx) < PAN_THRESHOLD_PX) return;
        drag.panning = true;
        el.setPointerCapture(e.pointerId);
      }
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const span = drag.startDomain[1] - drag.startDomain[0];
      const shift = (-dx / rect.width) * span;
      apply([drag.startDomain[0] + shift, drag.startDomain[1] + shift]);
    };

    const onPointerEnd = (e: PointerEvent) => {
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
  }, [enabled, plotRef, apply]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      const [d0, d1] = domainRef.current;
      const span = d1 - d0;
      const panStep = span * (e.shiftKey ? 0.5 : 0.1);
      switch (e.key) {
        case "ArrowLeft":
          apply([d0 - panStep, d1 - panStep]);
          break;
        case "ArrowRight":
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
        default:
          return;
      }
      e.preventDefault();
    },
    [enabled, apply],
  );

  const reset = useCallback(() => apply(null), [apply]);

  return {
    domain,
    isZoomed,
    reset,
    rootProps: {
      tabIndex: 0,
      onKeyDown,
      "aria-keyshortcuts": "ArrowLeft ArrowRight + - 0",
    },
    announcement,
  };
}
