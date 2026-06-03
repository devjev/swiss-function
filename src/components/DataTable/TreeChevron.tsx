import type { MouseEvent, ReactElement } from "react";
import styles from "./DataTable.module.css";

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
      {expanded ? "▾" : "▸"}
    </button>
  );
}
