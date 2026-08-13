import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef, useRef } from "react";
import { cx } from "../../lib/cx";
import { Glyph } from "../../lib/icons";
import { mergeRefs } from "../../lib/mergeRefs";
import { StackingProvider, useStackLayer, Z_LAYER } from "../../lib/stacking";
import { useFullscreen } from "../../lib/useFullscreen";
import { Collapse, Expand } from "../Icon";
import styles from "./Fullscreen.module.css";

export type FullscreenButtonPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";

/** Window-chrome glyph size. `--sf-unit` is 24px, so 14px is off-grid; a raw
 *  length holds the chrome's established geometry exactly. */
const CHROME_ICON_SIZE = "14px";

export interface FullscreenToggleProps {
  expanded: boolean;
  onToggle: () => void;
  /** Corner the button sits in. Default `"top-right"`. */
  position?: FullscreenButtonPosition;
  className?: string;
}

/** The fullscreen toggle button (icon + a11y), reusable by any component that
 *  drives its own maximize via `useFullscreen` (e.g. `Graph`). */
export function FullscreenToggle({
  expanded,
  onToggle,
  position = "top-right",
  className,
}: FullscreenToggleProps) {
  return (
    <button
      type="button"
      className={cx(styles.toggle, styles[position], className)}
      onClick={onToggle}
      aria-label={expanded ? "Exit fullscreen" : "Enter fullscreen"}
      aria-pressed={expanded}
    >
      {expanded ? (
        <Glyph slot="collapse" fallback={Collapse} size={CHROME_ICON_SIZE} />
      ) : (
        <Glyph slot="expand" fallback={Expand} size={CHROME_ICON_SIZE} />
      )}
    </button>
  );
}

export interface FullscreenProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Controlled expanded state. Omit for uncontrolled. */
  expanded?: boolean;
  /** Initial expanded state when uncontrolled. Default `false`. */
  defaultExpanded?: boolean;
  /** Called when the user toggles (button or Escape). */
  onExpandedChange?: (expanded: boolean) => void;
  /** Corner the toggle button sits in. Default `"top-right"`. */
  buttonPosition?: FullscreenButtonPosition;
  children?: ReactNode;
}

/** A container with a fullscreen toggle. When expanded it fills the browser
 *  viewport (a fixed overlay) and stretches its content to 100%; Escape exits.
 *  Not OS-level fullscreen — a CSS viewport overlay, so it works everywhere. */
export const Fullscreen = forwardRef<HTMLDivElement, FullscreenProps>(function Fullscreen(
  {
    expanded: controlled,
    defaultExpanded,
    onExpandedChange,
    buttonPosition = "top-right",
    className,
    style,
    children,
    ...rest
  },
  ref,
) {
  // Derive the Escape/scroll-lock document from the root, so a Fullscreen
  // inside a PopOut window works in that window (issue #84).
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { expanded, toggle } = useFullscreen({
    expanded: controlled,
    defaultExpanded,
    onExpandedChange,
    ownerRef: rootRef,
  });

  // Cross-portal stacking (issue #82): only while expanded is this a modal-band
  // overlay, so seed the band (and climb above a host overlay) then, not at rest.
  const layer = useStackLayer(Z_LAYER.modal, true);
  const rootStyle = expanded && layer.zIndex != null ? { ...style, zIndex: layer.zIndex } : style;

  return (
    <div
      ref={mergeRefs(ref, rootRef)}
      data-expanded={expanded || undefined}
      className={cx(styles.root, expanded && styles.expanded, className)}
      style={rootStyle}
      {...rest}
    >
      <div className={styles.content}>
        {expanded ? (
          <StackingProvider ceiling={layer.ceiling}>{children}</StackingProvider>
        ) : (
          children
        )}
      </div>
      <FullscreenToggle expanded={expanded} onToggle={toggle} position={buttonPosition} />
    </div>
  );
});
