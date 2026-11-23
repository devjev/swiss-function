/**
 * Outliner-flavor markdown:
 * - `[[Name]]` → wiki link (custom click handler)
 * - `#name` and `#[[Two Words]]` → a tag: a link to that name with the `tag:`
 *   scheme, so it renders as a tag (issue #109) and opens like a wiki link
 * - `((bullet-id))` → transcluded block reference (consumer-resolved)
 * - `@2026-11-25` → a due date, shown as a chip
 * - `$x$` and any other span a registered block type declares (`inline`) →
 *   a code span the type renders
 * - `\=` and `\^` → held for the highlight transform (`highlight.ts`), which
 *   reads `==text==` from the parsed tree
 *
 * Naive regex preprocess: it does not skip code fences or spans. Acceptable
 * for v1; tighter parsing (a remark plugin) can come later if needed. The
 * inline spans are the exception: they are scanned, and run first, so the
 * regex passes do not reach into what a span holds.
 */

import { DATE_RE } from "./blocks";
import { holdEscapedDelimiters } from "./highlight";

// Backslash-escape preserved: `\[[foo]]` stays literal.
const WIKI_RE = /(?<!\\)\[\[([^\]\n]+)\]\]/g;
const BLOCK_RE = /(?<!\\)\(\(([^)\n]+)\)\)/g;
// A hash that starts a word: not inside one (`C#`), not a URL fragment
// (`/#top`, `(#top)`), not escaped. `# Heading` has a space and is left alone.
const TAG_RE = /(?<![\p{L}\p{N}_&/#([\]\\])#([\p{L}\p{N}_/-]+)/gu;
// `#[[Two Words]]`, after the wiki pass has turned its brackets into a link.
// The hash moves inside the link text, where TAG_RE (which skips a hash after
// an opening bracket) leaves it alone.
const BRACKET_TAG_RE = /(?<![\p{L}\p{N}_&/#(\]\\])#\[([^\]\n]+)\]\(wiki:/gu;

/** A span inside a block's text that a registered type renders: `$x$`. */
export interface InlineSpan {
  open: string;
  /** Default: the same as `open`. */
  close?: string;
}

/** The code span an inline span becomes: `sf-inline:<index>:<encoded source>`. */
const INLINE_MARK = "sf-inline:";
const INLINE_RE = /^sf-inline:(\d+):(.*)$/s;

// Percent-encoded, the source holds nothing markdown or the passes below
// read: no backtick, pipe, bracket, hash or `@`. The brackets `((` would be
// taken for a block reference, so they are encoded too.
// Null for text that cannot be encoded (half of a surrogate pair).
function encodeInline(source: string): string | null {
  try {
    return encodeURIComponent(source).replace(/\(/g, "%28").replace(/\)/g, "%29");
  } catch {
    return null;
  }
}

/** What a code span marks: the index of the inline span and its source, or
 *  null for ordinary code. */
export function readInline(code: string): { index: number; source: string } | null {
  const found = INLINE_RE.exec(code);
  if (!found) return null;
  try {
    return { index: Number(found[1]), source: decodeURIComponent(found[2] ?? "") };
  } catch {
    return null;
  }
}

/** Where the span that opens before `from` closes, or -1. The rules are
 *  pandoc's for `$`: the source starts and ends with something other than a
 *  space, stays on one line, and no digit follows the close, so `$5 and $10`
 *  is two prices. The first closing delimiter decides: a span holds none,
 *  and it holds no backtick either. */
function inlineClose(source: string, from: number, close: string): number {
  const first = source[from];
  if (first === undefined || /\s/.test(first)) return -1;
  let at = from;
  while (at < source.length) {
    const ch = source[at];
    // Code starts here: what looked like an opener was prose (a price before
    // a code span).
    if (ch === "\n" || ch === "`") return -1;
    if (source.startsWith(close, at)) {
      if (at === from || /\s/.test(source[at - 1] ?? "")) return -1;
      return /\d/.test(source[at + close.length] ?? "") ? -1 : at;
    }
    // An escaped character is not a delimiter.
    at += ch === "\\" ? 2 : 1;
  }
  return -1;
}

/** A span found in a block's text: which of the registered spans it is, and
 *  what stands between its delimiters. */
export interface InlineFound {
  index: number;
  source: string;
}

/** The text cut into plain stretches and the inline spans between them. Code
 *  spans and fences, escaped delimiters and doubled ones (`$$`) are plain. */
export function scanInline(source: string, spans: readonly InlineSpan[]): (string | InlineFound)[] {
  if (spans.length === 0) return [source];
  const parts: (string | InlineFound)[] = [];
  let text = "";
  let at = 0;
  scan: while (at < source.length) {
    const ch = source[at] as string;
    if (ch === "`") {
      // A run of backticks opens code that ends at the next run as long.
      let run = 1;
      while (source[at + run] === "`") run++;
      const fence = source.slice(at, at + run);
      let end = source.indexOf(fence, at + run);
      while (end >= 0 && (source[end + run] === "`" || source[end - 1] === "`")) {
        end = source.indexOf(fence, end + 1);
      }
      const stop = end < 0 ? at + run : end + run;
      text += source.slice(at, stop);
      at = stop;
      continue;
    }
    for (let index = 0; index < spans.length; index++) {
      const { open, close = open } = spans[index] as InlineSpan;
      if (!source.startsWith(open, at)) continue;
      if (source.startsWith(open, at + open.length)) {
        text += open + open;
        at += open.length * 2;
        continue scan;
      }
      const end = inlineClose(source, at + open.length, close);
      if (end < 0) continue;
      if (text) parts.push(text);
      text = "";
      parts.push({ index, source: source.slice(at + open.length, end) });
      at = end + close.length;
      continue scan;
    }
    const step = ch === "\\" ? 2 : 1;
    text += source.slice(at, at + step);
    at += step;
  }
  if (text) parts.push(text);
  return parts;
}

/** Replace each inline span with the code span that marks it. */
export function markInline(source: string, spans: readonly InlineSpan[]): string {
  if (spans.length === 0) return source;
  return scanInline(source, spans)
    .map((part) => {
      if (typeof part === "string") return part;
      const body = encodeInline(part.source);
      const { open, close = open } = spans[part.index] as InlineSpan;
      // Text that cannot be encoded stays as it was written.
      return body === null ? open + part.source + close : `\`${INLINE_MARK}${part.index}:${body}\``;
    })
    .join("");
}

export function preprocessOutlinerMarkdown(
  source: string,
  inline: readonly InlineSpan[] = [],
): string {
  // After the inline spans, whose sources are encoded: an escaped `\=` in a
  // formula is not a highlight's business.
  return holdEscapedDelimiters(markInline(source, inline))
    .replace(WIKI_RE, (_, name) => `[${name}](wiki:${encodeURIComponent(name)})`)
    .replace(BRACKET_TAG_RE, (_, name) => `[#${name}](tag:`)
    .replace(TAG_RE, (_, name) => `[#${name}](tag:${encodeURIComponent(name)})`)
    .replace(BLOCK_RE, (_, id) => `\`block-ref:${id}\``)
    .replace(DATE_RE, (_, date) => `[${date}](date:${date})`);
}

export const MAX_TRANSCLUSION_DEPTH = 8;

/** Allow any URL scheme (react-markdown sanitizes unknown schemes by default,
 *  which strips our `wiki:` and `tag:` links). */
export const passthroughUrlTransform = (url: string): string => url;
