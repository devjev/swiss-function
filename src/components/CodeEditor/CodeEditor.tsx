import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder as placeholderExt,
  rectangularSelection,
} from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import type { HTMLAttributes } from "react";
import { forwardRef, useEffect, useRef } from "react";
import { cx } from "../../lib/cx";
import { mergeRefs } from "../../lib/mergeRefs";
import styles from "./CodeEditor.module.css";
import { sfCodeTheme } from "./theme";

export interface CodeEditorProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  /** Controlled document text. */
  value?: string;
  /** Initial text when uncontrolled. */
  defaultValue?: string;
  /** Called with the full document on every edit. */
  onChange?: (value: string) => void;
  /** Language / feature extensions (e.g. `javascript()` from
   *  `@codemirror/lang-javascript`). Memoize this — a new array each render
   *  reconfigures the editor. */
  extensions?: Extension[];
  /** Enable Vim keybindings. Default `false`. */
  vim?: boolean;
  /** Read-only document (still selectable/focusable). */
  readOnly?: boolean;
  /** Whether the content is editable. Default `true`. */
  editable?: boolean;
  /** Placeholder shown when empty. */
  placeholder?: string;
  /** Show the line-number gutter (+ fold gutter). Default `true`. */
  lineNumbers?: boolean;
  /** Soft-wrap long lines instead of scrolling horizontally. Default `false`. */
  lineWrapping?: boolean;
  /** Spaces per indent level. Default `2`. */
  tabSize?: number;
  /** Focus the editor on mount. */
  autoFocus?: boolean;
  /** Receive the underlying CodeMirror `EditorView` once created. */
  onCreateEditor?: (view: EditorView) => void;
}

// Static extensions — the "basic setup", minus the pieces that depend on props
// (those live in the compartments below) and minus CodeMirror's default theme
// (sfCodeTheme replaces it).
const baseSetup: Extension = [
  highlightSpecialChars(),
  history(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    indentWithTab,
  ]),
  sfCodeTheme,
];

interface DynamicOpts {
  lineNumbers: boolean;
  lineWrapping: boolean;
  readOnly: boolean;
  editable: boolean;
  tabSize: number;
  placeholder?: string;
  extensions: Extension[];
}

// The prop-driven slice, rebuilt whenever any of these props change and swapped
// in through the dynamic compartment.
function buildDynamic(o: DynamicOpts): Extension {
  return [
    o.lineNumbers ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()] : [],
    highlightActiveLine(),
    o.lineWrapping ? EditorView.lineWrapping : [],
    EditorState.readOnly.of(o.readOnly),
    EditorView.editable.of(o.editable && !o.readOnly),
    EditorState.tabSize.of(o.tabSize),
    indentUnit.of(" ".repeat(o.tabSize)),
    o.placeholder ? placeholderExt(o.placeholder) : [],
    o.extensions,
  ];
}

/**
 * A code editor: a thin wrapper over CodeMirror 6, themed entirely through
 * `--sf-color-code-*` tokens (so light/dark is a token swap), with opt-in Vim
 * mode. Bring your own language via `extensions` (e.g. `@codemirror/lang-json`).
 *
 * The `EditorView` is created once; prop changes reconfigure it in place via
 * compartments rather than tearing it down, so undo history and cursor survive.
 */
export const CodeEditor = forwardRef<HTMLDivElement, CodeEditorProps>(function CodeEditor(
  {
    value,
    defaultValue,
    onChange,
    extensions = [],
    vim: vimMode = false,
    readOnly = false,
    editable = true,
    placeholder,
    lineNumbers: showLineNumbers = true,
    lineWrapping = false,
    tabSize = 2,
    autoFocus = false,
    onCreateEditor,
    className,
    ...rest
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const setRefs = mergeRefs<HTMLDivElement>(ref, hostRef);
  const viewRef = useRef<EditorView | null>(null);
  // Compartments live in refs so they never read as effect dependencies.
  const vimCompartment = useRef<Compartment | null>(null);
  const dynamicCompartment = useRef<Compartment | null>(null);

  // The mount effect reads live props from here, keeping its dep array empty
  // (and free of exhaustive-deps churn) while still seeing current values.
  const props = { extensions, readOnly, editable, tabSize, placeholder };
  const initRef = useRef({ value, defaultValue, vimMode, showLineNumbers, lineWrapping, ...props });
  initRef.current = { value, defaultValue, vimMode, showLineNumbers, lineWrapping, ...props };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCreateRef = useRef(onCreateEditor);
  onCreateRef.current = onCreateEditor;
  const autoFocusRef = useRef(autoFocus);
  autoFocusRef.current = autoFocus;
  // True while WE push an external `value` into the doc, so the update listener
  // doesn't echo that back through onChange.
  const settingExternal = useRef(false);

  // Create the editor once. Everything it reads is a ref, an import, or a
  // module constant — so the empty dep array is genuinely exhaustive.
  useEffect(() => {
    const parent = hostRef.current;
    if (!parent) return;
    const p = initRef.current;
    const vimC = new Compartment();
    const dynC = new Compartment();
    vimCompartment.current = vimC;
    dynamicCompartment.current = dynC;

    const state = EditorState.create({
      doc: p.value ?? p.defaultValue ?? "",
      extensions: [
        vimC.of(p.vimMode ? vim() : []),
        baseSetup,
        dynC.of(
          buildDynamic({
            lineNumbers: p.showLineNumbers,
            lineWrapping: p.lineWrapping,
            readOnly: p.readOnly,
            editable: p.editable,
            tabSize: p.tabSize,
            placeholder: p.placeholder,
            extensions: p.extensions,
          }),
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !settingExternal.current) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent });
    viewRef.current = view;
    onCreateRef.current?.(view);
    if (autoFocusRef.current) view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Vim toggles independently (kept first for keymap precedence).
  useEffect(() => {
    const view = viewRef.current;
    const c = vimCompartment.current;
    if (view && c) view.dispatch({ effects: c.reconfigure(vimMode ? vim() : []) });
  }, [vimMode]);

  // Rebuild the prop-driven slice on any of its inputs.
  useEffect(() => {
    const view = viewRef.current;
    const c = dynamicCompartment.current;
    if (!view || !c) return;
    view.dispatch({
      effects: c.reconfigure(
        buildDynamic({
          lineNumbers: showLineNumbers,
          lineWrapping,
          readOnly,
          editable,
          tabSize,
          placeholder,
          extensions,
        }),
      ),
    });
  }, [showLineNumbers, lineWrapping, readOnly, editable, tabSize, placeholder, extensions]);

  // Sync a controlled `value` that changed outside the editor.
  useEffect(() => {
    const view = viewRef.current;
    if (view == null || value == null) return;
    const current = view.state.doc.toString();
    if (value === current) return;
    settingExternal.current = true;
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    settingExternal.current = false;
  }, [value]);

  return <div {...rest} ref={setRefs} className={cx(styles.root, className)} />;
});
