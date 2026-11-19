/**
 * Outliner-flavor markdown:
 * - `[[Name]]` → wiki link (custom click handler)
 * - `#name` and `#[[Two Words]]` → a tag, which is a wiki link to that name
 * - `((bullet-id))` → transcluded block reference (consumer-resolved)
 *
 * Naive regex preprocess: it does not skip code fences or spans. Acceptable
 * for v1; tighter parsing (a remark plugin) can come later if needed.
 */

// Backslash-escape preserved: `\[[foo]]` stays literal.
const WIKI_RE = /(?<!\\)\[\[([^\]\n]+)\]\]/g;
const BLOCK_RE = /(?<!\\)\(\(([^)\n]+)\)\)/g;
// A hash that starts a word: not inside one (`C#`), not a URL fragment
// (`/#top`, `(#top)`), not escaped. `# Heading` has a space and is left alone.
const TAG_RE = /(?<![\p{L}\p{N}_&/#([\]\\])#([\p{L}\p{N}_/-]+)/gu;
// `#[[Two Words]]`, after the wiki pass has turned its brackets into a link.
// The hash moves inside the link text, where TAG_RE (which skips a hash after
// an opening bracket) leaves it alone.
const BRACKET_TAG_RE = /(?<![p{L}p{N}_&/#(\]\\])#\[([^\]\n]+)\]\(wiki:/gu;

export function preprocessOutlinerMarkdown(source: string): string {
  return source
    .replace(WIKI_RE, (_, name) => `[${name}](wiki:${encodeURIComponent(name)})`)
    .replace(BRACKET_TAG_RE, (_, name) => `[#${name}](wiki:`)
    .replace(TAG_RE, (_, name) => `[#${name}](wiki:${encodeURIComponent(name)})`)
    .replace(BLOCK_RE, (_, id) => `\`block-ref:${id}\``);
}

export const MAX_TRANSCLUSION_DEPTH = 8;

/** Allow any URL scheme (react-markdown sanitizes unknown schemes by default,
 *  which strips our `wiki:` links). */
export const passthroughUrlTransform = (url: string): string => url;
