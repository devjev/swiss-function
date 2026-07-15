/* CT harness (Playwright components cannot be defined in the spec file).
   Deterministic fixture: 8000px of content in a 400px viewport. The rail is
   the wrapper's height (400px), so the proportional math is easy to assert:
   railY = contentY / 8000 * 400. */
import { Minimap } from "./Minimap";

export function Tall() {
  return (
    <div style={{ height: 400, width: 520 }}>
      <Minimap markers={[{ id: "m", top: 4000 }]}>
        <div style={{ height: 8000 }} />
      </Minimap>
    </div>
  );
}

export function Short() {
  return (
    <div style={{ height: 400, width: 520 }}>
      <Minimap markers={[{ id: "m", top: 0 }]}>
        <div style={{ height: 100 }} />
      </Minimap>
    </div>
  );
}

/** Labeled fixture: four sections with header markers at known offsets. */
export function WithLabels() {
  return (
    <div style={{ height: 400, width: 520 }}>
      <Minimap
        markers={[
          { id: "one", top: 0, kind: "header", label: "One", level: 2 },
          { id: "two", top: 2000, kind: "header", label: "Two", level: 2 },
          { id: "three", top: 4000, kind: "header", label: "Three", level: 2 },
          // A short final section: reachable only via the at-bottom clamp.
          { id: "four", top: 7900, kind: "header", label: "Four", level: 2 },
        ]}
      >
        <div style={{ height: 8000 }} />
      </Minimap>
    </div>
  );
}

/** A dozen clustered h3 labels in a tight span: decimation must drop most. */
export function Clustered() {
  return (
    <div style={{ height: 400, width: 520 }}>
      <Minimap
        markers={Array.from({ length: 12 }, (_, i) => ({
          id: `c${i}`,
          top: 3000 + i * 100,
          kind: "header" as const,
          label: `Cluster ${i + 1}`,
          level: 3,
        }))}
      >
        <div style={{ height: 80000 }} />
      </Minimap>
    </div>
  );
}

/** Outer-scroller fixture for the wheel consume-guard: the Minimap sits inside
 *  a scrollable page with more content below. */
export function InOuterScroller() {
  return (
    <div data-testid="outer" style={{ height: 400, width: 560, overflowY: "auto" }}>
      {/* The Minimap starts fully inside the outer viewport; the filler below
          gives the outer scroller room to move when chaining resumes. */}
      <div style={{ height: 300 }}>
        <Minimap markers={[{ id: "m", top: 4000 }]}>
          <div style={{ height: 8000 }} />
        </Minimap>
      </div>
      <div style={{ height: 900 }} />
    </div>
  );
}

/** Shrinkable fixture: the inner block starts overflowing and can be shrunk
 *  to fit, so the rail must collapse again (the hysteresis hide branch). */
export function Shrinkable() {
  return (
    <div style={{ height: 400, width: 520 }}>
      <Minimap markers={[{ id: "m", top: 0 }]}>
        <div data-testid="grow" style={{ height: 8000 }} />
      </Minimap>
    </div>
  );
}
