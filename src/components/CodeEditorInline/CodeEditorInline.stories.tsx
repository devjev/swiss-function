import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import type { Story } from "@ladle/react";
import { useMemo, useState } from "react";
import { CodeEditorInline } from "./CodeEditorInline";

const ONE_LINER = `const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);`;

const MULTILINE = `function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}`;

/** Rests as one line; click (or tab) into it to expand over the content below. */
export const Playground: Story = () => {
  const extensions = useMemo(() => [javascript()], []);
  return (
    <div style={{ maxWidth: "34rem", display: "grid", gap: "var(--sf-unit)" }}>
      <div style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-fg)" }}>
        Derived column
      </div>
      <CodeEditorInline defaultValue={ONE_LINER} extensions={extensions} />
      <p style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)", margin: 0 }}>
        The expanded editor floats over this paragraph instead of pushing it down.
      </p>
    </div>
  );
};

/** A collapsed multi-line value: line 1 shows highlighted; focus reveals the rest. */
export const Multiline: Story = () => {
  const extensions = useMemo(() => [javascript()], []);
  return (
    <div style={{ maxWidth: "34rem" }}>
      <CodeEditorInline defaultValue={MULTILINE} extensions={extensions} maxRows={6} />
    </div>
  );
};

/** In a dense form row — several editable expressions stacked. */
export const FormRows: Story = () => {
  const extensions = useMemo(() => [javascript()], []);
  const [rules, setRules] = useState([
    "row.nav > 0",
    "row.subs - row.reds",
    "Math.max(0, row.close - row.open)",
  ]);
  return (
    <div style={{ maxWidth: "30rem", display: "grid", gap: "calc(var(--sf-unit) / 2)" }}>
      {rules.map((r, i) => (
        <CodeEditorInline
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length demo list
          key={i}
          value={r}
          extensions={extensions}
          onChange={(v) => setRules((prev) => prev.map((p, j) => (j === i ? v : p)))}
        />
      ))}
    </div>
  );
};

/** JSON, and a taller cap. */
export const JsonValue: Story = () => {
  const extensions = useMemo(() => [json()], []);
  return (
    <div style={{ maxWidth: "34rem" }}>
      <CodeEditorInline
        defaultValue={`{ "id": "fund-a", "aum": 1240000, "active": true }`}
        extensions={extensions}
        maxRows={10}
      />
    </div>
  );
};

/** Standard height rungs — sm / md / lg scale the code font + padding together. */
export const Sizes: Story = () => {
  const extensions = useMemo(() => [javascript()], []);
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)", maxWidth: "30rem" }}>
      {(["sm", "md", "lg"] as const).map((s) => (
        <CodeEditorInline
          key={s}
          size={s}
          defaultValue={"row.subs - row.reds"}
          extensions={extensions}
        />
      ))}
    </div>
  );
};
