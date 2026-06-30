import type { FeatureCollection } from "geojson";
import type { Map as MaplibreMap, StyleSpecification } from "maplibre-gl";
import maplibregl from "maplibre-gl";
// MapLibre's own stylesheet is REQUIRED: it makes the GL canvas `position:absolute`
// (out of normal flow). Without it the in-flow canvas feeds its height back into
// the container, growing unbounded every frame — a resize loop that flickers and
// hides the map. It also lays out the attribution / zoom controls.
import "maplibre-gl/dist/maplibre-gl.css";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import {
  HIT_LAYERS,
  kindOfLayer,
  makeResolver,
  overlayBounds,
  syncOverlays,
} from "../../lib/map/layers";
import { isTokenTinted, resolveStyle } from "../../lib/map/style";
import type {
  Basemap,
  LngLat,
  LngLatBounds,
  MapArea,
  MapFeatureHit,
  MapOverlays,
  MapPoint,
  MapVector,
} from "../../lib/map/types";
import { useFullscreen } from "../../lib/useFullscreen";
import { FullscreenToggle } from "../Fullscreen";
import { NonIdealState } from "../NonIdealState";
import { MapControlsBar } from "./Controls";
import { MapContext, type MapControls, MapInternalContext, type MapInternals } from "./context";
import styles from "./Map.module.css";
import { MapMinimap } from "./Minimap";

export type {
  Basemap,
  LngLat,
  LngLatBounds,
  MapArea,
  MapFeatureHit,
  MapPoint,
  MapVector,
} from "../../lib/map/types";

export interface MapProps extends Omit<HTMLAttributes<HTMLDivElement>, "onClick"> {
  /** Initial camera center, `[lng, lat]`. Default roughly world-centered. */
  center?: LngLat;
  /** Initial zoom (0 = whole world … ~22 = building). Default `1`. */
  zoom?: number;
  /** Fit these bounds on mount (wins over `center`/`zoom`); changing it re-fits. */
  bounds?: LngLatBounds;
  /** Basemap preset (controlled). Default `"minimal"` when uncontrolled. */
  basemap?: Basemap;
  /** Initial basemap when `basemap` is left uncontrolled. Default `"minimal"`. */
  defaultBasemap?: Basemap;
  /** Fired when the basemap changes (prop, `Map.Controls`, or `setBasemap`). */
  onBasemapChange?: (next: Basemap) => void;
  /** Escape hatch: a MapLibre style URL or full style object, overriding
   *  `basemap` entirely (self-hosted / keyed tiles, custom cartography). */
  styleUrl?: string | StyleSpecification;

  /** Point markers (circles). */
  points?: MapPoint[];
  /** Filled polygon regions. */
  areas?: MapArea[];
  /** Poly-lines, optionally arrow-headed / dashed. */
  vectors?: MapVector[];
  /** Power-user path: raw GeoJSON drawn with token-tinted defaults. */
  geojson?: FeatureCollection;

  /** Fixed height: a number (px) or any CSS length. Ignored when `fill`. */
  height?: number | string;
  /** Fill the parent's height instead of the fixed default (parent sets one). */
  fill?: boolean;
  /** Draw the own border + corner. Default `true`; `false` inside a framed wrapper. */
  frame?: boolean;
  /** Corner fullscreen toggle. Default `true`. */
  fullscreen?: boolean;
  /** Initial maximized state (uncontrolled). Default `false`. */
  defaultFullscreen?: boolean;
  /** Notified when the map is maximized / restored. */
  onFullscreenChange?: (expanded: boolean) => void;
  /** Disable pan/zoom/rotate for a static map. Default interactive. */
  interactive?: boolean;

  /** Click on any overlay feature (point / area / vector). */
  onFeatureClick?: (feature: MapFeatureHit) => void;
  /** Custom hover tooltip; return `null` for none. Defaults to the feature label. */
  renderTooltip?: (feature: MapFeatureHit) => ReactNode;
  /** Overlay children — typically `<Map.Controls />` / `<Map.Minimap />`. */
  children?: ReactNode;
}

/** Default camera when neither `center`/`zoom` nor `bounds` is given. */
const DEFAULT_CENTER: LngLat = [0, 20];
const DEFAULT_ZOOM = 1;
/** Padding (px) around fitted bounds. */
const FIT_PADDING = 40;

