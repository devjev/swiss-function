/** Overlay plumbing for `Map`: turn the declarative `points` / `areas` /
 *  `vectors` (+ raw `geojson`) into MapLibre GeoJSON sources + layers, and keep
 *  them in sync as props change.
 *
 *  The feature builders are pure and DOM-free (a `ColorResolver` is injected for
 *  theming), so they unit-test without WebGL. `syncOverlays` is the only part
 *  that touches a live `maplibregl.Map`; it is idempotent (create-or-update via
 *  `setData`), so it doubles as both the initial apply and the post-`setStyle`
 *  re-apply (a style swap clears all sources/layers). */

import type { Feature, FeatureCollection } from "geojson";
import type {
  CircleLayerSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
  Map as MaplibreMap,
  SymbolLayerSpecification,
} from "maplibre-gl";
import { resolveRgb } from "../chart3d/shading";
import type {
  ColorResolver,
  LngLat,
  LngLatBounds,
  MapArea,
  MapOverlays,
  MapPoint,
  MapVector,
} from "./types";

// Source ids. Stable so `setData` can find and update them across renders.
export const SRC = {
  points: "sf-points",
  areas: "sf-areas",
  vectors: "sf-vectors",
  arrows: "sf-vector-arrows",
  geojson: "sf-geojson",
} as const;

const DEFAULT_COLOR = "var(--sf-color-primary)";

/** Normalize a single un-nested ring into GeoJSON `Polygon` ring nesting. */
function toRings(polygon: MapArea["polygon"]): number[][][] {
  const first = polygon[0];
  // `[[lng,lat], …]` (a bare ring) → wrap; `[[[lng,lat],…]]` is already nested.
  const isBareRing = typeof first?.[0] === "number";
  return (isBareRing ? [polygon] : polygon) as number[][][];
}

/** Geographic bearing (degrees clockwise from north) of the segment a→b. */
export function bearing(a: LngLat, b: LngLat): number {
  const rad = Math.PI / 180;
  const dLng = (b[0] - a[0]) * rad;
  const y = Math.sin(dLng) * Math.cos(b[1] * rad);
  const x =
    Math.cos(a[1] * rad) * Math.sin(b[1] * rad) -
    Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function pointsToFC(points: MapPoint[], resolve: ColorResolver): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map((p, idx) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: p.at },
      properties: {
        _idx: idx,
        color: resolve(p.color ?? DEFAULT_COLOR),
        radius: p.radius ?? 5,
        ...(p.label !== undefined ? { label: p.label } : {}),
      },
    })),
  };
}

export function areasToFC(areas: MapArea[], resolve: ColorResolver): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: areas.map((a, idx) => {
      const base = a.color ?? DEFAULT_COLOR;
      return {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: toRings(a.polygon) },
        properties: {
          _idx: idx,
          color: resolve(base),
          strokeColor: resolve(a.strokeColor ?? base),
          strokeWidth: a.strokeWidth ?? 1.5,
          fillOpacity: a.fillOpacity ?? 0.2,
          ...(a.label !== undefined ? { label: a.label } : {}),
        },
      };
    }),
  };
}

export function vectorsToFC(vectors: MapVector[], resolve: ColorResolver): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: vectors.map((v, idx) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: v.path },
      properties: {
        _idx: idx,
        color: resolve(v.color ?? DEFAULT_COLOR),
        width: v.width ?? 2,
        dashed: v.dashed ?? false,
        ...(v.label !== undefined ? { label: v.label } : {}),
      },
    })),
  };
}

/** Arrowhead points: one per `arrow` vector, at its final vertex, rotated to the
 *  line's terminal bearing. Kept in a separate source so the symbol layer doesn't
 *  fight the line layers. */
