/**
 * Click-to-caret: a block shows rendered markdown until it is entered, so a
 * click lands on rendered text and the caret belongs in the markdown source.
 *
 * `sourceOffsetFromRendered` walks both strings in step. Rendered text is the
 * source with its markup removed (`**bold**` reads "bold", `[[Page]]` reads
 * "Page"), so each rendered character is looked up forward in the source and
 * the markup between two of them is skipped. Text that is not in the source at
 * all (a transcluded block reference) stops the walk where it began.
 */

const isSpace = (ch: string | undefined): boolean => ch !== undefined && /\s/.test(ch);

export function sourceOffsetFromRendered(
  source: string,
  rendered: string,
  renderedOffset: number,
): number {
  if (renderedOffset <= 0) return 0;
  // A click after the last visible character goes to the very end, past any
  // closing markup.
  if (renderedOffset >= rendered.trimEnd().length) return source.length;

  let s = 0;
  for (let r = 0; r < renderedOffset; r++) {
    const ch = rendered[r] as string;
    if (isSpace(ch)) {
      // Rendered whitespace may be the renderer's own (between two blocks), so
      // it is consumed only when the source has whitespace before the next
      // visible character.
      const gap = spaceBefore(source, s, nextVisible(rendered, r + 1));
      if (gap === null) return isSpace(source[s]) ? s + 1 : s;
      if (gap >= 0) s = gap + 1;
      continue;
    }
    const found = source.indexOf(ch, s);
    if (found === -1) return s;
    s = found + 1;
  }

  // The caret sits before the clicked character, so opening markup between the
  // last character walked and the clicked one stays behind it.
  const clicked = rendered[renderedOffset] as string;
  if (isSpace(clicked)) {
    const gap = spaceBefore(source, s, nextVisible(rendered, renderedOffset + 1));
    return gap !== null && gap >= 0 ? gap : s;
  }
  const found = source.indexOf(clicked, s);
  return found === -1 ? s : found;
}

function nextVisible(rendered: string, from: number): string | undefined {
  let k = from;
  while (k < rendered.length && isSpace(rendered[k])) k++;
  return rendered[k];
}

/** The first whitespace in the source at or after `from` and before the next
 *  visible character: -1 when there is none, null when that character is not
 *  in the source at all. */
function spaceBefore(source: string, from: number, visible: string | undefined): number | null {
  const limit = visible === undefined ? source.length : source.indexOf(visible, from);
  if (limit === -1) return null;
  for (let i = from; i < limit; i++) {
    if (isSpace(source[i])) return i;
  }
  return -1;
}

/** The source offset under a viewport point inside a block's rendered
 *  content. A point outside the content gives the end of the source. */
export function sourceOffsetAtPoint(
  content: HTMLElement,
  source: string,
  clientX: number,
  clientY: number,
): number {
  const doc = content.ownerDocument;
  let node: Node | null = null;
  let offset = 0;
  if (typeof doc.caretPositionFromPoint === "function") {
    const position = doc.caretPositionFromPoint(clientX, clientY);
    node = position?.offsetNode ?? null;
    offset = position?.offset ?? 0;
  } else if (typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(clientX, clientY);
    node = range?.startContainer ?? null;
    offset = range?.startOffset ?? 0;
  }
  if (!node || !content.contains(node)) return source.length;
  const before = doc.createRange();
  before.setStart(content, 0);
  before.setEnd(node, offset);
  return sourceOffsetFromRendered(source, content.textContent ?? "", before.toString().length);
}
