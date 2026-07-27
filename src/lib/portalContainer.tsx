import { createContext, type ReactNode, useContext } from "react";

/**
 * Cross-document portal container for floating layers (issue #84 M3).
 *
 * Base UI floaters (menus, popovers, calendars, comboboxes) portal to their
 * document's `<body>` by default. That is right at the app root, but wrong
 * inside a `PopOut` window: the floater's React tree lives in the popped-out
 * document, yet Base UI's default container is the *opener's* body, so the
 * floater renders back in the main window where nobody can see it.
 *
 * `PopOut` publishes its own document body through this context (which follows
 * the React tree, so it survives the cross-document portal, the same trick as
 * `stacking.tsx`). Each overlay reads it and passes it to its Base UI
 * `Portal`/`Positioner` `container`. The default is `null`, which Base UI
 * treats as "use the default body", so at the app root every overlay behaves
 * exactly as before, byte for byte.
 */
const PortalContainerContext = createContext<HTMLElement | null>(null);

/** The element library overlays should portal into, or `null` at the app root
 *  (Base UI then uses the document body). Pass straight to a Base UI
 *  `Portal`/`Positioner` `container`; `null` preserves the default. */
export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext);
}

/** Publish `container` to descendant overlays. `PopOut` wraps its portalled
 *  children with its own document body. */
export function PortalContainerProvider({
  container,
  children,
}: {
  container: HTMLElement | null;
  children: ReactNode;
}): ReactNode {
  return (
    <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>
  );
}
