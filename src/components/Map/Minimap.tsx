import type { FeatureCollection } from "geojson";
import type { GeoJSONSource } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef, useEffect, useRef } from "react";
import { cx } from "../../lib/cx";
import { makeResolver } from "../../lib/map/layers";
import { buildMinimalStyle } from "../../lib/map/style";
import { useMapInternals } from "./context";
import styles from "./Minimap.module.css";

export interface MapMinimapProps extends ComponentPropsWithoutRef<"div"> {}

/** How many zoom levels the overview sits below the main map. */
const OVERVIEW_DELTA = 4;
const VIEWPORT_SRC = "sf-minimap-viewport";

/** Build the rectangle of the main map's current viewport as a polygon FC. */
function viewportRect(main: maplibregl.Map): FeatureCollection {
  const b = main.getBounds();
  const w = b.getWest();
  const s = b.getSouth();
  const e = b.getEast();
  const n = b.getNorth();
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [w, s],
              [w, n],
              [e, n],
              [e, s],
              [w, s],
            ],
          ],
        },
      },
    ],
  };
}

/** Overview minimap for an enclosing `<Map>`: a second, non-interactive MapLibre
 *  instance showing the whole area at a lower zoom, with a rectangle tracking the
 *  main map's viewport. Must be rendered as a child of `<Map>` (it reads the live
 *  map from `MapInternalContext`).
 *
 *  This is a second WebGL context (browsers cap ~16) and a second tile load — use
 *  it deliberately. It's kept minimal: the token-tinted basemap, no overlays. */
export const MapMinimap = forwardRef<HTMLDivElement, MapMinimapProps>(function MapMinimap(
  { className, ...rest },
  ref,
) {
  const { getMap, epoch } = useMapInternals();
  const surfaceRef = useRef<HTMLDivElement>(null);

  // `epoch` re-runs this when the main map (re)builds: getMap reads a ref, so the
  // effect must re-run to bind the new instance.
  // biome-ignore lint/correctness/useExhaustiveDependencies: epoch gates re-binding on the main map's (re)build.
  useEffect(() => {
    const main = getMap();
    const container = surfaceRef.current;
    if (!main || !container) return;

    let removed = false;
    const mini = new maplibregl.Map({
      container,
      style: buildMinimalStyle(container),
      interactive: false,
      attributionControl: false,
      center: main.getCenter(),
      zoom: Math.max(0, main.getZoom() - OVERVIEW_DELTA),
    });

    const sync = () => {
      if (removed) return;
      mini.jumpTo({
        center: main.getCenter(),
        zoom: Math.max(0, main.getZoom() - OVERVIEW_DELTA),
        bearing: main.getBearing(),
      });
      const src = mini.getSource(VIEWPORT_SRC) as GeoJSONSource | undefined;
      src?.setData(viewportRect(main));
    };

    mini.on("load", () => {
      if (removed) return;
      mini.addSource(VIEWPORT_SRC, { type: "geojson", data: viewportRect(main) });
      mini.addLayer({
        id: VIEWPORT_SRC,
        type: "line",
        source: VIEWPORT_SRC,
        paint: {
          "line-color": makeResolver(container)("var(--sf-color-primary)"),
          "line-width": 1.5,
        },
      });
      sync();
    });

    main.on("move", sync);
    const resizeObserver = new ResizeObserver(() => mini.resize());
    resizeObserver.observe(container);

    return () => {
      removed = true;
      main.off("move", sync);
      resizeObserver.disconnect();
      mini.remove();
    };
  }, [getMap, epoch]);

  return (
    <div {...rest} ref={ref} className={cx(styles.root, className)}>
      <div ref={surfaceRef} className={styles.surface} data-map-minimap aria-hidden="true" />
    </div>
  );
});
