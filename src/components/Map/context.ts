import type { Map as MaplibreMap } from "maplibre-gl";
import { createContext, useContext } from "react";
import type { Basemap, LngLat, LngLatBounds } from "../../lib/map/types";

/** Imperative camera + basemap handle that `Map` publishes through context so
 *  `Map.Controls` (and any in-tree consumer) can drive navigation without
 *  prop-drilling a ref. All camera motions animate, collapsing to an instant
 *  snap under `prefers-reduced-motion`. */
export interface MapControls {
  /** Zoom the camera in one step. */
  zoomIn(): void;
  /** Zoom the camera out one step. */
  zoomOut(): void;
  /** Fit the given bounds, or the extent of all overlays when omitted. */
  fitBounds(bounds?: LngLatBounds): void;
  /** Return to the initial camera (the mount-time `center`/`zoom`/`bounds`). */
  reset(): void;
  /** Fly to a center, optionally changing zoom. */
  flyTo(center: LngLat, zoom?: number): void;
  /** The active basemap preset. */
  basemap: Basemap;
  /** Switch the active basemap (routes through controlled/uncontrolled state). */
  setBasemap(next: Basemap): void;
}

export const MapContext = createContext<MapControls | null>(null);

/** Read the enclosing `Map`'s control handle. Throws outside a `Map`, so
 *  `Map.Controls` fails loudly rather than silently no-op. */
export function useMapControls(): MapControls {
  const ctx = useContext(MapContext);
  if (ctx === null) {
    throw new Error("Map.Controls must be rendered inside a <Map>.");
  }
  return ctx;
}

/** Internal handle for in-tree overlays (the minimap) that need the live MapLibre
 *  instance, not just the camera verbs. Not part of the public surface. */
export interface MapInternals {
  /** The live MapLibre map, or `null` before mount / after unmount. */
  getMap(): MaplibreMap | null;
  /** Bumped on (re)build, load, and resize, so overlays recompute geometry. */
  epoch: number;
}

export const MapInternalContext = createContext<MapInternals | null>(null);

/** Read the enclosing `Map`'s internal handle. Throws outside a `Map`. */
export function useMapInternals(): MapInternals {
  const ctx = useContext(MapInternalContext);
  if (ctx === null) {
    throw new Error("Map.Minimap must be rendered inside a <Map>.");
  }
  return ctx;
}
