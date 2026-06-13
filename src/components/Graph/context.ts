import { createContext, useContext } from "react";
import type { LayoutKind } from "../../lib/graph/types";

/** Imperative camera + layout handle that `Graph` publishes through context so
 *  `Graph.Controls` (and any other in-tree consumer) can drive navigation
 *  without prop-drilling a ref. Methods are camera animations; `setLayout`
 *  routes through `Graph`'s controlled/uncontrolled layout state. */
export interface GraphControls {
  /** Zoom the camera in by a fixed factor (animated, reduced-motion aware). */
  zoomIn(): void;
  /** Zoom the camera out by a fixed factor (animated, reduced-motion aware). */
  zoomOut(): void;
  /** Fit the whole graph back into the viewport. */
  fitView(): void;
  /** Reset camera (pan + zoom + rotation) to its default state. */
  reset(): void;
  /** Pan the camera by a screen-space nudge (used by arrow-key navigation). */
  pan(dx: number, dy: number): void;
  /** The active layout. */
  layout: LayoutKind;
  /** Switch the active layout (animated transition / reduced-motion snap). */
  setLayout(next: LayoutKind): void;
}

export const GraphContext = createContext<GraphControls | null>(null);

/** Read the enclosing `Graph`'s control handle. Throws when used outside a
 *  `Graph`, so `Graph.Controls` fails loudly rather than silently no-op. */
export function useGraphControls(): GraphControls {
  const ctx = useContext(GraphContext);
  if (ctx === null) {
    throw new Error("Graph.Controls must be rendered inside a <Graph>.");
  }
  return ctx;
}
