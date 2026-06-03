import { useState } from "react";
import { Outliner } from "./Outliner";
import type { OutlinerValue } from "./types";

interface HarnessProps {
  initial: OutlinerValue;
  readOnly?: boolean;
  /** A registry of bullet content for block-ref resolution. */
  blockRefs?: Record<string, string>;
}

// Playwright CT mounts must be top-level component invocations; this harness
// owns the controlled value so specs can drive interactions.
export function OutlinerHarness({ initial, readOnly, blockRefs }: HarnessProps) {
  const [value, setValue] = useState<OutlinerValue>(initial);
  return (
    <Outliner
      value={value}
      onChange={setValue}
      readOnly={readOnly}
      resolveBlockRef={blockRefs ? (id) => blockRefs[id] ?? null : undefined}
    />
  );
}
