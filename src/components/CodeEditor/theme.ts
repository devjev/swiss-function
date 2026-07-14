/** CodeEditor's CodeMirror theme, expressed entirely in `--sf-color-code-*`
 *  custom properties. Because every colour is a `var(--sf-*)`, dark mode is the
 *  usual `[data-theme="dark"]` token swap — the editor never branches on theme
 *  in JS (AGENTS.md: dark mode is a token swap, not a code path).
 *
 *  Three restrained syntax themes (no rainbow, per AESTHETICS.md):
 *    - `minimal` — only comments are dimmed; code is plain fg.
 *    - `bold`    — separates by WEIGHT (bold) and SLANT (italic) only, no hue.
 *    - `primary` — `bold` plus the single brand accent on keywords/tags/links.
 *  The chrome (gutters, selection, tooltips) and the full-cell block caret are
 *  shared across all three. */

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { type Tag, tags as t } from "@lezer/highlight";

export type CodeTheme = "minimal" | "bold" | "primary";

const BOLD = "var(--sf-font-weight-bold)";

// Chrome (gutters, block caret, selection, tooltips, panels) — shared, token-driven.
const uiTheme = EditorView.theme({
  "&": {
    color: "var(--sf-color-code-fg)",
    backgroundColor: "var(--sf-color-code-bg)",
    fontSize: "var(--sf-font-size-md)",
  },
  ".cm-content": {
    fontFamily: "var(--sf-font-mono)",
    fontSizeAdjust: "var(--sf-font-mono-adjust)",
    caretColor: "transparent",
    padding: "calc(var(--sf-unit) / 2) 0",
  },
  // Block caret: a full character cell, tinted enough to read clearly while the
  // glyph still shows through.
  ".cm-cursor, .cm-cursor-primary, .cm-cursor-secondary": {
    borderLeft: "none",
    width: "1ch",
    backgroundColor: "var(--sf-color-code-cursor)",
    opacity: "0.6",
  },
  ".cm-dropCursor": { borderLeftColor: "var(--sf-color-code-cursor)" },
  "@media (prefers-reduced-motion: reduce)": {
    ".cm-cursorLayer": { animation: "none" },
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "var(--sf-color-code-selection)" },
  ".cm-activeLine": { backgroundColor: "var(--sf-color-code-active-line)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--sf-color-code-active-line)" },
  ".cm-gutters": {
    backgroundColor: "var(--sf-color-code-bg)",
    color: "var(--sf-color-code-gutter-fg)",
    border: "none",
    borderRight: "1px solid var(--sf-color-border)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--sf-color-muted)",
  },
  "&.cm-focused .cm-matchingBracket, .cm-matchingBracket": {
    backgroundColor: "var(--sf-color-code-matched-bracket)",
    outline: "none",
  },
  ".cm-selectionMatch, .cm-searchMatch": {
    backgroundColor: "var(--sf-color-code-selection)",
  },
  ".cm-panels": {
    backgroundColor: "var(--sf-color-bg-subtle)",
    color: "var(--sf-color-fg)",
    borderTop: "1px solid var(--sf-color-border)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--sf-color-bg)",
    border: "1px solid var(--sf-color-border)",
    borderRadius: "var(--sf-radius-default)",
    color: "var(--sf-color-fg)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--sf-color-primary)",
    color: "var(--sf-color-primary-fg)",
  },
  ".cm-placeholder": { color: "var(--sf-color-muted)" },
});

// Shared tag groups.
const COMMENTS: readonly Tag[] = [
  t.comment,
  t.lineComment,
  t.blockComment,
  t.docComment,
  t.meta,
  t.processingInstruction,
];
const KEYWORDS: readonly Tag[] = [
  t.keyword,
  t.controlKeyword,
  t.operatorKeyword,
  t.definitionKeyword,
  t.moduleKeyword,
  t.modifier,
  t.self,
  t.null,
  t.tagName,
];
const DEFINITIONS: readonly Tag[] = [
  t.typeName,
  t.className,
  t.namespace,
  t.function(t.variableName),
  t.function(t.propertyName),
  t.definition(t.variableName),
  t.labelName,
  t.attributeName,
];
const STRINGS: readonly Tag[] = [t.string, t.special(t.string), t.regexp, t.attributeValue];
const PUNCTUATION: readonly Tag[] = [
  t.operator,
  t.compareOperator,
  t.logicOperator,
  t.arithmeticOperator,
  t.definitionOperator,
  t.punctuation,
  t.separator,
  t.bracket,
  t.brace,
  t.paren,
  t.squareBracket,
  t.angleBracket,
];

// Rules every theme shares: dimmed comments, Markdown structure, error signal.
const shared = [
  { tag: COMMENTS, color: "var(--sf-color-code-comment)", fontStyle: "italic" },
  { tag: t.heading, fontWeight: BOLD },
  { tag: t.strong, fontWeight: BOLD },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.invalid, color: "var(--sf-color-danger)" },
];

// Weight/slant that `bold` and `primary` share (code stays fg; no hue).
const structural = [
  { tag: DEFINITIONS, fontWeight: BOLD },
  { tag: STRINGS, fontStyle: "italic" },
  { tag: PUNCTUATION, color: "var(--sf-color-code-punctuation)" },
];

const STYLES: Record<CodeTheme, HighlightStyle> = {
  // Only comments dimmed; all code is plain fg.
  minimal: HighlightStyle.define(shared),
  // Add weight/slant; keywords lean on bold instead of a colour.
  bold: HighlightStyle.define([
    ...shared,
    ...structural,
    { tag: KEYWORDS, fontWeight: BOLD },
    { tag: [t.link, t.url], textDecoration: "underline" },
  ]),
  // Add the single brand accent on keywords/tags/links.
  primary: HighlightStyle.define([
    ...shared,
    ...structural,
    { tag: KEYWORDS, color: "var(--sf-color-code-accent)" },
    { tag: [t.link, t.url], color: "var(--sf-color-code-accent)", textDecoration: "underline" },
  ]),
};

/** Shared chrome + block caret (theme-independent). */
export const codeChrome: Extension = uiTheme;

/** The syntax-highlighting extension for a given theme. */
export function codeHighlight(theme: CodeTheme): Extension {
  return syntaxHighlighting(STYLES[theme]);
}

/** The complete default (`primary`) theme: chrome + syntax highlighting.
 *  Kept for advanced composition; the `CodeEditor` `theme` prop is the usual path. */
export const sfCodeTheme: Extension = [codeChrome, codeHighlight("primary")];
