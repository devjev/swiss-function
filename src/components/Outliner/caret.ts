/**
 * Caret geometry inside a textarea.
 *
 * Arrow Up on the first visual line of a block moves to the block above and
 * keeps the caret's horizontal position, as in a single document. A textarea
 * does not expose where its caret is drawn, so a hidden mirror element with
 * the same box, font and wrapping lays the text out again and an empty marker
 * at the caret's offset is measured instead.
 */

const MIRRORED = [
  "boxSizing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontSizeAdjust",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "fontStretch",
  "fontKerning",
  "fontFeatureSettings",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "textIndent",
  "textTransform",
  "tabSize",
  "whiteSpace",
  "overflowWrap",
  "wordBreak",
  "direction",
] as const;

/** One pixel of slack: two offsets on the same visual line can differ by a
 *  sub-pixel after rounding. */
const SAME_LINE = 1;

interface Probe {
  /** The marker's position at `offset`, relative to the mirror's box. */
  at(offset: number): { x: number; top: number };
  dispose(): void;
}

function probe(textarea: HTMLTextAreaElement): Probe {
  const doc = textarea.ownerDocument;
  const mirror = doc.createElement("div");
  const computed = doc.defaultView?.getComputedStyle(textarea);
  const style = mirror.style;
  if (computed) {
    for (const prop of MIRRORED) style[prop] = computed[prop];
  }
  style.position = "absolute";
  style.insetBlockStart = "0";
  style.insetInlineStart = "-9999px";
  style.visibility = "hidden";
  style.pointerEvents = "none";
  style.borderStyle = "solid";
  style.inlineSize = `${textarea.getBoundingClientRect().width}px`;
  style.blockSize = "auto";

  const before = doc.createTextNode("");
  const marker = doc.createElement("span");
  // The trailing zero-width space gives a last, empty line a box to measure.
  const after = doc.createTextNode("​");
  mirror.append(before, marker, after);
  doc.body.appendChild(mirror);

  const text = textarea.value;
  return {
    at(offset) {
      before.data = text.slice(0, offset);
      after.data = `${text.slice(offset)}​`;
      const box = mirror.getBoundingClientRect();
      const rect = marker.getBoundingClientRect();
      return { x: rect.left - box.left, top: rect.top - box.top };
    },
    dispose() {
      mirror.remove();
    },
  };
}

export interface CaretLine {
  /** The caret is on the first visual line. */
  first: boolean;
  /** The caret is on the last visual line. */
  last: boolean;
  /** The caret's horizontal position inside the textarea, in px. */
  x: number;
}

/** Which visual line the caret (the selection's focus end) is on. */
export function caretLine(textarea: HTMLTextAreaElement): CaretLine {
  const p = probe(textarea);
  try {
    const caret = p.at(textarea.selectionEnd);
    const firstTop = p.at(0).top;
    const lastTop = p.at(textarea.value.length).top;
    return {
      first: caret.top - firstTop < SAME_LINE,
      last: lastTop - caret.top < SAME_LINE,
      x: caret.x,
    };
  } finally {
    p.dispose();
  }
}

/** The offset on the first or last visual line whose caret is nearest to `x`. */
export function offsetAtX(
  textarea: HTMLTextAreaElement,
  x: number,
  line: "first" | "last",
): number {
  const length = textarea.value.length;
  if (length === 0) return 0;
  const p = probe(textarea);
  try {
    // The line's range of offsets. A caret's top never decreases with its
    // offset, so both ends are found by bisection.
    let lo = 0;
    let hi = length;
    if (line === "first") {
      const top = p.at(0).top;
      let a = 0;
      let b = length;
      while (a < b) {
        const mid = Math.ceil((a + b) / 2);
        if (p.at(mid).top - top < SAME_LINE) a = mid;
        else b = mid - 1;
      }
      hi = a;
    } else {
      const top = p.at(length).top;
      let a = 0;
      let b = length;
      while (a < b) {
        const mid = Math.floor((a + b) / 2);
        if (top - p.at(mid).top < SAME_LINE) b = mid;
        else a = mid + 1;
      }
      lo = a;
    }
    // Within one line the caret's x grows with the offset.
    let a = lo;
    let b = hi;
    while (a < b) {
      const mid = Math.floor((a + b) / 2);
      if (p.at(mid).x < x) a = mid + 1;
      else b = mid;
    }
    if (a > lo && Math.abs(p.at(a - 1).x - x) <= Math.abs(p.at(a).x - x)) return a - 1;
    return a;
  } finally {
    p.dispose();
  }
}
