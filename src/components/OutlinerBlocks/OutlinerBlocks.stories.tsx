import type { Story } from "@ladle/react";
import { useState } from "react";
import { Outliner, type OutlinerValue } from "../Outliner";
import { searchBlocks } from "./data";
import {
  createCodeBlockType,
  createDataBlockType,
  createDiagramBlockType,
  createLinkPreviewBlockType,
  createMathBlockType,
  createQueryBlockType,
} from "./OutlinerBlocks";

const escapeMarkup = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** A stand-in for Mermaid: `a --> b --> c` as a row of boxes. An app passes
 *  `async (source) => (await mermaid.render(id, source)).svg`. */
function chain(source: string): string {
  const nodes = source
    .split(/-->|\n/)
    .map((n) => n.trim())
    .filter(Boolean);
  if (nodes.length === 0) throw new Error("nothing to draw");
  const w = 110;
  const boxes = nodes
    .map(
      (name, i) =>
        `<rect x="${i * (w + 30) + 1}" y="1" width="${w}" height="38" fill="none" stroke="currentColor"/>` +
        `<text x="${i * (w + 30) + w / 2}" y="25" text-anchor="middle" fill="currentColor" font-size="13">${escapeMarkup(name)}</text>` +
        (i > 0
          ? `<path d="M${i * (w + 30) - 28} 20h24m-6 -5l6 5l-6 5" fill="none" stroke="currentColor"/>`
          : ""),
    )
    .join("");
  const width = nodes.length * (w + 30) - 28;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 40" width="${width}" height="40">${boxes}</svg>`;
}

const PREVIEWS: Record<string, { title: string; description: string }> = {
  "https://example.com/handbook": {
    title: "The release handbook",
    description:
      "How a release is cut, checked and published, with the gates each one has to pass.",
  },
};

// Created once: the outline's rows depend on the array.
const TYPES = [
  createQueryBlockType({ run: (query, tree) => searchBlocks(tree, query) }),
  // KaTeX, the default.
  createMathBlockType(),
  createDiagramBlockType({ render: chain }),
  createDataBlockType(),
  createLinkPreviewBlockType({
    fetch: async (url) => PREVIEWS[url] ?? null,
  }),
  createCodeBlockType(),
];

/** The block types an app registers. Math runs on KaTeX; the diagram has a
 *  stand-in for the engine the app would bring. Type `/` in an empty block
 *  for the commands. */
export const RegisteredTypes: Story = () => {
  const [value, setValue] = useState<OutlinerValue>([
    {
      id: "plan",
      content: "## Release plan",
      children: [
        { id: "t1", content: "[x] Freeze the API" },
        { id: "t2", content: "[ ] Review the migration notes" },
        { id: "t3", content: "[ ] Publish, then review the size report" },
        {
          id: "t4",
          content:
            "The gate allows growth of $\\max(5\\%, 2\\,\\text{KB})$ per entry, so $\\Delta = 2.6$ KB passes at $45.5$ KB and a $5 fee is text.",
        },
      ],
    },
    { id: "q", content: "{{query review}}" },
    {
      id: "data",
      content: "```csv\nfund,aum,change\nAlpha,1284,2.1\nBeta,640,-0.4\nGamma,95,0.8\n```",
    },
    { id: "diagram", content: "```mermaid\nbuild --> gates --> publish\n```" },
    { id: "math", content: "$$ \\sigma = \\sqrt{\\frac{1}{N} \\sum_{i=1}^{N} (x_i - \\mu)^2} $$" },
    { id: "code", content: "```js\nconst gates = [check, typecheck, build];\n```" },
    { id: "link", content: "https://example.com/handbook" },
    { id: "new", content: "" },
  ]);
  return (
    <div style={{ maxWidth: "calc(var(--sf-unit) * 32)" }}>
      <p style={{ margin: "0 0 var(--sf-unit)" }}>
        A query, a data block, a diagram, math (as a block and inside a line), a code editor and a
        link preview, registered through blockTypes. The diagram uses a stand-in renderer here. In
        the last, empty block, type / for the block commands.
      </p>
      <Outliner
        value={value}
        onChange={setValue}
        blockTypes={TYPES}
        aria-label="Registered block types"
      />
    </div>
  );
};
