import type { GlobalProvider } from "@ladle/react";
import "../src/tokens/tokens.css";
import "../src/tokens/reset.css";

export const Provider: GlobalProvider = ({ children, globalState }) => {
  const theme = globalState.theme === "dark" ? "dark" : "light";
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
      {children}
    </div>
  );
};
