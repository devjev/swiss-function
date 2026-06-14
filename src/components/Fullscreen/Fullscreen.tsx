import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef, useCallback, useEffect, useState } from "react";
import { cx } from "../../lib/cx";
import styles from "./Fullscreen.module.css";

export type FullscreenButtonPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";

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

/** A container with a fullscreen toggle. When expanded it fills the browser
 *  viewport (a fixed overlay) and stretches its content to 100%; Escape exits.
 *  Not OS-level fullscreen — a CSS viewport overlay, so it works everywhere. */
export const Fullscreen = forwardRef<HTMLDivElement, FullscreenProps>(function Fullscreen(
  {
    expanded: controlled,
    defaultExpanded = false,
    onExpandedChange,
    buttonPosition = "top-right",
    className,
    children,
    ...rest
  },
  ref,
) {
  const [internal, setInternal] = useState(defaultExpanded);
  const expanded = controlled ?? internal;

  const setExpanded = useCallback(
    (next: boolean) => {
      if (controlled === undefined) setInternal(next);
      onExpandedChange?.(next);
    },
    [controlled, onExpandedChange],
  );

  // While expanded: Escape exits, and the page behind doesn't scroll.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [expanded, setExpanded]);

  return (
    <div
      ref={ref}
      data-expanded={expanded || undefined}
      className={cx(styles.root, expanded && styles.expanded, className)}
      {...rest}
    >
      <div className={styles.content}>{children}</div>
      <button
        type="button"
        className={cx(styles.toggle, styles[buttonPosition])}
        onClick={() => setExpanded(!expanded)}
        aria-label={expanded ? "Exit fullscreen" : "Enter fullscreen"}
        aria-pressed={expanded}
      >
        {expanded ? <CollapseIcon /> : <ExpandIcon />}
      </button>
    </div>
  );
});