export function arrowsToFC(vectors: MapVector[], resolve: ColorResolver): FeatureCollection {
  const features: Feature[] = [];
  vectors.forEach((v, idx) => {
    const end = v.path[v.path.length - 1];
    const prev = v.path[v.path.length - 2];
    if (!v.arrow || end === undefined || prev === undefined) return;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: end },
      properties: {
        _idx: idx,
        color: resolve(v.color ?? DEFAULT_COLOR),
        // ➤ glyph points east (90° from north); rotate so it faces the bearing.
        rotate: (bearing(prev, end) - 90 + 360) % 360,
      },
    });
  });
  return { type: "FeatureCollection", features };
}

// --- Layer specs (static — paint reads feature properties, not the resolver) ---

const ARROW_FONT = ["Noto Sans Regular"];

function layerSpecs(): Array<
  | FillLayerSpecification
  | LineLayerSpecification
  | CircleLayerSpecification
  | SymbolLayerSpecification
> {
  return [
    // Areas sit at the bottom so points/lines read on top of their fills.
    {
      id: "sf-areas-fill",
      type: "fill",
      source: SRC.areas,
      paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "fillOpacity"] },
    },
    {
      id: "sf-areas-line",
      type: "line",
      source: SRC.areas,
      layout: { "line-join": "round" },
      paint: { "line-color": ["get", "strokeColor"], "line-width": ["get", "strokeWidth"] },
    },
    {
      id: "sf-vectors-line",
      type: "line",
      source: SRC.vectors,
      filter: ["!", ["get", "dashed"]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": ["get", "width"] },
    },
    {
      id: "sf-vectors-line-dashed",
      type: "line",
      source: SRC.vectors,
      filter: ["get", "dashed"],
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["get", "width"],
        "line-dasharray": [2, 1.5],
      },
    },
    {
      id: "sf-vector-arrows-symbol",
      type: "symbol",
      source: SRC.arrows,
      layout: {
        "text-field": "➤",
        "text-font": ARROW_FONT,
        "text-size": 16,
        "text-rotate": ["get", "rotate"],
        "text-rotation-alignment": "map",
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": ["get", "color"] },
    },
    {
      id: "sf-points-circle",
      type: "circle",
      source: SRC.points,
      paint: {
        "circle-radius": ["get", "radius"],
        "circle-color": ["get", "color"],
        "circle-stroke-color": ["get", "stroke"],
        "circle-stroke-width": 1.5,
      },
    },
    {
      id: "sf-points-label",
      type: "symbol",
      source: SRC.points,
      filter: ["has", "label"],
      layout: {
        "text-field": ["get", "label"],
        "text-font": ARROW_FONT,
        "text-size": 12,
        "text-offset": [0, 1.1],
        "text-anchor": "top",
        "text-optional": true,
      },
      paint: {
        "text-color": ["get", "labelColor"],
        "text-halo-color": ["get", "halo"],
        "text-halo-width": 1.2,
      },
    },
  ];
}

/** Ids of the interactive overlay layers, for `queryRenderedFeatures` / clicks. */
export const HIT_LAYERS = [
  "sf-points-circle",
  "sf-areas-fill",
  "sf-vectors-line",
  "sf-vectors-line-dashed",
] as const;

/** Bounding box `[[minLng,minLat],[maxLng,maxLat]]` of every overlay coordinate,
 *  or `null` when there is nothing to fit. Used by fit-to-view. */
export function overlayBounds(overlays: MapOverlays): LngLatBounds | null {
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let seen = false;
  const visit = (lng: number, lat: number) => {
    seen = true;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  };
  for (const p of overlays.points ?? []) visit(p.at[0], p.at[1]);
  for (const v of overlays.vectors ?? []) for (const c of v.path) visit(c[0], c[1]);
  for (const a of overlays.areas ?? []) {
    for (const ring of toRings(a.polygon)) {
      for (const c of ring) {
        const lng = c[0];
        const lat = c[1];
        if (lng !== undefined && lat !== undefined) visit(lng, lat);
      }
    }
  }
  return seen
    ? [
        [minLng, minLat],
        [maxLng, maxLat],
      ]
    : null;
}

/** Map an overlay layer id back to the kind echoed in `onFeatureClick`. */
export function kindOfLayer(layerId: string): "point" | "area" | "vector" {
  if (layerId.startsWith("sf-points")) return "point";
  if (layerId.startsWith("sf-areas")) return "area";
  return "vector";
}

