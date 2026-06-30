import type { Story } from "@ladle/react";
import { Map } from "./Map";

// A few real coordinates reused across stories (all [lng, lat]).
const ZURICH: [number, number] = [8.541, 47.376];
const BERLIN: [number, number] = [13.405, 52.52];
const PARIS: [number, number] = [2.352, 48.857];
const ROME: [number, number] = [12.496, 41.903];

export const Default: Story = () => <Map center={[10, 48]} zoom={4} />;

export const Points: Story = () => (
  <Map
    center={[8, 48]}
    zoom={4}
    points={[
      { at: ZURICH, label: "Zürich", data: { pop: 415000 } },
      { at: BERLIN, label: "Berlin", color: "var(--sf-color-danger)" },
      { at: PARIS, label: "Paris" },
      { at: ROME, label: "Rome", radius: 8 },
    ]}
    onFeatureClick={(f) => console.log("clicked", f)}
  />
);

export const AreasAndVectors: Story = () => (
  <Map
    center={[8, 48]}
    zoom={4}
    areas={[
      {
        label: "Region",
        polygon: [
          [6, 46],
          [10.5, 46],
          [10.5, 48],
          [6, 48],
          [6, 46],
        ],
      },
    ]}
    vectors={[
      { path: [ZURICH, BERLIN], label: "Route", arrow: true },
      { path: [ZURICH, PARIS], label: "Alt route", color: "var(--sf-color-success)", dashed: true },
    ]}
    points={[
      { at: ZURICH, label: "Zürich" },
      { at: BERLIN, label: "Berlin" },
      { at: PARIS, label: "Paris" },
    ]}
  />
);

export const WithControlsAndMinimap: Story = () => (
  <Map
    center={[8, 48]}
    zoom={5}
    points={[
      { at: ZURICH, label: "Zürich" },
      { at: BERLIN, label: "Berlin" },
      { at: PARIS, label: "Paris" },
      { at: ROME, label: "Rome" },
    ]}
  >
    <Map.Controls />
    <Map.Minimap />
  </Map>
);

export const FitToBounds: Story = () => (
  <Map
    bounds={[
      [2, 41],
      [14, 53],
    ]}
    points={[
      { at: ZURICH, label: "Zürich" },
      { at: BERLIN, label: "Berlin" },
      { at: PARIS, label: "Paris" },
      { at: ROME, label: "Rome" },
    ]}
  />
);

export const StreetPreset: Story = () => <Map basemap="street" center={ZURICH} zoom={12} />;

export const TerrainPreset: Story = () => <Map basemap="terrain" center={[7.66, 45.98]} zoom={9} />;

export const RawGeoJSON: Story = () => (
  <Map
    center={[8, 48]}
    zoom={4}
    geojson={{
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: ZURICH } },
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [ZURICH, ROME] },
        },
      ],
    }}
  />
);

export const StaticNonInteractive: Story = () => (
  <Map center={ZURICH} zoom={9} interactive={false} fullscreen={false} />
);

/** Two maps side by side — one in a dark-themed wrapper — to verify the
 *  token-tinted basemap + overlays re-tint with the theme. */
export const Theming: Story = () => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
    <Map center={[8, 48]} zoom={4} points={[{ at: ZURICH, label: "Zürich" }]} />
    <div data-theme="dark" style={{ background: "var(--sf-color-bg)", padding: "0.5rem" }}>
      <Map center={[8, 48]} zoom={4} points={[{ at: ZURICH, label: "Zürich" }]} />
    </div>
  </div>
);

/** `fill` + `frame={false}` inside a sized track — the map takes the parent's
 *  height and drops its own border. */
export const FillInContainer: Story = () => (
  <div style={{ height: "26rem", border: "1px solid var(--sf-color-border)" }}>
    <Map fill frame={false} center={[10, 48]} zoom={4} />
  </div>
);
