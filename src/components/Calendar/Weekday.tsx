import { cx } from "../../lib/cx";
import styles from "./Calendar.module.css";
import { weekdayLabels } from "./calendarLayout";

const SHORT = weekdayLabels("short");
const NARROW = weekdayLabels("narrow");

/**
 * A weekday's name for a column heading, Monday-first (`index` 0 is Monday).
 * Two spans: the short name ("Wed") and its initial ("W"). The stylesheet
 * shows the one that fits the heading cell (the nearest size container) and
 * collapses the other to no width. The short name stays in the accessibility
 * tree either way; the initial is decoration.
 */
export function Weekday({ index, className }: { index: number; className?: string }) {
  return (
    <>
      <span className={cx(styles.dowShort, className)}>{SHORT[index]}</span>
      <span className={cx(styles.dowInitial, className)} aria-hidden="true">
        {NARROW[index]}
      </span>
    </>
  );
}
