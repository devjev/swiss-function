import type { MouseEvent, ReactElement } from "react";
import { ChevronDown, ChevronRight } from "../components/Icon";
import { hitArea } from "./hitArea";
import { Glyph } from "./icons";
import styles from "./TreeChevron.module.css";

interface TreeChevronProps {
  expanded: boolean;
  /** When false, render an inert spacer of the same width so siblings line up. */
  visible?: boolean;
  /** Click handler. Should toggle expansion. */
  onToggle: () => void;
  ariaLabel?: string;
  /** Tab order of the toggle. A tree whose rows own the arrow keys passes -1,
   *  so the tree is one tab stop. */
  tabIndex?: number;
}

export function TreeChevron({
  expanded,
  visible = true,
  onToggle,
  ariaLabel,
  tabIndex,
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
      className={`${styles.chevron} ${hitArea.inline}`}
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={ariaLabel ?? (expanded ? "Collapse" : "Expand")}
      aria-expanded={expanded}
      tabIndex={tabIndex}
    >
      {/* Expand/collapse glyph routed through the chevron slots, so a consumer's
          `IconProvider` (Feather/Lucide/…) redirects the tree toggles too. The
          bespoke line chevrons are the fallback; CSS sizes them to the slot. */}
      {expanded ? (
        <Glyph slot="chevronDown" fallback={ChevronDown} className={styles.icon} />
      ) : (
        <Glyph slot="chevronRight" fallback={ChevronRight} className={styles.icon} />
      )}
    </button>
  );
}
