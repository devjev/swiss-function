import type { GlobalProvider } from "@ladle/react";
import "../src/tokens/tokens.css";
import "../src/tokens/reset.css";
import { storyDocs } from "./storyDocs";

export const Provider: GlobalProvider = ({ children, globalState }) => {
  const theme = globalState.theme === "dark" ? "dark" : "light";
  // A per-story caption above the story, from storyDocs. Hidden in preview mode
  // (?mode=preview) so VRT screenshots and clean embeds stay untouched.
  const isPreview =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mode") === "preview";
  const doc = storyDocs[globalState.story];
  return (
    <div
      data-theme={theme}
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
            lineHeight: "var(--sf-line-height-base)",
          }}
        >
          {doc}
        </p>
      ) : null}
      {children}
    </div>
  );
};
