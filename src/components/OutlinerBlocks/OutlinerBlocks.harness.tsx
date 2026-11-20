import { useMemo, useState } from "react";
import { Outliner, type OutlinerValue } from "../Outliner";
import { flatVisible } from "../Outliner/tree";
import { searchBlocks } from "./data";
import {
  createCodeBlockType,
  createDataBlockType,
  createDiagramBlockType,
  createLinkPreviewBlockType,
  createMathBlockType,
  createQueryBlockType,
} from "./OutlinerBlocks";

let minted = 0;

// How often the query ran, for the spec that types beside it.
const counted = globalThis as { queryRuns?: number };

// Math runs on KaTeX, the default. The others are stand-ins for the engines
// an app would bring: each is enough to show that the block hands its source
// over and shows what comes back.
const TYPES = [
  createQueryBlockType({
    run: (query, tree) => {
      counted.queryRuns = (counted.queryRuns ?? 0) + 1;
      return searchBlocks(tree, query);
    },
  }),
  createMathBlockType(),
  createDiagramBlockType({
    render: async (source) =>
      `<svg viewBox="0 0 100 20" width="100" height="20"><title>${source.replace(/</g, "&lt;")}</title><rect width="100" height="20" /></svg>`,
  }),
  createDataBlockType({ maxRows: 3 }),
  createLinkPreviewBlockType({
    fetch: async (url) =>
      url.includes("unknown") ? null : { title: "Example Domain", description: "For examples." },
  }),
  createCodeBlockType(),
];

// The visible tree is printed below the outline, one `depth id:content` line
// per block (line breaks shown as `⏎`), and new blocks get ids n1, n2, ...
export function OutlinerBlocksHarness({
  initial,
  commands,
}: {
  initial: OutlinerValue;
  commands?: boolean;
}) {
  const [value, setValue] = useState<OutlinerValue>(initial);
  const [ran, setRan] = useState("");
  const completions = useMemo(
    () =>
      ({ trigger, query }: { trigger: string; query: string }) =>
        trigger === "/" && "stamp".startsWith(query)
          ? [
              {
                label: "stamp",
                description: "An action of the app's",
                onSelect: ({ blockId }: { blockId: string }) => setRan(blockId),
              },
            ]
          : [],
    [],
  );
  return (
    <div style={{ inlineSize: 560 }}>
      <Outliner
        value={value}
        onChange={setValue}
        blockTypes={TYPES}
        commands={commands}
        completions={completions}
        generateId={() => `n${++minted}`}
      />
      <pre data-testid="tree">
        {flatVisible(value)
          .map(
            (f) =>
              `${f.depth} ${/^n\d+$/.test(f.id) ? "new" : f.id}:${f.bullet.content.replace(/\n/g, "⏎")}`,
          )
          .join("\n")}
      </pre>
      <output data-testid="ran">{ran}</output>
    </div>
  );
}
