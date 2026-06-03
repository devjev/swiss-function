import type { MouseEvent, ReactElement } from "react";
import styles from "./TreeChevron.module.css";

interface TreeChevronProps {
  expanded: boolean;
  /** When false, render an inert spacer of the same width so siblings line up. */
  visible?: boolean;
  /** Click handler. Should toggle expansion. */
  onToggle: () => void;
  ariaLabel?: string;
}

export function TreeChevron({
  expanded,
  visible = true,
  onToggle,
  ariaLabel,
}: TreeChevronProps): ReactElement {
  if (!visible) {
    return <span className={styles.chevronSlot} aria-hidden="true" />;
  }
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onToggle();
  };
  return (
    <button
      type="button"
      className={styles.chevron}
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={ariaLabel ?? (expanded ? "Collapse" : "Expand")}
      aria-expanded={expanded}
    >
      {/* SVG triangle — geometrically centered in its viewBox. Avoids the
          off-center rendering Unicode ▾/▸ glyphs have in many fonts. */}
      <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
        {expanded ? (
          <path d="M1.5 3.5 L5 7 L8.5 3.5 Z" fill="currentColor" />
        ) : (
          <path d="M3.5 1.5 L7 5 L3.5 8.5 Z" fill="currentColor" />
        )}
      </svg>
    </button>
  );
}
