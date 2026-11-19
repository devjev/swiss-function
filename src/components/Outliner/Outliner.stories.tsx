import type { Story } from "@ladle/react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "../Button";
import { Kbd } from "../Kbd";
import { Outliner } from "./Outliner";
import type {
  OutlinerCompletion,
  OutlinerCompletionRequest,
  OutlinerHandle,
  OutlinerValue,
} from "./types";

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
  ["mod+.", "Zoom into the block (Mod+, zooms out; a click on a bullet zooms too)"],
];

export const Editable: Story = () => {
  const [value, setValue] = useState<OutlinerValue>(SAMPLE);
  return (
    <div style={frame}>
      <Note>
        Click into any block and type. The arrow keys move through the outline as through one
        document. Drag from one block into another to select several; copy and paste carry them as a
        markdown list. Drag a bullet to move its block: how far right the pointer is sets the depth.
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

const PAGES = ["Project Alpha", "Project Beta", "Team Brand Guide", "Daily/2026-11-19"];
const COMMANDS: OutlinerCompletion[] = [
  { label: "today", description: "Today's date", insert: "2026-11-19" },
  { label: "tomorrow", description: "Tomorrow's date", insert: "2026-11-20" },
  { label: "review", description: "A review checklist line", insert: "[ ] Review with [[Alice]]" },
];

function allBlocks(list: OutlinerValue): OutlinerCompletion[] {
  return list.flatMap((b) => [
    { label: b.content, description: `Block ${b.id}`, insert: b.id },
    ...allBlocks(b.children ?? []),
  ]);
}

/** Tasks, tags and completion. The outline knows no pages or commands: the
 *  app answers `completions` for `[[`, `((`, `#` and `/`. */
export const Assisted: Story = () => {
  const [value, setValue] = useState<OutlinerValue>([
    {
      id: "plan",
      content: "Release plan for [[Project Alpha]] #planning",
      children: [
        { id: "t1", content: "[x] Freeze the API" },
        { id: "t2", content: "[ ] Write the **migration** notes" },
        { id: "t3", content: "[ ] Tag and publish" },
      ],
    },
    { id: "try", content: "Type [[ or (( or # or / here" },
  ]);
  const completions = useCallback(
    ({ trigger, query }: OutlinerCompletionRequest): OutlinerCompletion[] => {
      const q = query.toLowerCase();
      if (trigger === "/") return COMMANDS.filter((c) => c.label.startsWith(q));
      if (trigger === "((") {
        return allBlocks(value).filter((b) => b.label.toLowerCase().includes(q));
      }
      return PAGES.filter((name) => name.toLowerCase().includes(q)).map((label) => ({ label }));
    },
    [value],
  );
  const resolveBlockRef = useCallback((id: string) => findContent(value, id), [value]);
  return (
    <div style={frame}>
      <Note>
        Brackets close themselves and wrap a selection. Mod+B, Mod+I and Mod+K format; Mod+Enter
        makes a block a task and ticks it. Typing [[, ((, # or / opens a list the app fills.
      </Note>
      <Outliner
        value={value}
        onChange={setValue}
        completions={completions}
        resolveBlockRef={resolveBlockRef}
        aria-label="Release plan"
      />
    </div>
  );
};

/** Zoomed on one block: it is the title, its children the first level, and
 *  the breadcrumb lists the way back. */
export const Zoomed: Story = () => {
  const [value, setValue] = useState<OutlinerValue>(SAMPLE);
  const [root, setRoot] = useState<string | null>("1.2");
  return (
    <div style={frame}>
      <Note>
        A click on a bullet zooms into its block. The breadcrumb, Mod+, and Alt+Left lead back.
        Zoomed on: {root ?? "the whole outline"}.
      </Note>
      <Outliner value={value} onChange={setValue} root={root} onRootChange={setRoot} />
    </div>
  );
};

/** No frame, for an outline that is the page. */
export const Frameless: Story = () => {
  const [value, setValue] = useState<OutlinerValue>(SAMPLE);
  return (
    <div style={frame}>
      <Outliner value={value} onChange={setValue} frame={false} aria-label="Team" />
    </div>
  );
};

/** 5000 blocks in a box: only the rows on screen are rendered. The buttons
 *  drive the outline through `apiRef`. */
export const Virtualized: Story = () => {
  const initial = useMemo<OutlinerValue>(
    () =>
      Array.from({ length: 500 }, (_, section) => ({
        id: `s${section}`,
        content: `Section ${section + 1}`,
        children: Array.from({ length: 9 }, (_, item) => ({
          id: `s${section}.${item}`,
          content:
            item === 4
              ? `Item ${item + 1}, a longer one that wraps onto a second line at this width so the rows do not all share one height`
              : `Item ${item + 1} of section ${section + 1}`,
        })),
      })),
    [],
  );
  const [value, setValue] = useState<OutlinerValue>(initial);
  const api = useRef<OutlinerHandle>(null);
  return (
    <div style={frame}>
      <Note>5000 blocks. The outline scrolls inside its own height.</Note>
      <div
        style={{
          display: "flex",
          gap: "calc(var(--sf-unit) / 2)",
          marginBlockEnd: "calc(var(--sf-unit) / 2)",
        }}
      >
        <Button size="sm" onClick={() => api.current?.edit("s250.4", 0)}>
          Edit section 251, item 5
        </Button>
        <Button size="sm" onClick={() => api.current?.select("s499")}>
          Select the last section
        </Button>
      </div>
      <Outliner
        value={value}
        onChange={setValue}
        virtualized
        apiRef={api}
        style={{ blockSize: "calc(var(--sf-unit) * 20)" }}
        aria-label="A long outline"
      />
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
