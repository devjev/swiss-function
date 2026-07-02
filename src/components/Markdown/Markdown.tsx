import type { ComponentProps, HTMLAttributes, KeyboardEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  /** Render inline — uses `<span>` wrappers and flattens paragraphs so the
   *  output is safe to embed inside `<p>` or other inline contexts. Block
   *  elements (headings, lists, code blocks) still produce their natural
   *  HTML, but in inline mode they're rare anyway. Editing is unsupported. */
  inline?: boolean;
  /** Cap prose to a comfortable reading width (`--sf-measure`, ~65ch);
   *  code, tables, and figures spill to `--sf-measure-wide`. Off by
   *  default so existing call sites are unchanged. `<Prose>` sets it on. */
  measured?: boolean;
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
    inline = false,
    measured = false,
    className,
    ...rest
  } = props;

  const rootClass = cx(styles.root, measured && styles.measured, className);

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
    () =>
      inline ? { p: ({ children }) => <>{children}</>, ...(components ?? {}) } : (components ?? {}),
    [inline, components],
  );
  const source = useMemo(() => (preprocess ? preprocess(value) : value), [preprocess, value]);

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
      remarkPlugins={REMARK_PLUGINS}
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
