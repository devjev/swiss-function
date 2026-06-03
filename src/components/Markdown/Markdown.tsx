import type { ComponentProps, HTMLAttributes, KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cx } from "../../lib/cx";
import { TextEdit } from "../TextEdit";
import styles from "./Markdown.module.css";

type ReactMarkdownComponents = ComponentProps<typeof ReactMarkdown>["components"];

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
    className,
    ...rest
  } = props;

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

  if (editing) {
    const rows = Math.max(editRows, draft.split("\n").length + 1);
    return (
      <div {...rest} className={cx(styles.root, className)}>
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

  // In inline mode, flatten paragraph wrappers and use span elements so the
  // output can live inside `<p>`/`<code>`/etc. without invalid HTML nesting.
  const effectiveComponents: ReactMarkdownComponents = inline
    ? { p: ({ children }) => <>{children}</>, ...(components ?? {}) }
    : (components ?? {});

  const body = isEmpty ? (
    <span className={styles.empty}>{placeholder}</span>
  ) : (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={effectiveComponents}
      urlTransform={urlTransform}
    >
      {preprocess ? preprocess(value) : value}
    </ReactMarkdown>
  );

  if (inline) {
    return (
      <span className={cx(styles.root, className)}>
        <span className={cx(styles.rendered, editable && styles.editable)}>{body}</span>
      </span>
    );
  }

  return (
    <div {...rest} className={cx(styles.root, className)}>
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
