import type { Story } from "@ladle/react";
import { Kbd } from "./Kbd";

export default { title: "Kbd" };

const COMBOS = ["mod+k", "mod+shift+p", "alt+enter", "mod+/", "shift+arrowup", "esc"];

function Row({ label, mac }: { label: string; mac?: boolean }) {
  return (
    <div>
      <p style={{ margin: "0 0 0.35rem", color: "var(--sf-color-fg-subtle)" }}>{label}</p>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        {COMBOS.map((c) => (
          <Kbd key={c} combo={c} mac={mac} />
        ))}
      </div>
    </div>
  );
}

/** The same combos rendered for the current OS, then forced macOS vs Windows/Linux
 *  to show the platform-aware glyphs (`mod` → ⌘ vs Ctrl). */
export const Default: Story = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 640 }}>
    <Row label="Auto-detected (your OS)" />
    <Row label="macOS" mac />
    <Row label="Windows / Linux" mac={false} />
  </div>
);

/** Inline in labels / menu rows. */
export const InContext: Story = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "0.5rem",
      maxWidth: 320,
      fontFamily: "var(--sf-font-sans)",
    }}
  >
    {(
      [
        ["Command palette", "mod+k"],
        ["New chat", "mod+shift+n"],
        ["Send message", "mod+enter"],
      ] as const
    ).map(([label, combo]) => (
      <div
        key={combo}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span>{label}</span>
        <Kbd combo={combo} />
      </div>
    ))}
  </div>
);
