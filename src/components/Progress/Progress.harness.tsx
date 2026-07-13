import { Progress, type ProgressProps } from "./Progress";

/**
 * Thin mount wrapper for CT specs: renders `Progress` inside a fixed-width box
 * so the track has a definite width to fill and measure against.
 */
export function ProgressHarness({ width = 240, ...props }: ProgressProps & { width?: number }) {
  return (
    <div style={{ inlineSize: width }}>
      <Progress {...props} />
    </div>
  );
}
