/**
 * Outliner-flavor markdown:
 * - `[[Name]]` → wiki link (custom click handler)
 * - `((bullet-id))` → transcluded block reference (consumer-resolved)
 *
 * Naive regex preprocess — does not skip code fences/spans. Acceptable for v1;
 * tighter parsing (remark plugin) can come later if needed.
 */

// Backslash-escape preserved: `\[[foo]]` stays literal.
const WIKI_RE = /(?<!\\)\[\[([^\]\n]+)\]\]/g;
const BLOCK_RE = /(?<!\\)\(\(([^)\n]+)\)\)/g;

export function preprocessOutlinerMarkdown(source: string): string {
  return source
    .replace(WIKI_RE, (_, name) => `[${name}](wiki:${encodeURIComponent(name)})`)
    .replace(BLOCK_RE, (_, id) => `\`block-ref:${id}\``);
}

export const MAX_TRANSCLUSION_DEPTH = 8;

/** Allow any URL scheme (react-markdown sanitizes unknown schemes by default,
 *  which strips our `wiki:` links). */
export const passthroughUrlTransform = (url: string): string => url;
