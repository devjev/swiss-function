import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import { useFullscreen } from "../../lib/useFullscreen";
import styles from "./Fullscreen.module.css";

export type FullscreenButtonPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";

const ExpandIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the button carries the label
  <svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
  >
    <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" strokeLinecap="square" />
  </svg>
);

const CollapseIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the button carries the label
  <svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
  >
    <path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4" strokeLinecap="square" />
  </svg>
);

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
      {expanded ? <CollapseIcon /> : <ExpandIcon />}
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
    children,
    ...rest
  },
  ref,
) {
  const { expanded, toggle } = useFullscreen({
    expanded: controlled,
    defaultExpanded,
    onExpandedChange,
  });

  return (
    <div
      ref={ref}
      data-expanded={expanded || undefined}
      className={cx(styles.root, expanded && styles.expanded, className)}
      {...rest}
    >
      <div className={styles.content}>{children}</div>
      <FullscreenToggle expanded={expanded} onToggle={toggle} position={buttonPosition} />
    </div>
  );
});
