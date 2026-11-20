/**
 * Zoom: the outline shows one block as its title and that block's children as
 * the top level.
 *
 * The component edits a view of the tree. Unzoomed, the view is the tree.
 * Zoomed, it is a tree of one: the zoomed block, unfolded. Every tree
 * operation runs on the view, and `zoomBack` puts the result in the block's
 * place. An operation that would take a block out of the view (outdenting a
 * first-level block, deleting the title) leaves the view with another shape at
 * its top, and `zoomBack` refuses it.
 */

import { type InlineFound, type InlineSpan, scanInline } from "./markdown-extensions";
import { findBullet, replaceBullet } from "./tree";
import type { Bullet, BulletId, OutlinerValue } from "./types";

/** The zoomed block, or null when `rootId` is null or not in the tree. */
export function zoomRoot(value: OutlinerValue, rootId: BulletId | null | undefined): Bullet | null {
  return rootId ? (findBullet(value, rootId)?.bullet ?? null) : null;
}

/** The tree the component edits while zoomed on `root`. */
export function zoomView(root: Bullet): OutlinerValue {
  return [{ ...root, collapsed: false }];
}

/** The whole tree after the view changed to `view`; null when the change took
 *  something out of the zoomed block. The block keeps its own fold state. */
export function zoomBack(
  value: OutlinerValue,
  root: Bullet,
  view: OutlinerValue,
): OutlinerValue | null {
  const top = view[0];
  if (view.length !== 1 || !top || top.id !== root.id) return null;
  const { collapsed: _unfolded, ...rest } = top;
  return replaceBullet(value, root.id, root.collapsed ? { ...rest, collapsed: true } : rest);
}

/** A block's text as one plain line, for the breadcrumb and the drag label:
 *  the first line, without the task marker and the common inline markup. */
export function plainLabel(content: string): string {
  const line = content.split("\n", 1)[0] ?? "";
  return line
    .replace(/^\d+\. /, "")
    .replace(/^\[[ xX/-]\] /, "")
    .replace(/^(#{1,3}|>) /, "")
    .replace(/^\[!\w+\]\s*/, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\(\(([^)]+)\)\)/g, "$1")
    .replace(/(\*\*|__|~~|\^\^|==|`)/g, "")
    .replace(/(^|\s)[*_](\S[^*_]*?)[*_](?=\s|$|[.,;:!?])/g, "$1$2")
    .trim();
}

/** `plainLabel`, with the registered inline spans (`$x$`) kept apart so they
 *  can be rendered: plain stretches and the spans between them. `plain` says
 *  the text is such a label already (a path of labels) and only the spans are
 *  looked for. */
export function labelParts(
  content: string,
  spans: readonly InlineSpan[],
  plain = false,
): (string | InlineFound)[] {
  if (spans.length === 0) {
    const text = plain ? content : plainLabel(content);
    return text ? [text] : [];
  }
  const found: InlineFound[] = [];
  // Each span leaves the line as one character from the private use area,
  // which nothing in `plainLabel` reads, and comes back in its place.
  const held = scanInline(content.split("\n", 1)[0] ?? "", spans)
    .map((part) => {
      if (typeof part === "string") return part;
      found.push(part);
      return String.fromCharCode(HELD + found.length - 1);
    })
    .join("");
  const parts: (string | InlineFound)[] = [];
  let text = "";
  for (const ch of plain ? held : plainLabel(held)) {
    const span = found[ch.charCodeAt(0) - HELD];
    if (ch.length === 1 && span) {
      if (text) parts.push(text);
      text = "";
      parts.push(span);
    } else text += ch;
  }
  if (text) parts.push(text);
  return parts;
}
/** The first of the private use characters that stand in for spans. */
const HELD = 0xe000;
