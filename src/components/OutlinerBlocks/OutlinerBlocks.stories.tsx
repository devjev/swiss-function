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
import { renderMermaid } from "./OutlinerBlocks.fixtures";

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
  // Mermaid, a dev dependency here: an app passes its own the same way.
  createDiagramBlockType({ render: renderMermaid }),
  createDataBlockType(),
  createLinkPreviewBlockType({
    fetch: async (url) => PREVIEWS[url] ?? null,
  }),
  createCodeBlockType(),
];

/** The block types an app registers. Math runs on KaTeX, the diagram on
 *  Mermaid (which the app brings). Type `/` in an empty block for the
 *  commands. */
export const RegisteredTypes: Story = () => {
  const [value, setValue] = useState<OutlinerValue>([
    {
      id: "plan",
      content: "## Release plan for $v_{3.1}$",
      children: [
        { id: "t1", content: "[x] Freeze the API" },
        { id: "t2", content: "[ ] Review the migration notes" },
        { id: "t3", content: "[ ] Publish, then review the size report" },
        {
          id: "t4",
          content:
            "The gate allows growth of $\\max(5\\%, 2\\,\\text{KB})$ per entry, so $\\Delta = 2.6$ KB passes at $45.5$ KB and a $5 fee is text. A fraction such as $\\frac{\\Delta}{45.5}$ stays in its line; a sum set with its limits, $\\displaystyle\\sum_{i=1}^{N} x_i$, gives its line the units it needs.",
        },
      ],
    },
    { id: "q", content: "{{query review}}" },
    {
      id: "data",
      content: "```csv\nfund,aum,change\nAlpha,1284,2.1\nBeta,640,-0.4\nGamma,95,0.8\n```",
    },
    {
      id: "diagram",
      content:
        "```mermaid\nflowchart LR\n  build --> gates --> publish\n  gates -- fail --> fix --> build\n```",
    },
    { id: "math", content: "$$ \\sigma = \\sqrt{\\frac{1}{N} \\sum_{i=1}^{N} (x_i - \\mu)^2} $$" },
    { id: "code", content: "```js\nconst gates = [check, typecheck, build];\n```" },
    { id: "link", content: "https://example.com/handbook" },
    { id: "new", content: "" },
  ]);
  return (
    <div style={{ maxWidth: "calc(var(--sf-unit) * 32)" }}>
      <p style={{ margin: "0 0 var(--sf-unit)" }}>
        A query, a data block, a diagram, math (as a block and inside a line), a code editor and a
        link preview, registered through blockTypes. In the last, empty block, type / for the block
        commands.
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
