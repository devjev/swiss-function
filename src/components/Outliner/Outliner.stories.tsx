import type { Story } from "@ladle/react";
import { useState } from "react";
import { Outliner } from "./Outliner";
import type { OutlinerValue } from "./types";

const SAMPLE: OutlinerValue = [
  {
    id: "1",
    content: "**Engineering** — *the people who build*",
    children: [
      { id: "1.1", content: "Alice" },
      {
        id: "1.2",
        content: "Bob",
        children: [
          { id: "1.2.1", content: "Bob's notes on `useEffect`" },
          { id: "1.2.2", content: "Bob's todo: review PR" },
        ],
      },
    ],
  },
  {
    id: "2",
    content: "Sales",
    children: [
      { id: "2.1", content: "Carol" },
      {
        id: "2.2",
        content: "Dan",
        collapsed: true,
        children: [{ id: "2.2.1", content: "hidden" }],
      },
    ],
  },
  { id: "3", content: "Design — see also [[Team Brand Guide]]" },
];

export const ReadOnly: Story = () => (
  <div style={{ maxWidth: "calc(var(--sf-unit) * 30)" }}>
    <Outliner value={SAMPLE} onChange={() => {}} readOnly />
  </div>
);

export const Editable: Story = () => {
  const [value, setValue] = useState<OutlinerValue>(SAMPLE);
  return (
    <div style={{ maxWidth: "calc(var(--sf-unit) * 30)" }}>
      <p style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
        Click a bullet to focus, ↑/↓ to nav, ←/→ to collapse/expand. Double-click or Enter/F2 to
        edit. Tab/Shift+Tab indent/outdent. Cmd+Shift+↑/↓ to reorder. Cmd+Enter in editor commits +
        creates a new sibling.
      </p>
      <Outliner value={value} onChange={setValue} />
    </div>
  );
};

export const WikiLinks: Story = () => {
  const [value, setValue] = useState<OutlinerValue>([
    { id: "1", content: "Meeting notes — see [[Project Alpha]] and [[Daily/2026-06-03]]" },
    { id: "2", content: "Backlog references [[Project Alpha]]" },
    { id: "3", content: "Random thought" },
  ]);
  const [log, setLog] = useState<string[]>([]);
  return (
    <div style={{ maxWidth: "calc(var(--sf-unit) * 30)" }}>
      <p style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
        Click wiki links to log their names.
      </p>
      <Outliner
        value={value}
        onChange={setValue}
        onWikiLinkClick={(name) => setLog((l) => [...l, name])}
      />
      <pre style={{ fontSize: "var(--sf-font-size-xs)", color: "var(--sf-color-muted)" }}>
        clicks: {log.join(", ")}
      </pre>
    </div>
  );
};

export const BlockRefs: Story = () => {
  const initial: OutlinerValue = [
    { id: "src", content: "**The source bullet** that gets referenced." },
    { id: "a", content: "Body of A, which transcludes: ((src))" },
    { id: "b", content: "Another bullet that also refs ((src))" },
    { id: "c", content: "And one that points at a missing id: ((nope))" },
  ];
  const [value, setValue] = useState<OutlinerValue>(initial);
  const resolveBlockRef = (id: string) => {
    const findInTree = (list: typeof value, target: string): string | null => {
      for (const b of list) {
        if (b.id === target) return b.content;
        if (b.children) {
          const c = findInTree(b.children, target);
          if (c != null) return c;
        }
      }
      return null;
    };
    return findInTree(value, id);
  };
  return (
    <div style={{ maxWidth: "calc(var(--sf-unit) * 30)" }}>
      <p style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
        ((id)) transcludes the referenced bullet. Edit "The source bullet" — references update.
      </p>
      <Outliner value={value} onChange={setValue} resolveBlockRef={resolveBlockRef} />
    </div>
  );
};
