import { type ComponentType, createContext, type ReactNode, useContext, useMemo } from "react";

/**
 * Pluggable icons (issue #89).
 *
 * The library draws its own glyphs (chevrons, a Dialog close, chart zoom
 * controls) from the bespoke set. A consumer may want those to read as Feather,
 * Lucide, or Tabler instead. This context lets them redirect any glyph the
 * library renders, for the whole app or one subtree, without the library taking
 * a dependency on any icon package.
 *
 * The shape mirrors `portalContainer.tsx` / `stacking.tsx`: an inert default, a
 * hook, and a provider. The default is an empty override map, so a consumer who
 * does nothing gets the bespoke set exactly as before. Each internal call site
 * keeps statically importing its bespoke default and passes it as `fallback`,
 * which is what preserves tree-shaking: no module here references an icon, and
 * the only icons in a bundle are the fallbacks of the call sites it reaches.
 *
 * It composes with `PopOut` for free: `PopOut` re-renders its children through
 * `createPortal` preserving the React parent chain, so a root `IconProvider`
 * resolves inside a popped-out window with no change here.
 */

/** The semantic icon names the library renders internally and commits to as
 *  public API. Scope is exactly the glyphs drawn as SVG (plus the window-chrome
 *  set), not one slot per bespoke export. **Append-only**: adding a slot is
 *  additive (consumer maps are `Partial`, the new call site ships a fallback);
 *  renaming or removing one is the only breaking change. */
export const SF_ICON_SLOTS = [
  // Chevrons (directional — glyph-named)
  "chevronUp",
  "chevronDown",
  "chevronLeft",
  "chevronRight",
  // Window chrome
  "close",
  "expand",
  "collapse",
  "split",
  "popOut",
  "popIn",
  // Viewport / canvas controls
  "zoomIn",
  "zoomOut",
  "fit",
  "reset",
  "connect",
  // Actions (role-named)
  "add",
  "delete",
  "search",
  "check",
  "menu",
  // Overflow / drag (geometry-named — distinct affordances, 1:1 with external libs)
  "moreHorizontal",
  "moreVertical",
  // Domain
  "eye",
  "eyeOff",
  "lock",
  "folder",
  "file",
  "eyedropper",
] as const;

/** One of the library's overridable icon slots. */
export type IconSlot = (typeof SF_ICON_SLOTS)[number];

/** The minimal render contract every internal call site passes. The bespoke
 *  `IconComponent` (props all optional) is assignable to it, and so is an
 *  adapter over an external icon. `size` follows `Icon.tsx` exactly: a number is
 *  a `--sf-unit` multiple, a string is a raw CSS length. */
export interface IconRenderProps {
  size?: number | string;
  label?: string;
  strokeWidth?: number;
  className?: string;
}

/** A component that renders one glyph — the bespoke default or a swapped-in one. */
export type IconRenderer = ComponentType<IconRenderProps>;

/** A per-slot override map. `Partial`, so a consumer maps only the slots they
 *  care about and the rest stay bespoke. */
export type IconOverrides = Partial<Record<IconSlot, IconRenderer>>;

const NO_OVERRIDES: IconOverrides = Object.freeze({});
const IconContext = createContext<IconOverrides>(NO_OVERRIDES);

/** Resolve a slot to its renderer: the override if the nearest `IconProvider`
 *  supplies one, else the call site's bespoke `fallback`. Pass the bespoke icon
 *  as `fallback` (a static import) so it still tree-shakes. */
export function useIcon(slot: IconSlot, fallback: IconRenderer): IconRenderer {
  return useContext(IconContext)[slot] ?? fallback;
}

/** The full override map from the nearest provider. An escape hatch for building
 *  parts outside a component body; most call sites want {@link useIcon}. */
export function useIconOverrides(): IconOverrides {
  return useContext(IconContext);
}

/** Resolve `slot` and render it with `props`. The recommended call-site form:
 *  because it calls the hook *inside itself*, each usage is a single inline JSX
 *  node with no hoisted-hook constraint — which matters in chrome components
 *  that render many glyphs behind early returns (a bare `useIcon` there would
 *  risk the rules-of-hooks ordering). */
export function Glyph({
  slot,
  fallback,
  ...props
}: { slot: IconSlot; fallback: IconRenderer } & IconRenderProps): ReactNode {
  const Resolved = useIcon(slot, fallback);
  return <Resolved {...props} />;
}

/** Redirect library glyphs for a subtree. Nested providers compose (the child
 *  wins per slot), so a consumer can retheme globally and re-skin one panel. */
export function IconProvider({
  icons,
  children,
}: {
  icons: IconOverrides;
  children: ReactNode;
}): ReactNode {
  const parent = useContext(IconContext);
  const merged = useMemo(
    () => (parent === NO_OVERRIDES ? icons : { ...parent, ...icons }),
    [parent, icons],
  );
  return <IconContext.Provider value={merged}>{children}</IconContext.Provider>;
}