/** True when the user asked for reduced motion (camera moves snap, no fly). */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Whether WebGL (which MapLibre requires) is available in this environment. */
function webglAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

const toSize = (h: number | string): string => (typeof h === "number" ? `${h}px` : h);

/** A hover/click tooltip pinned to the pointer. */
interface TooltipState {
  x: number;
  y: number;
  content: ReactNode;
}

const MapRoot = forwardRef<HTMLDivElement, MapProps>(function Map(
  {
    center,
    zoom,
    bounds,
    basemap: controlledBasemap,
    defaultBasemap = "minimal",
    onBasemapChange,
    styleUrl,
    points,
    areas,
    vectors,
    geojson,
    height,
    fill = false,
    frame = true,
    fullscreen = true,
    defaultFullscreen,
    onFullscreenChange,
    interactive = true,
    onFeatureClick,
    renderTooltip,
    className,
    style: styleProp,
    children,
    ...rest
  },
  ref,
) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const loadedRef = useRef(false);
  const [unsupported, setUnsupported] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { expanded: isFullscreen, toggle: toggleFullscreen } = useFullscreen({
    defaultExpanded: defaultFullscreen,
    onExpandedChange: onFullscreenChange,
  });

  // Uncontrolled basemap; the `basemap` prop wins when provided (Graph's
  // controlled/uncontrolled layout pattern).
  const [uncontrolledBasemap, setUncontrolledBasemap] = useState<Basemap>(defaultBasemap);
  const basemap = controlledBasemap ?? uncontrolledBasemap;
  const setBasemap = useCallback(
    (next: Basemap) => {
      if (controlledBasemap === undefined) setUncontrolledBasemap(next);
      onBasemapChange?.(next);
    },
    [controlledBasemap, onBasemapChange],
  );

  // Bumped on (re)build / load / resize so the minimap recomputes geometry.
  const [epoch, setEpoch] = useState(0);
  const bumpEpoch = useCallback(() => setEpoch((e) => e + 1), []);

  // Overlays as one memoized object, read by the mount effect (refs) and the
  // diff effect (deps). Identity changes only when an array changes.
  const overlays = useMemo<MapOverlays>(
    () => ({ points, areas, vectors, geojson }),
    [points, areas, vectors, geojson],
  );

  // Latest values read inside long-lived map listeners / the once-run mount
  // effect, without re-subscribing or re-creating the map.
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;
  const handlersRef = useRef({ onFeatureClick, renderTooltip });
  handlersRef.current = { onFeatureClick, renderTooltip };
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;
  const styleUrlRef = useRef(styleUrl);
  styleUrlRef.current = styleUrl;
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;
  // The mount-time camera, restored by `reset()`.
  const initialCamRef = useRef({ center, zoom, bounds });
  initialCamRef.current = { center, zoom, bounds };

  // Resolve the feature under a screen point back to its original overlay datum.
  const featureAt = useCallback(
    (map: MaplibreMap, point: { x: number; y: number }, lngLat: LngLat) => {
      const layers = HIT_LAYERS.filter((id) => map.getLayer(id));
      const hits = layers.length ? map.queryRenderedFeatures([point.x, point.y], { layers }) : [];
      const feature = hits[0];
      if (!feature?.layer) return null;
      const kind = kindOfLayer(feature.layer.id);
      const idx = Number(feature.properties?._idx ?? -1);
      const source =
        kind === "point"
          ? overlaysRef.current.points
          : kind === "area"
            ? overlaysRef.current.areas
            : overlaysRef.current.vectors;
      const datum = source?.[idx];
      const hit: MapFeatureHit = {
        kind,
        id: datum?.id,
        label: datum?.label,
        data: datum?.data,
        lngLat,
      };
      return hit;
    },
    [],
  );

  // Build the MapLibre instance and wire every listener ONCE, on mount. Camera /
  // overlays / handlers are read through refs so prop changes never re-create the
  // map; they flow through the dedicated effects below.
  useEffect(() => {
    const container = surfaceRef.current;
    if (typeof window === "undefined" || !container) return;
    if (!webglAvailable()) {
      setUnsupported(true);
      return;
    }

    const reduced = prefersReducedMotion();
    const init = initialCamRef.current;
    const map = new maplibregl.Map({
      container,
      style: resolveStyle(basemapRef.current, styleUrlRef.current, container),
      center: init.center ?? DEFAULT_CENTER,
      zoom: init.zoom ?? DEFAULT_ZOOM,
      ...(init.bounds ? { bounds: init.bounds, fitBoundsOptions: { padding: FIT_PADDING } } : {}),
      interactive: interactiveRef.current,
      attributionControl: { compact: true },
      fadeDuration: reduced ? 0 : 300,
    });
    mapRef.current = map;

    map.on("load", () => {
      loadedRef.current = true;
      syncOverlays(map, overlaysRef.current, container);
      bumpEpoch();
    });

    map.on("click", (e) => {
      const hit = featureAt(map, e.point, [e.lngLat.lng, e.lngLat.lat]);
      if (hit) handlersRef.current.onFeatureClick?.(hit);
    });

    map.on("mousemove", (e) => {
      const hit = featureAt(map, e.point, [e.lngLat.lng, e.lngLat.lat]);
      map.getCanvas().style.cursor = hit ? "pointer" : "";
      if (!hit) {
        setTooltip(null);
        return;
      }
      const render = handlersRef.current.renderTooltip;
      const content = render ? render(hit) : hit.label;
      if (content == null || content === "") {
        setTooltip(null);
        return;
      }
      setTooltip({ x: e.point.x, y: e.point.y, content });
    });
    map.on("mouseout", () => {
      map.getCanvas().style.cursor = "";
      setTooltip(null);
    });

    // Re-fit the canvas to its CONTAINER (panes/tabs/SplitPane resize), not just
    // the window — MapLibre only auto-handles window resize.
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current !== map) return;
      map.resize();
      bumpEpoch();
    });
    resizeObserver.observe(container);

    // Re-tint a token-derived basemap + overlays when the theme flips. MapLibre
    // paint is JS-set, so (unlike pure CSS components) it can't auto-respond to a
    // `[data-theme]` change — we observe it and rebuild in place. The contract puts
    // `[data-theme]` on ANY ancestor, and the NEAREST one wins (it re-scopes the
    // tokens), so we must watch the whole chain from the surface up to <html> — not
    // just html/body. Walking the chain (vs. a document-wide subtree observer) keeps
    // this precise: only real theme hosts can fire it.
    let themeRaf = 0;
    let lastBg = makeResolver(container)("var(--sf-color-bg)");
    const reTint = () => {
      cancelAnimationFrame(themeRaf);
      themeRaf = requestAnimationFrame(() => {
        if (mapRef.current !== map) return;
        if (!isTokenTinted(basemapRef.current, styleUrlRef.current)) return;
        // Cheap guard: a `class` mutation up the chain rarely changes the resolved
        // theme — only rebuild when the surface's background token actually moved.
        const bg = makeResolver(container)("var(--sf-color-bg)");
        if (bg === lastBg) return;
        lastBg = bg;
        map.setStyle(resolveStyle(basemapRef.current, styleUrlRef.current, container), {
          diff: true,
        });
        map.once("styledata", () => syncOverlays(map, overlaysRef.current, container));
      });
    };
    const themeObserver = new MutationObserver(reTint);
    const themeOpts: MutationObserverInit = {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    };
    for (let el: Element | null = container; el; el = el.parentElement) {
      themeObserver.observe(el, themeOpts);
    }
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", reTint);

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      cancelAnimationFrame(themeRaf);
      media?.removeEventListener?.("change", reTint);
      loadedRef.current = false;
      mapRef.current = null;
      map.remove();
      setTooltip(null);
    };
  }, [bumpEpoch, featureAt]);

  // Sync overlays IN PLACE on change (no-op until loaded; the load handler does
  // the first apply). `syncOverlays` is idempotent (setData / add-if-missing).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    syncOverlays(map, overlays, surfaceRef.current);
  }, [overlays]);

  // Camera: re-fit / fly when bounds or center/zoom change. Skip the first run —
  // the constructor already applied the initial camera.
  const camFirstRef = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (camFirstRef.current) {
      camFirstRef.current = false;
      return;
    }
    const reduced = prefersReducedMotion();
    if (bounds) {
      map.fitBounds(bounds, { padding: FIT_PADDING, animate: !reduced });
    } else if (center) {
      const opts = { center, zoom: zoom ?? map.getZoom() };
      if (reduced) map.jumpTo(opts);
      else map.flyTo(opts);
    }
  }, [bounds, center, zoom]);

  // Basemap / styleUrl swap. setStyle wipes sources/layers, so re-sync overlays
  // once the new style settles. Skip the first run (constructor set it).
  const styleFirstRef = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (styleFirstRef.current) {
      styleFirstRef.current = false;
      return;
    }
    map.setStyle(resolveStyle(basemap, styleUrl, surfaceRef.current), { diff: true });
    map.once("styledata", () => syncOverlays(map, overlaysRef.current, surfaceRef.current));
  }, [basemap, styleUrl]);

  // Toggle interactivity at runtime (the map is built once).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handlers = [
      map.dragPan,
      map.scrollZoom,
      map.boxZoom,
      map.dragRotate,
      map.keyboard,
      map.doubleClickZoom,
      map.touchZoomRotate,
    ];
    for (const h of handlers) {
      if (interactive) h?.enable?.();
      else h?.disable?.();
    }
  }, [interactive]);

  // --- Imperative controls (published via context) -------------------------
  const zoomIn = useCallback(() => mapRef.current?.zoomIn(), []);
  const zoomOut = useCallback(() => mapRef.current?.zoomOut(), []);
  const flyTo = useCallback((c: LngLat, z?: number) => {
    const map = mapRef.current;
    if (!map) return;
    const opts = { center: c, zoom: z ?? map.getZoom() };
    if (prefersReducedMotion()) map.jumpTo(opts);
    else map.flyTo(opts);
  }, []);
  const fitBounds = useCallback((b?: LngLatBounds) => {
    const map = mapRef.current;
    if (!map) return;
    const target = b ?? overlayBounds(overlaysRef.current);
    if (!target) return;
    map.fitBounds(target, { padding: FIT_PADDING, animate: !prefersReducedMotion() });
  }, []);
  const reset = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const reduced = prefersReducedMotion();
    const init = initialCamRef.current;
    if (init.bounds) {
      map.fitBounds(init.bounds, { padding: FIT_PADDING, animate: !reduced });
      return;
    }
    const opts = { center: init.center ?? DEFAULT_CENTER, zoom: init.zoom ?? DEFAULT_ZOOM };
    if (reduced) map.jumpTo(opts);
    else map.flyTo(opts);
  }, []);

  const controls = useMemo<MapControls>(
    () => ({ zoomIn, zoomOut, fitBounds, reset, flyTo, basemap, setBasemap }),
    [zoomIn, zoomOut, fitBounds, reset, flyTo, basemap, setBasemap],
  );

  const getMap = useCallback(() => mapRef.current, []);
  const internals = useMemo<MapInternals>(() => ({ getMap, epoch }), [getMap, epoch]);

  const rootStyle: CSSProperties | undefined =
    !fill && height != null ? { ...styleProp, blockSize: toSize(height) } : styleProp;

  return (
    <MapContext.Provider value={controls}>
      <MapInternalContext.Provider value={internals}>
        <div
          {...rest}
          ref={ref}
          data-map-root
          data-fullscreen={isFullscreen || undefined}
          className={cx(
            styles.root,
            fill && styles.fill,
            !frame && styles.frameless,
            isFullscreen && styles.fullscreen,
            className,
          )}
          style={rootStyle}
        >
          {unsupported ? (
            <NonIdealState
              variant="error"
              title="Map unavailable"
              description="WebGL is required to display this map."
            />
          ) : (
            <>
              <div
                ref={surfaceRef}
                className={styles.surface}
                data-map-surface
                role="application"
                aria-label="Map"
              />
              {tooltip && (
                <div
                  className={styles.tooltip}
                  style={{ left: tooltip.x, top: tooltip.y }}
                  data-map-tooltip
                >
                  {tooltip.content}
                </div>
              )}
              {children}
              {fullscreen && (
                <FullscreenToggle expanded={isFullscreen} onToggle={toggleFullscreen} />
              )}
            </>
          )}
        </div>
      </MapInternalContext.Provider>
    </MapContext.Provider>
  );
});

/** `Map` with `Controls` + `Minimap` attached as compound members (the house
 *  `Object.assign(Root, { … })` convention — Graph, Pane, Field, …). */
export const Map = Object.assign(MapRoot, {
  Controls: MapControlsBar,
  Minimap: MapMinimap,
});
