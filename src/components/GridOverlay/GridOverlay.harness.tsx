import { useState } from "react";
import { GridOverlay, type GridOverlayProps } from "./GridOverlay";

/** A positioned region 20 by 12 units with a key under the overlay, a line of
 *  body text at its top, and the picks written beside it. */
export function OverlayHarness(props: Omit<GridOverlayProps, "onPick"> & { density?: string }) {
  const { density, ...rest } = props;
  const [picks, setPicks] = useState<string[]>([]);
  const [presses, setPresses] = useState(0);
  return (
    <div data-density={density} style={{ fontFamily: "var(--sf-font-sans)" }}>
      <div
        data-testid="region"
        style={{
          position: "relative",
          inlineSize: "calc(var(--sf-unit) * 20)",
          blockSize: "calc(var(--sf-unit) * 12)",
        }}
      >
        <p
          data-testid="line"
          style={{
            margin: 0,
            fontSize: "var(--sf-font-size-md)",
            lineHeight: "var(--sf-leading-base)",
          }}
        >
          Body text
          <span data-testid="baseline-mark" style={{ display: "inline-block" }} />
        </p>
        <button
          type="button"
          style={{ position: "absolute", top: 60, left: 60 }}
          onClick={() => setPresses((n) => n + 1)}
        >
          under
        </button>
        <GridOverlay {...rest} onPick={(p) => setPicks((prev) => [...prev, p.text])} />
      </div>
      <output data-testid="picks">{picks.join(",")}</output>
      <output data-testid="presses">{presses}</output>
    </div>
  );
}
