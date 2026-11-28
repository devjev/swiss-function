import type { ComponentProps, HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import {
  Children,
  isValidElement,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cx } from "../../lib/cx";
import { TextEdit } from "../TextEdit";
import styles from "./Markdown.module.css";

type ReactMarkdownComponents = ComponentProps<typeof ReactMarkdown>["components"];

// react-markdown re-runs the full remark/rehype parse on EVERY invocation, so
// skippability is the whole optimization: with stable props (module-const
// plugins, memoized components map, string children) a parent re-render that
// doesn't change the source skips the parse entirely. This is what keeps a
// Chat keystroke from re-parsing a whole transcript of static messages.
const MemoizedReactMarkdown = memo(ReactMarkdown);
const REMARK_PLUGINS = [remarkGfm];

/** How the rendered markdown reads. `"prose"` is the document reading: the sans
 *  face, sized headings, boxed code. `"terminal"` is the reading of a terminal
 *  that renders markdown: one monospace size, headings told apart by weight, an
 *  underline and their `###`, fences kept around code with no box, `-` bullets,
 *  and tables ruled like box drawing. */
export type MarkdownVariant = "prose" | "terminal";

/** A fenced block in the terminal reading: the `pre` carries the fence's
 *  language (`data-lang`), which the stylesheet prints after the opening
 *  fence. */
function TerminalPre({
  node: _node,
  children,
  ...rest
}: ComponentProps<"pre"> & { node?: unknown; children?: ReactNode }) {
  const first = Children.toArray(children)[0];
  const code = isValidElement<{ className?: string; children?: ReactNode }>(first)
    ? first.props
    : null;
  const cls = code?.className ?? "";
  const lang = /language-(\S+)/.exec(cls)?.[1] ?? "";
  const text = typeof code?.children === "string" ? code.children : null;
  // The highlighter is fetched by the first block that names a language and
  // shared after that; until it lands the block shows its plain code.
  const [hl, setHl] = useState<Highlighter | null>(highlighter);
  const wants = text != null && lang !== "";
  useEffect(() => {
    if (!wants || hl) return;
    let live = true;
    void loadHighlighter().then((module) => {
      if (live) setHl(module);
    });
    return () => {
      live = false;
    };
  }, [wants, hl]);
  // A known language is highlighted. A block the streaming reveal is still
  // writing (shade glyphs at its tail) is left to the reveal's own styling
  // until its text has landed.
  if (hl && text != null && hl.knowsLanguage(lang) && !STREAMING_TAIL.test(text)) {
    return (
      <pre {...rest} data-lang={lang}>
        <code className={cls}>
          {hl.highlightCode(text.replace(/\n$/, ""), lang).map((token, i) =>
            token.kind ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional and re-made with the text.
              <span key={i} data-token={token.kind}>
                {token.text}
              </span>
            ) : (
              token.text
            ),
          )}
        </code>
      </pre>
    );
  }
  return (
    <pre {...rest} data-lang={lang}>
      {children}
    </pre>
  );
}

/** The shade glyphs `StreamingTerminalText` puts at the tail of text it is
 *  still revealing. */
const STREAMING_TAIL = /[▒▓█]/;

/** The code highlighter, loaded on demand: only the terminal reading's fenced
 *  blocks use it, so the prose reading (Prose, the Outliner) carries none of
 *  it. */
type Highlighter = typeof import("./highlight");
let highlighter: Highlighter | null = null;
let loadingHighlighter: Promise<Highlighter> | null = null;
function loadHighlighter(): Promise<Highlighter> {
  loadingHighlighter ??= import("./highlight").then((module) => {
    highlighter = module;
    return module;
  });
  return loadingHighlighter;
}

const TERMINAL_COMPONENTS: ReactMarkdownComponents = { pre: TerminalPre };

