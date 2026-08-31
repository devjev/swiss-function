import type { ReactNode } from "react";
import { useState } from "react";
import { Timeline, type TimelineProps } from "./Timeline";

/**
 * Stateful wrapper for CT specs: drives the playhead as controlled state so
 * scrub interactions render their effects (snap emphasis, value labels).
 */
export function TimelineScrubHarness({
  initial,
  children,
  ...rest
}: Omit<TimelineProps, "value" | "onChange" | "children"> & {
  initial: Date;
  children?: ReactNode;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Timeline {...rest} value={value} onChange={setValue}>
      {children}
    </Timeline>
  );
}
