import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MinimapMarker, MinimapMarkerKind, MinimapMarkerTone } from "./geometry";

/** One rule for turning matched elements into markers. */
export interface MinimapMarkerSource {
  /** A selector matched inside the content root (`querySelectorAll`). */
  selector: string;
  /** `block` (default): a span the height of the element. `header`: a
   *  clickable label at the element's top. */
  kind?: MinimapMarkerKind;
  /** The header's label. Default: the element's trimmed text. */
  label?: (el: Element) => string;
  /** The header's level: a number, or a function of the element. Default: the
   *  heading tag's level (`h1` is 1, `h6` is 6), else 1. */
  level?: number | ((el: Element) => number);
  /** Give the marker the element's height as its extent. Default: true for
   *  blocks, false for headers (a header is a rule at the top of its element). */
  extent?: boolean;
  /** An accent, fixed or per element; only where the colour means something. */
  tone?: MinimapMarkerTone | ((el: Element) => MinimapMarkerTone | undefined);
  /** Italic header labels, to set grouping headings apart. */
  emphasis?: boolean;
}

export interface UseMinimapMarkersOptions {
  /** Re-measure on DOM mutations and size changes inside the root. Default
   *  true. Off, the markers are measured once per render of the hook's deps. */
  observe?: boolean;
}

const HEADING_LEVEL: Record<string, number> = { H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6 };

function sameMarkers(a: readonly MinimapMarker[], b: readonly MinimapMarker[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (!x || !y) return false;
    if (
      x.id !== y.id ||
      x.top !== y.top ||
      x.height !== y.height ||
      x.kind !== y.kind ||
      x.label !== y.label ||
      x.level !== y.level ||
      x.tone !== y.tone ||
      x.emphasis !== y.emphasis
    ) {
      return false;
    }
  }
  return true;
}

/** Measure the markers once: every match of every source, in content
 *  coordinates relative to the root's top edge (the root is what you render as
 *  the Minimap's child, so its top is the content origin), sorted by position. */
export function measureMinimapMarkers(
  root: HTMLElement,
  sources: readonly MinimapMarkerSource[],
): MinimapMarker[] {
  const base = root.getBoundingClientRect().top;
  const out: MinimapMarker[] = [];
  sources.forEach((source, sourceIndex) => {
    const kind = source.kind ?? "block";
    const withExtent = source.extent ?? kind === "block";
    root.querySelectorAll(source.selector).forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const marker: MinimapMarker = {
        id: el.id || `sf-mm-${sourceIndex}-${index}`,
        top: Math.round((rect.top - base) * 100) / 100,
        kind,
      };
      if (withExtent) marker.height = Math.round(rect.height * 100) / 100;
      if (kind === "header") {
        marker.label = source.label ? source.label(el) : (el.textContent ?? "").trim();
        marker.level =
          typeof source.level === "function"
            ? source.level(el)
            : (source.level ?? HEADING_LEVEL[el.tagName] ?? 1);
        if (source.emphasis) marker.emphasis = true;
      }
      const tone = typeof source.tone === "function" ? source.tone(el) : source.tone;
      if (tone) marker.tone = tone;
      out.push(marker);
    });
  });
  out.sort((a, b) => (a.top ?? 0) - (b.top ?? 0));
  return out;
}

/** Markers for a `Minimap` measured from the DOM, for content you do not lay
 *  out yourself (rendered markdown, a document, a form of mixed parts). Point
 *  `rootRef` at the element you render as the Minimap's child and describe
 *  what counts as a header and a block with selectors; the hook measures every
 *  match in content coordinates and re-measures when the root resizes or its
 *  subtree mutates (rAF-coalesced), and once the document's fonts are in.
 *  Returns a stable array (same reference while nothing moved), so it can feed
 *  `markers` directly. */
export function useMinimapMarkers(
  rootRef: RefObject<HTMLElement | null>,
  sources: readonly MinimapMarkerSource[],
  options: UseMinimapMarkersOptions = {},
): MinimapMarker[] {
  const { observe = true } = options;
  const [markers, setMarkers] = useState<MinimapMarker[]>([]);
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  const rafRef = useRef(0);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const next = measureMinimapMarkers(root, sourcesRef.current);
    setMarkers((prev) => (sameMarkers(prev, next) ? prev : next));
  }, [rootRef]);

  const schedule = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(measure);
  }, [measure]);

  // A serialised view of the sources, so a new array literal per render does
  // not re-subscribe every time, while a real change re-measures.
  const sourcesKey = JSON.stringify(
    sources.map((s) => [
      s.selector,
      s.kind,
      s.extent,
      s.emphasis,
      typeof s.level === "number" ? s.level : null,
    ]),
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: sourcesKey stands in for the sources array
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    measure();
    if (!observe) return;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    ro?.observe(root);
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(schedule) : null;
    mo?.observe(root, { childList: true, subtree: true, characterData: true });
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (fonts && fonts.status !== "loaded") fonts.ready.then(schedule);
    return () => {
      ro?.disconnect();
      mo?.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [rootRef, observe, measure, schedule, sourcesKey]);

  return markers;
}