function ensureSource(map: MaplibreMap, id: string, data: FeatureCollection): void {
  const existing = map.getSource(id);
  if (existing && "setData" in existing) {
    (existing as { setData(d: FeatureCollection): void }).setData(data);
  } else if (!existing) {
    map.addSource(id, { type: "geojson", data });
  }
}

/** Create-or-update every overlay source + layer on a loaded map. Idempotent:
 *  safe to call on first load, on overlay-prop change, and after a `setStyle`
 *  (which wipes sources/layers, so this re-adds them). Per-point label/contrast
 *  colors are resolved here (token-aware) and merged into the point source. */
export function syncOverlays(map: MaplibreMap, overlays: MapOverlays, host: Element | null): void {
  const resolve = makeResolver(host);
  const stroke = resolve("var(--sf-color-bg)");
  const labelColor = resolve("var(--sf-color-fg)");
  const halo = resolve("var(--sf-color-bg)");

  // Points carry extra theme-derived contrast colors (stroke ring, label halo).
  const pointsFC = pointsToFC(overlays.points ?? [], resolve);
  for (const f of pointsFC.features) {
    Object.assign(f.properties as object, { stroke, labelColor, halo });
  }

  ensureSource(map, SRC.points, pointsFC);
  ensureSource(map, SRC.areas, areasToFC(overlays.areas ?? [], resolve));
  ensureSource(map, SRC.vectors, vectorsToFC(overlays.vectors ?? [], resolve));
  ensureSource(map, SRC.arrows, arrowsToFC(overlays.vectors ?? [], resolve));
  ensureSource(map, SRC.geojson, overlays.geojson ?? { type: "FeatureCollection", features: [] });

  for (const spec of layerSpecs()) {
    if (!map.getLayer(spec.id)) map.addLayer(spec);
  }
  ensureGeojsonLayers(map, resolve);
}

/** Generic layers for the raw-`geojson` escape hatch — one per geometry class,
 *  token-tinted (literal paint, since arbitrary GeoJSON has no `color` prop). */
function ensureGeojsonLayers(map: MaplibreMap, resolve: ColorResolver): void {
  const primary = resolve(DEFAULT_COLOR);
  const specs: Array<FillLayerSpecification | LineLayerSpecification | CircleLayerSpecification> = [
    {
      id: "sf-geojson-fill",
      type: "fill",
      source: SRC.geojson,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": primary, "fill-opacity": 0.2 },
    },
    {
      id: "sf-geojson-line",
      type: "line",
      source: SRC.geojson,
      filter: ["==", ["geometry-type"], "LineString"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": primary, "line-width": 2 },
    },
    {
      id: "sf-geojson-circle",
      type: "circle",
      source: SRC.geojson,
      filter: ["==", ["geometry-type"], "Point"],
      paint: { "circle-radius": 5, "circle-color": primary },
    },
  ];
  for (const spec of specs) {
    if (!map.getLayer(spec.id)) map.addLayer(spec);
  }
}

/** Bind a `ColorResolver` to the map's themed subtree — any CSS color (incl. a
 *  `var(--sf-*)` token) → an `rgb(...)` string MapLibre paint understands.
 *
 *  Memoized per resolver: `resolveRgb` appends a probe and reads computed style
 *  (a forced layout). Overlays reuse a handful of colors across thousands of
 *  features, so caching collapses thousands of reflows down to one per distinct
 *  color. The cache lives only for this resolver (one `syncOverlays` pass), so it
 *  never goes stale across a theme change (each sync rebuilds the resolver). */
export function makeResolver(host: Element | null): ColorResolver {
  if (!host) return (c) => c;
  const cache = new Map<string, string>();
  return (color) => {
    const hit = cache.get(color);
    if (hit !== undefined) return hit;
    const [r, g, b] = resolveRgb(color, host);
    const out = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    cache.set(color, out);
    return out;
  };
}
