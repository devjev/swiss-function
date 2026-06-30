/** Shared types for the `Map` component and its `src/lib/map` internals.
 *
 *  Coordinate order throughout is **GeoJSON `[longitude, latitude]`** — NOT the
 *  spoken "lat, lng". The overlay field is named `at`/`path`/`polygon` and every
 *  type carries `LngLat` so transposed coordinates are caught at the type level. */

import type { FeatureCollection } from "geojson";

/** A `[longitude, latitude]` pair, GeoJSON axis order. */
export type LngLat = [number, number];

/** A west/south → east/north bounding box, `[[minLng, minLat],[maxLng, maxLat]]`. */
export type LngLatBounds = [LngLat, LngLat];

/** Built-in basemap presets. `minimal` is a restrained, token-tinted vector style
 *  (the on-brand default); `street` and `terrain` are richer, intentionally
 *  off-aesthetic opt-ins. Override entirely with `styleUrl`. */
export type Basemap = "minimal" | "street" | "terrain";

/** Fields common to every plotted overlay feature. */
export interface MapFeatureBase {
  /** Stable id, echoed back in `onFeatureClick`. */
  id?: string | number;
  /** Hover label (shown by the default tooltip / `renderTooltip`). */
  label?: string;
  /** Any CSS color, including a token string like `"var(--sf-color-danger)"`.
   *  Defaults to `--sf-color-primary`. Resolved through the map's themed subtree. */
  color?: string;
  /** Arbitrary payload echoed back in `onFeatureClick` / `renderTooltip`. */
  data?: unknown;
}

/** A point marker, drawn as a circle. */
export interface MapPoint extends MapFeatureBase {
  /** Position, `[lng, lat]`. */
  at: LngLat;
  /** Circle radius in px. Default `5`. */
  radius?: number;
}

/** A filled polygon region. */
export interface MapArea extends MapFeatureBase {
  /** Polygon rings as GeoJSON `Polygon` coordinates (`[ring][vertex][lng,lat]`).
   *  A single ring may be passed un-nested as sugar (`[[lng,lat], …]`). */
  polygon: LngLat[][] | LngLat[];
  /** Outline color. Defaults to `color`. */
  strokeColor?: string;
  /** Outline width in px. Default `1.5`. */
  strokeWidth?: number;
  /** Fill opacity, 0–1. Default `0.2`. */
  fillOpacity?: number;
}

/** A poly-line, optionally arrow-headed / dashed — a route, flow, or vector. */
export interface MapVector extends MapFeatureBase {
  /** Ordered vertices, `[lng, lat]` each. */
  path: LngLat[];
  /** Line width in px. Default `2`. */
  width?: number;
  /** Draw an arrowhead at the final vertex. Default `false`. */
  arrow?: boolean;
  /** Render the line dashed. Default `false`. */
  dashed?: boolean;
}

/** The three declarative overlay arrays, grouped — the unit the diff works on. */
export interface MapOverlays {
  points?: MapPoint[];
  areas?: MapArea[];
  vectors?: MapVector[];
  /** Power-user escape hatch: raw GeoJSON drawn with token-tinted defaults. */
  geojson?: FeatureCollection;
}

/** What an overlay click/hover landed on. */
export interface MapFeatureHit {
  kind: "point" | "area" | "vector";
  id: string | number | undefined;
  label?: string;
  data: unknown;
  /** `[lng, lat]` of the pointer at the moment of the event. */
  lngLat: LngLat;
}

/** Resolves a CSS color string (possibly a token) to a canvas/style-ready value.
 *  Injected into the pure feature builders so they stay DOM-free and testable;
 *  the live component binds it to `resolveRgb(host)`. */
export type ColorResolver = (color: string) => string;
