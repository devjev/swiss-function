/** CodeEditor's CodeMirror theme, expressed entirely in `--sf-color-code-*`
 *  custom properties. Because every colour is a `var(--sf-*)`, dark mode is the
 *  usual `[data-theme="dark"]` token swap — the editor never branches on theme
 *  in JS (AGENTS.md: dark mode is a token swap, not a code path). */

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

// Chrome (gutters, cursor, selection, tooltips, panels) — all token-driven.
const uiTheme = EditorView.theme({
  "&": {
    color: "var(--sf-color-code-fg)",
    backgroundColor: "var(--sf-color-code-bg)",
    fontSize: "var(--sf-font-size-md)",
  },
  ".cm-content": {
    fontFamily: "var(--sf-font-mono)",
    fontSizeAdjust: "var(--sf-font-mono-adjust)",
    caretColor: "var(--sf-color-code-cursor)",
    padding: "calc(var(--sf-unit) / 2) 0",
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--sf-color-code-cursor)" },
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

// Lezer highlight tags → token colours. Grouped by role; each role is one token.
const highlightStyle = HighlightStyle.define([
  {
    tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
    color: "var(--sf-color-code-comment)",
    fontStyle: "italic",
  },
  {
    tag: [
      t.keyword,
      t.modifier,
      t.controlKeyword,
      t.operatorKeyword,
      t.definitionKeyword,
      t.moduleKeyword,
      t.self,
      t.null,
    ],
    color: "var(--sf-color-code-keyword)",
  },
  {
    tag: [t.string, t.special(t.string), t.regexp, t.attributeValue],
    color: "var(--sf-color-code-string)",
  },
  { tag: [t.number, t.integer, t.float, t.bool, t.atom], color: "var(--sf-color-code-number)" },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName), t.labelName],
    color: "var(--sf-color-code-name)",
  },
  { tag: [t.typeName, t.className, t.namespace], color: "var(--sf-color-code-type)" },
  {
    tag: [t.constant(t.variableName), t.standard(t.variableName), t.constant(t.name)],
    color: "var(--sf-color-code-constant)",
  },
  { tag: [t.variableName, t.propertyName], color: "var(--sf-color-code-fg)" },
  {
    tag: [
      t.operator,
      t.compareOperator,
      t.logicOperator,
      t.arithmeticOperator,
      t.definitionOperator,
    ],
    color: "var(--sf-color-code-operator)",
  },
  {
    tag: [t.punctuation, t.separator, t.bracket, t.brace, t.paren, t.squareBracket, t.angleBracket],
    color: "var(--sf-color-code-punctuation)",
  },
  { tag: [t.tagName], color: "var(--sf-color-code-tag)" },
  { tag: [t.attributeName], color: "var(--sf-color-code-attribute)" },
  { tag: [t.link, t.url], color: "var(--sf-color-code-link)", textDecoration: "underline" },
  {
    tag: [t.heading],
    color: "var(--sf-color-code-name)",
    fontWeight: "var(--sf-font-weight-bold)",
  },
  { tag: t.strong, fontWeight: "var(--sf-font-weight-bold)" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: [t.meta, t.processingInstruction], color: "var(--sf-color-code-comment)" },
  { tag: t.invalid, color: "var(--sf-color-danger)" },
]);

/** The complete token-bound theme: chrome + syntax highlighting. */
export const sfCodeTheme: Extension = [uiTheme, syntaxHighlighting(highlightStyle)];
