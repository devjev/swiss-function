/** Basemap style resolution for `Map`.
 *
 *  `minimal` (the default) is a compact, hand-authored OpenMapTiles-schema vector
 *  style whose colors are pulled from `--sf-*` tokens — restrained, monochrome,
 *  on-brand, and theme-aware (rebuilt on a dark-mode switch). `street` and
 *  `terrain` are intentionally richer/off-aesthetic opt-ins. `styleUrl` overrides
 *  everything.
 *
 *  Tiles come from free, no-API-key providers (OpenFreeMap planet vector tiles,
 *  Mapterhorn raster-DEM). These are best-effort — they rate-limit and carry no
 *  SLA. The endpoint constants below are easy to swap, and consumers can always
 *  pass their own `styleUrl` (self-hosted / keyed tiles). Provider attribution is
 *  baked into each source and MUST stay visible (it's a license requirement). */

import type { StyleSpecification } from "maplibre-gl";
import { makeResolver } from "./layers";
import type { Basemap } from "./types";

/** Free OpenFreeMap vector tiles (OpenMapTiles schema), no key required. */
const OPENFREEMAP_TILES = "https://tiles.openfreemap.org/planet";
/** OpenFreeMap glyph (font) endpoint — required for any `text-field`. */
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
/** OpenFreeMap's full "liberty" street style (used as the `street` preset). */
const STREET_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
/** Mapterhorn raster-DEM tiles for hillshade + 3D terrain, no key required. */
const MAPTERHORN_DEM = "https://tiles.mapterhorn.com/tilejson.json";

const TILE_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank">© OpenMapTiles</a> ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>';
const DEM_ATTRIBUTION = '<a href="https://mapterhorn.com" target="_blank">© Mapterhorn</a>';

const LABEL_FONT = ["Noto Sans Regular"];

/** A restrained vector basemap, colored entirely from `--sf-*` tokens resolved
 *  through `host` (so it honors the active `data-theme`). A handful of layers:
 *  land, water, admin boundaries, roads, and city/town labels — data-ink only. */
export function buildMinimalStyle(host: Element | null): StyleSpecification {
  const c = makeResolver(host);
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      openmaptiles: { type: "vector", url: OPENFREEMAP_TILES, attribution: TILE_ATTRIBUTION },
    },
    layers: [
      { id: "sf-bg", type: "background", paint: { "background-color": c("var(--sf-color-bg)") } },
      {
        id: "sf-water",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
        paint: {
          "fill-color": c("color-mix(in srgb, var(--sf-color-border) 70%, var(--sf-color-bg))"),
        },
      },
      {
        id: "sf-boundary",
        type: "line",
        source: "openmaptiles",
        "source-layer": "boundary",
        filter: ["<=", ["get", "admin_level"], 4],
        paint: {
          "line-color": c("var(--sf-color-border)"),
          "line-width": 0.8,
          "line-dasharray": [3, 2],
        },
      },
      {
        id: "sf-road",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": c("var(--sf-color-border)"),
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.4, 16, 2],
        },
      },
      {
        id: "sf-place-label",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
        layout: {
          "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
          "text-font": LABEL_FONT,
          "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 10, 14],
        },
        paint: {
          "text-color": c("var(--sf-color-fg)"),
          "text-halo-color": c("var(--sf-color-bg)"),
          "text-halo-width": 1.2,
        },
      },
    ],
  } as StyleSpecification;
}

/** The minimal base plus a raster-DEM hillshade and 3D terrain (Mapterhorn).
 *  Hillshade is inserted under the labels so place names stay legible. */
export function buildTerrainStyle(host: Element | null): StyleSpecification {
  const base = buildMinimalStyle(host);
  base.sources.terrain = {
    type: "raster-dem",
    url: MAPTERHORN_DEM,
    tileSize: 256,
    attribution: DEM_ATTRIBUTION,
  };
  // Insert hillshade right before the label layer (the last entry).
  base.layers.splice(base.layers.length - 1, 0, {
    id: "sf-hillshade",
    type: "hillshade",
    source: "terrain",
    paint: { "hillshade-exaggeration": 0.5 },
  });
  base.terrain = { source: "terrain", exaggeration: 1 };
  return base;
}

/** Resolve the effective style for a `basemap` preset / `styleUrl` override. */
export function resolveStyle(
  basemap: Basemap,
  styleUrl: string | StyleSpecification | undefined,
  host: Element | null,
): string | StyleSpecification {
  if (styleUrl !== undefined) return styleUrl;
  switch (basemap) {
    case "street":
      return STREET_STYLE_URL;
    case "terrain":
      return buildTerrainStyle(host);
    default:
      return buildMinimalStyle(host);
  }
}

/** Whether a preset is token-tinted (and so must be rebuilt on a theme switch).
 *  The hosted `street` style and any consumer `styleUrl` are not. */
export function isTokenTinted(
  basemap: Basemap,
  styleUrl: string | StyleSpecification | undefined,
): boolean {
  return styleUrl === undefined && basemap !== "street";
}
