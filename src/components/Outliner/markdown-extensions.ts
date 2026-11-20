/**
 * Outliner-flavor markdown:
 * - `[[Name]]` → wiki link (custom click handler)
 * - `#name` and `#[[Two Words]]` → a tag, which is a wiki link to that name
 * - `((bullet-id))` → transcluded block reference (consumer-resolved)
 * - `@2026-11-25` → a due date, shown as a chip
 * - `$x$` and any other span a registered block type declares (`inline`) →
 *   a code span the type renders
 *
 * Naive regex preprocess: it does not skip code fences or spans. Acceptable
 * for v1; tighter parsing (a remark plugin) can come later if needed. The
 * inline spans are the exception: they are scanned, and run first, so the
 * regex passes do not reach into what a span holds.
 */

import { DATE_RE } from "./blocks";

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
 *  is two prices. The first closing delimiter decides: a span holds none. */
function inlineClose(source: string, from: number, close: string): number {
  const first = source[from];
  if (first === undefined || /\s/.test(first)) return -1;
  let at = from;
  while (at < source.length) {
    const ch = source[at];
    if (ch === "\n") return -1;
    if (source.startsWith(close, at)) {
      if (at === from || /\s/.test(source[at - 1] ?? "")) return -1;
      return /\d/.test(source[at + close.length] ?? "") ? -1 : at;
    }
    // An escaped character is not a delimiter.
    at += ch === "\\" ? 2 : 1;
  }
  return -1;
}

/** Replace each inline span with the code span that marks it. Code spans and
 *  fences, escaped delimiters and doubled ones (`$$`) are left as they are. */
export function markInline(source: string, spans: readonly InlineSpan[]): string {
  if (spans.length === 0) return source;
  let out = "";
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
      out += source.slice(at, stop);
      at = stop;
      continue;
    }
    for (let index = 0; index < spans.length; index++) {
      const { open, close = open } = spans[index] as InlineSpan;
      if (!source.startsWith(open, at)) continue;
      if (source.startsWith(open, at + open.length)) {
        out += open + open;
        at += open.length * 2;
        continue scan;
      }
      const end = inlineClose(source, at + open.length, close);
      if (end < 0) continue;
      const body = encodeInline(source.slice(at + open.length, end));
      if (body === null) continue;
      out += `\`${INLINE_MARK}${index}:${body}\``;
      at = end + close.length;
      continue scan;
    }
    const step = ch === "\\" ? 2 : 1;
    out += source.slice(at, at + step);
    at += step;
  }
  return out;
}

export function preprocessOutlinerMarkdown(
  source: string,
  inline: readonly InlineSpan[] = [],
): string {
  return markInline(source, inline)
    .replace(WIKI_RE, (_, name) => `[${name}](wiki:${encodeURIComponent(name)})`)
    .replace(BRACKET_TAG_RE, (_, name) => `[#${name}](wiki:`)
    .replace(TAG_RE, (_, name) => `[#${name}](wiki:${encodeURIComponent(name)})`)
    .replace(BLOCK_RE, (_, id) => `\`block-ref:${id}\``)
    .replace(DATE_RE, (_, date) => `[${date}](date:${date})`);
}

export const MAX_TRANSCLUSION_DEPTH = 8;

/** Allow any URL scheme (react-markdown sanitizes unknown schemes by default,
 *  which strips our `wiki:` links). */
export const passthroughUrlTransform = (url: string): string => url;
