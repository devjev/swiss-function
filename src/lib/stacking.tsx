import { createContext, type ReactNode, useContext, useMemo } from "react";

/**
 * Cross-portal stacking for floating layers (issue #82).
 *
 * Floaters (dropdowns, calendars, menus, popovers) portal to `<body>`, so they
 * are siblings in the root stacking context and a fixed z-index scale decides
 * order. A floater opened from inside a Dialog then paints *behind* it and reads
 * as never-opened. CSS custom properties would inherit a "current layer" down
 * the tree, but that inheritance follows the DOM and dies at the body portal —
 * exactly where we need it. React context follows the *React* tree instead, so
 * it survives the portal: an overlay publishes the z-index a descendant must
 * beat, and a portalled floater reads it and paints just above.
 *
 * Two roles:
 * - **Seeds** (Dialog, Drawer, Fullscreen, Popover) are containers that hold
 *   arbitrary content. They always establish their own band as the ceiling for
 *   whatever opens inside them, so a floater in a Popover clears the Popover
 *   even at the document root.
 * - **Consumers** (Combobox/Picker/Selector, DatePicker, Menu/ContextMenu) are
 *   leaf floaters. At the document root they stay transparent — no inline
 *   z-index, keeping the CSS-default behaviour byte-for-byte — and only climb
 *   once a seed above them has raised the ceiling.
 */

/** z-index bands, kept in lockstep with the `--sf-z-*` scale in `tokens.css`.
 *  `stacking.test.ts` parses the token file and asserts these stay equal, so the
 *  JS mirror can't drift from the canonical CSS. */
export const Z_LAYER = {
  dropdown: 1000,
  overlay: 1100,
  modal: 1200,
  popover: 1300,
  tooltip: 1400,
} as const;

/** Gap a nested *container* jumps to clear the one below it. */
const BAND = 100;
/** Gap a *floater* jumps to clear its host, with room for a few nested floaters
 *  within one band before the next. */
const STEP = 10;

/** The z-index a descendant must exceed to paint above its host overlay.
 *  `0` = document root: no host, so components keep their CSS default. */
const CeilingContext = createContext(0);

export interface StackLayer {
  /** Inline z-index to apply, or `undefined` to keep the CSS default. */
  zIndex: number | undefined;
  /** Ceiling to publish to descendants via {@link StackingProvider}. */
  ceiling: number;
}

/** Pure core of the layering rule. Exported for unit tests. */
export function stackZ(inherited: number, naturalZ: number, seed: boolean): StackLayer {
  if (seed) {
    // A container always owns a band: its natural one at the root, or a step
    // above its host when nested (dialog-in-dialog, popover-in-dialog).
    const ceiling = Math.max(inherited + BAND, naturalZ);
    return { zIndex: inherited > 0 ? ceiling : undefined, ceiling };
  }
  if (inherited > 0) {
    // A leaf floater inside an overlay: climb just above the host.
    const z = Math.max(inherited + STEP, naturalZ);
    return { zIndex: z, ceiling: z };
  }
  // A leaf floater at the root: transparent, CSS default, publish nothing.
  return { zIndex: undefined, ceiling: 0 };
}

/** Read the inherited ceiling and resolve this layer's z-index + the ceiling it
 *  should publish. `naturalZ` is the component's own band (e.g.
 *  `Z_LAYER.dropdown`); `seed` marks a content container vs a leaf floater. */
export function useStackLayer(naturalZ: number, seed: boolean): StackLayer {
  const inherited = useContext(CeilingContext);
  return useMemo(() => stackZ(inherited, naturalZ, seed), [inherited, naturalZ, seed]);
}

/** The ceiling inherited from ancestor overlays (`0` at the document root).
 *  Use it to keep a *conditional* seed a pass-through when it is inactive: a
 *  chart seeds its band only while fullscreen, and otherwise re-publishes this
 *  so a floater inside still climbs above a Dialog the chart sits in. */
export function useStackCeiling(): number {
  return useContext(CeilingContext);
}

/** Publish `ceiling` to descendants. A `ceiling` of `0` is the default context
 *  value, so wrapping with it is inert (no extra provider effect at the root). */
export function StackingProvider({
  ceiling,
  children,
}: {
  ceiling: number;
  children: ReactNode;
}): ReactNode {
  return <CeilingContext.Provider value={ceiling}>{children}</CeilingContext.Provider>;
}
