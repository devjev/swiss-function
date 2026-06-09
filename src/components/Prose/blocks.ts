/**
 * Split a markdown document into top-level blocks for virtualization.
 *
 * The parser is intentionally small: it groups consecutive non-empty lines
 * into blocks separated by blank lines, while keeping fenced code blocks
 * (``` … ```) intact even if they contain blank lines. It detects ATX
 * headings (`# …`) to expose them as outline entries.
 *
 * Tradeoff: deeply nested lists with blank lines between items will
 * over-split, and HTML blocks aren't given special treatment. Consumers
 * who already hold an mdast can bypass the parser entirely by passing
 * pre-split `blocks` to `<Prose.Root>`.
 */

export type ProseBlockKind =
  | "heading"
  | "paragraph"
  | "list"
  | "code"
  | "quote"
  | "table"
  | "hr"
  | "other";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface ProseBlock {
  /** Stable identifier. Defaults to `"block-{index}"`; consumers may override. */
  id: string;
  /** Markdown source for this block, with original line breaks preserved. */
  source: string;
  kind: ProseBlockKind;
  /** Present iff `kind === "heading"`. */
  headingLevel?: HeadingLevel;
  /** Plain-text heading content, with the leading `#`s stripped. */
  headingText?: string;
}

export interface ParseBlocksResult {
  blocks: ProseBlock[];
  headings: ProseBlock[];
}

const FENCE_RE = /^(```|~~~)/;
const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR_RE = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;

function classify(source: string): {
  kind: ProseBlockKind;
  headingLevel?: HeadingLevel;
  headingText?: string;
} {
  const first = source.split("\n", 1)[0] ?? "";
  const headingMatch = HEADING_RE.exec(first);
  if (headingMatch?.[1]) {
    const level = headingMatch[1].length as HeadingLevel;
    return { kind: "heading", headingLevel: level, headingText: headingMatch[2] ?? "" };
  }
  if (FENCE_RE.test(first)) return { kind: "code" };
  if (HR_RE.test(first) && source.split("\n").length === 1) return { kind: "hr" };
  const trimmed = first.trimStart();
  if (trimmed.startsWith("> ") || trimmed === ">") return { kind: "quote" };
  if (/^([-*+]|\d+\.)\s+/.test(trimmed)) return { kind: "list" };
  if (trimmed.startsWith("|")) return { kind: "table" };
  if (trimmed === "") return { kind: "other" };
  return { kind: "paragraph" };
}

export function parseBlocks(source: string): ParseBlocksResult {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const rawBlocks: string[] = [];
  let buf: string[] = [];
  let inFence = false;
  let fenceMarker = "";

  const flush = () => {
    if (buf.length > 0) {
      rawBlocks.push(buf.join("\n"));
      buf = [];
    }
  };

  for (const line of lines) {
    if (inFence) {
      buf.push(line);
      if (line.startsWith(fenceMarker)) {
        inFence = false;
        flush();
      }
      continue;
    }
    const fence = FENCE_RE.exec(line);
    if (fence?.[1]) {
      flush();
      inFence = true;
      fenceMarker = fence[1];
      buf.push(line);
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    buf.push(line);
  }
  flush();

  const blocks: ProseBlock[] = rawBlocks.map((src, i) => {
    const { kind, headingLevel, headingText } = classify(src);
    return {
      id: `block-${i}`,
      source: src,
      kind,
      ...(headingLevel ? { headingLevel } : {}),
      ...(headingText !== undefined ? { headingText } : {}),
    };
  });

  const headings = blocks.filter((b) => b.kind === "heading");
  return { blocks, headings };
}
