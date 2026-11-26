import { cx } from "./cx";
import styles from "./hitArea.module.css";

/** Which neighbours a control has, and so how far its touch hit area may
 *  grow: `both` axes to `--sf-hit-min` (a control with room around it),
 *  `block` (a control in a row of siblings: full height, tight width),
 *  `inline` (a control in a column of siblings: full width, tight height) or
 *  `tight` (neighbours on both axes: `--sf-hit-tight` each way).
 *
 *  Two more put the area on `::before`, for a host whose `::after` already
 *  draws something: `handle` (a splitter, a resize edge: `--sf-hit-tight`
 *  across, whichever way it runs) and `thumb` (a slider thumb: both axes to
 *  `--sf-hit-min`). */
export type HitArea = "both" | "block" | "inline" | "tight" | "handle" | "thumb";

/** Class names that grow a small control's touch hit area with an invisible
 *  `::after`, without changing its size. Both touch tokens are 0 for a mouse,
 *  so the classes change nothing there. Add one to an element that does not
 *  clip its overflow and whose `::after` is free:
 *
 *  ```tsx
 *  <button className={cx(styles.close, hitArea.both)} />
 *  ```
 */
export const hitArea: Record<HitArea, string> = {
  both: cx(styles.hit, styles.both),
  block: cx(styles.hit, styles.block),
  inline: cx(styles.hit, styles.inline),
  tight: cx(styles.hit, styles.tight),
  handle: cx(styles.hitBefore, styles.tight),
  thumb: cx(styles.hitBefore, styles.both),
};
