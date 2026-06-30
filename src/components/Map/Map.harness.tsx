import type { StyleSpecification } from "maplibre-gl";
import type { MapProps } from "./Map";
import { Map } from "./Map";

/** A no-network style: a single background layer, no sources/glyphs. Keeps the CT
 *  map hermetic — it mounts a real WebGL map without fetching tiles. */
const EMPTY_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#ffffff" } }],
};

export interface MapHarnessProps extends MapProps {
  controls?: boolean;
  minimap?: boolean;
}

/** Test harness: a `Map` on an inline empty style, wrapped in a fixed 600×400
 *  box (so `fill` has a height to take), with optional Controls / Minimap. */
export function MapHarness({ controls = true, minimap = false, ...props }: MapHarnessProps) {
  return (
    <div style={{ width: 600, height: 400 }}>
      <Map styleUrl={EMPTY_STYLE} center={[0, 0]} zoom={1} {...props}>
        {controls && <Map.Controls />}
        {minimap && <Map.Minimap />}
      </Map>
    </div>
  );
}
