import { useRef } from "react";
import { useThemeEpoch } from "./useThemeEpoch";

/** Probe for the CT spec: renders the epoch the hook reports for its own
 *  subtree. The token values are mapped from `data-theme` by an inline <style>,
 *  so flipping the attribute on an ancestor changes the resolved
 *  --sf-color-bg/fg the hook watches. A canvas renderer would key its draw
 *  effect on this number. (Must live outside the .spec file — Playwright CT
 *  compiles mounted components from the harness bundle.) */
export function ThemeEpochProbe({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const epoch = useThemeEpoch(ref, enabled);
  return (
    <div ref={ref}>
      <style>{`
        [data-theme="light"] { --sf-color-bg: #ffffff; --sf-color-fg: #0a0a0a; }
        [data-theme="dark"]  { --sf-color-bg: #0a0a0a; --sf-color-fg: #fafafa; }
      `}</style>
      <output data-testid="epoch">{epoch}</output>
    </div>
  );
}
