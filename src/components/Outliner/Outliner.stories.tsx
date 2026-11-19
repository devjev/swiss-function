import type { Story } from "@ladle/react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { Kbd } from "../Kbd";
import { Outliner } from "./Outliner";
import type { OutlinerValue } from "./types";

const SAMPLE: OutlinerValue = [
  {
    id: "1",
    content: "**Engineering**, *the people who build*",
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
  { id: "3", content: "Design, see also [[Team Brand Guide]]" },
  {
    id: "4",
    content:
      "A longer block, to show that the text wraps under itself and that the editor grows with it: entering this block changes nothing on screen but the caret.",
  },
];

const frame = { maxWidth: "calc(var(--sf-unit) * 30)" };

function Note({ children }: { children: ReactNode }) {
  return <p style={{ margin: "0 0 var(--sf-unit)" }}>{children}</p>;
}

export const ReadOnly: Story = () => (
  <div style={frame}>
    <Note>Click a block to select it. The arrows walk and fold the tree.</Note>
    <Outliner value={SAMPLE} onChange={() => {}} readOnly aria-label="Team" />
  </div>
);

const KEYS: Array<[string, string]> = [
  ["enter", "Split the block at the caret"],
  ["shift+enter", "A line break inside the block"],
  ["backspace", "At the start: merge into the block above"],
  ["tab", "Indent (Shift+Tab outdents)"],
  ["alt+shift+up", "Move the block (also down)"],
  ["mod+up", "Fold (Mod+Down unfolds)"],
  ["escape", "Leave the text; the block stays selected"],
  ["shift+down", "From a block's last line: select it, then the next (also up)"],
  ["mod+z", "Undo, text and structure alike (Mod+Shift+Z redoes)"],
];

export const Editable: Story = () => {
  const [value, setValue] = useState<OutlinerValue>(SAMPLE);
  return (
    <div style={frame}>
      <Note>
        Click into any block and type. The arrow keys move through the outline as through one
        document. Drag from one block into another to select several; copy and paste carry them as a
        markdown list.
      </Note>
      <Outliner value={value} onChange={setValue} aria-label="Team" />
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "calc(var(--sf-unit) / 4) var(--sf-unit)",
          margin: "var(--sf-unit) 0 0",
        }}
      >
        {KEYS.map(([combo, what]) => (
          <div key={combo} style={{ display: "contents" }}>
            <dt>
              <Kbd combo={combo} variant="outline" />
            </dt>
            <dd style={{ margin: 0 }}>{what}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export const Empty: Story = () => {
  const [value, setValue] = useState<OutlinerValue>([]);
  return (
    <div style={frame}>
      <Note>An empty outline starts with a click, or with Enter on the placeholder.</Note>
      <Outliner value={value} onChange={setValue} aria-label="Notes" />
    </div>
  );
};

export const WikiLinks: Story = () => {
  const [value, setValue] = useState<OutlinerValue>([
    { id: "1", content: "Meeting notes, see [[Project Alpha]] and [[Daily/2026-06-03]]" },
    { id: "2", content: "Backlog references [[Project Alpha]]" },
    { id: "3", content: "Random thought" },
  ]);
  const [log, setLog] = useState<string[]>([]);
  const onWikiLinkClick = useCallback((name: string) => setLog((l) => [...l, name]), []);
  return (
    <div style={frame}>
      <Note>
        Click a wiki link to log its name. A click on the text around it enters the block.
      </Note>
      <Outliner value={value} onChange={setValue} onWikiLinkClick={onWikiLinkClick} />
      <pre style={{ fontSize: "var(--sf-font-size-sm)" }}>clicks: {log.join(", ")}</pre>
    </div>
  );
};

function findContent(list: OutlinerValue, target: string): string | null {
  for (const b of list) {
    if (b.id === target) return b.content;
    const nested = b.children ? findContent(b.children, target) : null;
    if (nested != null) return nested;
  }
  return null;
}

export const BlockRefs: Story = () => {
  const [value, setValue] = useState<OutlinerValue>([
    { id: "src", content: "**The source bullet** that gets referenced." },
    { id: "a", content: "Body of A, which transcludes: ((src))" },
    { id: "b", content: "Another bullet that also refs ((src))" },
    { id: "c", content: "And one that points at a missing id: ((nope))" },
  ]);
  const resolveBlockRef = useCallback((id: string) => findContent(value, id), [value]);
  return (
    <div style={frame}>
      <Note>
        ((id)) transcludes the referenced bullet. Edit "The source bullet" and the references
        follow.
      </Note>
      <Outliner value={value} onChange={setValue} resolveBlockRef={resolveBlockRef} />
    </div>
  );
};
