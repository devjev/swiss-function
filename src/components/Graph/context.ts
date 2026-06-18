import type Graphology from "graphology";
import { createContext, useContext } from "react";
import type Sigma from "sigma";
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
  /** Whether the graph is `editable` — i.e. Connect mode is available. Lets
   *  `Graph.Controls` show the Connect toggle only when relationship editing is
   *  enabled. */
  connectable: boolean;
  /** Whether Connect mode is currently on (drag node→node draws an edge). */
  connectMode: boolean;
  /** Toggle Connect mode. No-op effect unless the graph is `editable`. */
  toggleConnect(): void;
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

/** Internal handle `Graph` publishes for in-tree overlays (the minimap) that
 *  need the live renderer/graph rather than just the camera verbs in
 *  `GraphControls`. Not part of the public surface — overlays read framed node
 *  positions + the viewport off the renderer directly. */
export interface GraphInternals {
  /** The live Sigma renderer, or `null` before mount / after unmount. */
  getRenderer(): Sigma | null;
  /** The live graphology graph, or `null` before mount / after unmount. */
  getGraph(): Graphology | null;
  /** Bumped whenever the graph is (re)built or a layout finishes applying, so
   *  overlays know to recompute cached node geometry. */
  epoch: number;
}

export const GraphInternalContext = createContext<GraphInternals | null>(null);

/** Read the enclosing `Graph`'s internal renderer handle. Throws when used
 *  outside a `Graph`, so `Graph.Minimap` fails loudly rather than silently. */
export function useGraphInternals(): GraphInternals {
  const ctx = useContext(GraphInternalContext);
  if (ctx === null) {
    throw new Error("Graph.Minimap must be rendered inside a <Graph>.");
  }
  return ctx;
}
