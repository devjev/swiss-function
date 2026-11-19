import type { Bullet } from "./types";

/**
 * The outline's clipboard format is a markdown list: what a copy writes, and
 * what a paste reads back into nested blocks. It is plain text, so an outline
 * pastes into any editor and a list from any editor pastes into an outline.
 */

/** A block read from pasted text: no id yet. */
export interface PastedBlock {
  content: string;
  children: PastedBlock[];
}

/** Blocks as a markdown list, two spaces per level. A block's further lines
 *  are indented under its marker, so they stay part of the item. */
export function toMarkdownList(bullets: Bullet[], depth = 0): string {
  const indent = "  ".repeat(depth);
  const out: string[] = [];
  for (const bullet of bullets) {
    const [first = "", ...rest] = bullet.content.split("\n");
    out.push(`${indent}- ${first}`);
    for (const line of rest) out.push(`${indent}  ${line}`);
    if (bullet.children?.length) out.push(toMarkdownList(bullet.children, depth + 1));
  }
  return out.join("\n");
}

const ITEM = /^([ \t]*)(?:[-*+]|\d+[.)])[ \t]+(.*)$/;

const width = (space: string): number => space.replace(/\t/g, "    ").length;

/** Whether pasted text should become blocks: it has a list item, or several
 *  paragraphs separated by blank lines. Anything else (one line, or lines of
 *  one paragraph such as code) is inserted as text. */
export function isOutlineText(text: string): boolean {
  const lines = text.replace(/\r\n?/g, "\n").trim().split("\n");
  if (lines.length < 2) return false;
  return lines.some((line) => ITEM.test(line)) || lines.some((line) => line.trim() === "");
}

/** Read text into nested blocks. A list item starts a block at its indent, a
 *  deeper non-item line continues the block above, and a paragraph (lines up
 *  to a blank line) is one block. */
export function parseOutline(text: string): PastedBlock[] {
  interface Item {
    indent: number;
    block: PastedBlock;
    list: boolean;
  }
  const items: Item[] = [];
  let open: Item | null = null;
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (raw.trim() === "") {
      open = null;
      continue;
    }
    const item = ITEM.exec(raw);
    if (item) {
      open = {
        indent: width(item[1] ?? ""),
        block: { content: (item[2] ?? "").trimEnd(), children: [] },
        list: true,
      };
      items.push(open);
      continue;
    }
    const indent = width(/^[ \t]*/.exec(raw)?.[0] ?? "");
    if (open && (!open.list || indent > open.indent)) {
      open.block.content += `\n${raw.trim()}`;
      continue;
    }
    open = { indent, block: { content: raw.trim(), children: [] }, list: false };
    items.push(open);
  }

  const roots: PastedBlock[] = [];
  const stack: Item[] = [];
  for (const item of items) {
    while (stack.length > 0 && (stack[stack.length - 1] as Item).indent >= item.indent) stack.pop();
    const parent = stack[stack.length - 1];
    (parent ? parent.block.children : roots).push(item.block);
    stack.push(item);
  }
  return roots;
}

/** Give pasted blocks their ids. */
export function withIds(blocks: PastedBlock[], generateId: () => string): Bullet[] {
  return blocks.map((block) => ({
    id: generateId(),
    content: block.content,
    ...(block.children.length > 0 ? { children: withIds(block.children, generateId) } : null),
  }));
}
