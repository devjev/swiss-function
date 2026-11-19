import { useState } from "react";
import { Outliner } from "./Outliner";
import { flatVisible } from "./tree";
import type { OutlinerValue } from "./types";

interface HarnessProps {
  initial: OutlinerValue;
  readOnly?: boolean;
  /** A registry of bullet content for block-ref resolution. */
  blockRefs?: Record<string, string>;
  /** Width of the outline in px (to force soft wraps). */
  width?: number;
}

let minted = 0;

// Playwright CT mounts must be top-level component invocations; this harness
// owns the controlled value so specs can drive interactions. The visible tree
// is printed below the outline, one `depth id:content` line per block, and new
// blocks get predictable ids (n1, n2, ...).
export function OutlinerHarness({ initial, readOnly, blockRefs, width }: HarnessProps) {
  const [value, setValue] = useState<OutlinerValue>(initial);
  const [changes, setChanges] = useState(0);
  return (
    <div style={{ inlineSize: width }}>
      <button type="button" data-testid="before">
        before
      </button>
      <Outliner
        value={value}
        onChange={(next) => {
          setValue(next);
          setChanges((n) => n + 1);
        }}
        readOnly={readOnly}
        generateId={() => `n${++minted}`}
        resolveBlockRef={blockRefs ? (id) => blockRefs[id] ?? null : undefined}
      />
      <button type="button" data-testid="after">
        after
      </button>
      <pre data-testid="tree">
        {flatVisible(value)
          .map((f) => `${f.depth} ${/^n\d+$/.test(f.id) ? "new" : f.id}:${f.bullet.content}`)
          .join("\n")}
      </pre>
      <output data-testid="changes">{changes}</output>
    </div>
  );
}