export interface MarkdownProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Markdown source. */
  value: string;
  /** Allow double-click to switch into edit mode. */
  editable?: boolean;
  /** Called when an edit is committed (blur, or Cmd/Ctrl+Enter). */
  onChange?: (next: string) => void;
  /** Placeholder shown when `value` is empty. */
  placeholder?: string;
  /** Minimum rows for the textarea when editing. Default 4. */
  editRows?: number;
  /** Transform the source string before parsing — for syntax extensions
   *  (e.g. wiki links). Applied only in render mode, not the editor. */
  preprocess?: (source: string) => string;
  /** Override react-markdown's component renderers. */
  components?: ReactMarkdownComponents;
  /** Override URL sanitization. Pass `(url) => url` to allow custom schemes
   *  (e.g. `wiki:` for Outliner-style links). */
  urlTransform?: ComponentProps<typeof ReactMarkdown>["urlTransform"];
  /** Further remark plugins, run after remark-gfm (e.g. a syntax extension
   *  that needs the parsed tree, as the Outliner's highlights do). Pass a
   *  stable array, from module scope or a memo: a new array re-parses the
   *  source on every render. */
  remarkPlugins?: ComponentProps<typeof ReactMarkdown>["remarkPlugins"];
  /** Render inline — uses `<span>` wrappers and flattens paragraphs so the
   *  output is safe to embed inside `<p>` or other inline contexts. Block
   *  elements (headings, lists, code blocks) still produce their natural
   *  HTML, but in inline mode they're rare anyway. Editing is unsupported. */
  inline?: boolean;
  /** Cap prose to a comfortable reading width (`--sf-measure`, ~65ch);
   *  code, tables, and figures spill to `--sf-measure-wide`. Off by
   *  default so existing call sites are unchanged. `<Prose>` sets it on. */
  measured?: boolean;
  /** `"prose"` (default) or `"terminal"`: one monospace size on the unit grid,
   *  as a terminal renders markdown. `Chat` uses it for a reply. */
  variant?: MarkdownVariant;
}

export function Markdown(props: MarkdownProps) {
  const {
    value,
    editable = false,
    onChange,
    placeholder = "Nothing here yet.",
    editRows = 4,
    preprocess,
    components,
    urlTransform,
    remarkPlugins,
    inline = false,
    measured = false,
    variant = "prose",
    className,
    ...rest
  } = props;

  const terminal = variant === "terminal";
  const rootClass = cx(
    styles.root,
    measured && styles.measured,
    terminal && styles.terminal,
    className,
  );

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const startEdit = useCallback(() => {
    if (!editable) return;
    setDraft(value);
    setEditing(true);
  }, [editable, value]);

  const commit = useCallback(() => {
    onChange?.(draft);
    setEditing(false);
  }, [onChange, draft]);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      const len = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(len, len);
    }
  }, [editing]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  };

  // In inline mode, flatten paragraph wrappers and use span elements so the
  // output can live inside `<p>`/`<code>`/etc. without invalid HTML nesting.
  // Memoized (and placed before the `editing` early return — hook order) so
  // the renderer's props stay referentially stable across re-renders.
  const effectiveComponents: ReactMarkdownComponents = useMemo(
    () => ({
      ...(terminal ? TERMINAL_COMPONENTS : null),
      ...(inline ? { p: ({ children }: { children?: ReactNode }) => <>{children}</> } : null),
      ...(components ?? {}),
    }),
    [inline, components, terminal],
  );
  const source = useMemo(() => (preprocess ? preprocess(value) : value), [preprocess, value]);
  const plugins = useMemo(
    () => (remarkPlugins?.length ? [...REMARK_PLUGINS, ...remarkPlugins] : REMARK_PLUGINS),
    [remarkPlugins],
  );

  if (editing) {
    const rows = Math.max(editRows, draft.split("\n").length + 1);
    return (
      <div {...rest} className={rootClass}>
        <TextEdit
          ref={textareaRef}
          value={draft}
          rows={rows}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
        />
      </div>
    );
  }

  const isEmpty = value.trim() === "";

  const body = isEmpty ? (
    <span className={styles.empty}>{placeholder}</span>
  ) : (
    <MemoizedReactMarkdown
      remarkPlugins={plugins}
      components={effectiveComponents}
      urlTransform={urlTransform}
    >
      {source}
    </MemoizedReactMarkdown>
  );

  if (inline) {
    return (
      <span className={rootClass}>
        <span className={cx(styles.rendered, editable && styles.editable)}>{body}</span>
      </span>
    );
  }

  return (
    <div {...rest} className={rootClass}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: editing mode is mouse-driven by
          design (double-click). Keyboard users can wire an Edit button via a custom trigger. */}
      <div
        className={cx(styles.rendered, editable && styles.editable)}
        onDoubleClick={editable ? startEdit : undefined}
      >
        {body}
      </div>
    </div>
  );
}
