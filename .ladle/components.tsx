import type { GlobalProvider } from "@ladle/react";
import { useEffect, useState } from "react";
import { GridOverlay } from "../src/components/GridOverlay";
import "../src/tokens/tokens.css";
import "../src/tokens/reset.css";
import "../src/tokens/fonts.css";
import { storyDocs } from "./storyDocs";

export const Provider: GlobalProvider = ({ children, globalState }) => {
  const theme = globalState.theme === "dark" ? "dark" : "light";
  // A per-story caption above the story, from storyDocs. Hidden in preview mode
  // (?mode=preview) so VRT screenshots and clean embeds stay untouched.
  const isPreview =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mode") === "preview";
  // `?density=comfortable` renders the story at the roomier density (the
  // default is compact); see tokens.css, Density.
  const density =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("density")
      : null;
  const doc = storyDocs[globalState.story];
  // The unit grid over the story (GridOverlay): `?grid` turns it on (`?grid=2`
  // for 2u cells), `&mark=3:2-5:10,7:1` outlines places by name, and
  // Alt+Shift+G toggles it. The story's top left is 1:1.
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const gridParam = params?.get("grid") ?? null;
  const [grid, setGrid] = useState(gridParam != null);
  const gridCell = Math.max(1, Number(gridParam) || 1);
  const marks = (params?.get("mark") ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyG") {
        e.preventDefault();
        setGrid((on) => !on);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div
      data-theme={theme}
      data-density={density === "comfortable" || density === "compact" ? density : undefined}
      style={{
        padding: "2rem",
        minHeight: "100vh",
        background: "var(--sf-color-bg)",
        color: "var(--sf-color-fg)",
        fontFamily: "var(--sf-font-sans)",
      }}
    >
      {!isPreview && doc ? (
        <p
          style={{
            maxWidth: "var(--sf-measure)",
            margin: "0 0 calc(var(--sf-unit) * 1.5)",
            paddingBottom: "calc(var(--sf-unit) / 2)",
            borderBottom: "1px solid var(--sf-color-border)",
            color: "var(--sf-color-fg)",
            fontSize: "var(--sf-font-size-sm)",
            lineHeight: "var(--sf-line-height-grid)",
          }}
        >
          {doc}
        </p>
      ) : null}
      <div style={{ position: "relative" }}>
        {children}
        {grid ? <GridOverlay cell={gridCell} marks={marks} /> : null}
      </div>
    </div>
  );
};
