import type { DragEvent, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import styles from "./Dropzone.module.css";

export interface DropzoneProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** The current files (controlled). Pass with `onFilesChange`. */
  files?: File[];
  /** Initial files (uncontrolled). */
  defaultFiles?: File[];
  /** Called with the full file list after a drop, browse, or removal. */
  onFilesChange?: (files: File[]) => void;
  /** `accept` attribute forwarded to the native file input (e.g. `"image/*,.pdf"`). */
  accept?: string;
  /** Allow more than one file. When `false`, a new pick replaces the list. Default `true`. */
  multiple?: boolean;
  /** Disable the whole control. */
  disabled?: boolean;
  /** Primary prompt inside the zone. */
  label?: ReactNode;
  /** Secondary line under the label. */
  description?: ReactNode;
  /** Glyph/icon shown above the label. */
  icon?: ReactNode;
  /** Render the built-in removable file list below the zone. Default `true`. */
  showList?: boolean;
  /** Per-file trailing slot — e.g. an upload progress bar or error. */
  fileStatus?: (file: File, index: number) => ReactNode;
}

/** Human-readable file size. Binary units (KiB-based), labelled KB/MB/… as is
 *  conventional in file UIs. One decimal below 10 of a unit, none above. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

// Cheap identity for a File — used to dedupe re-added files and as the list key.
const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

/**
 * A drag-and-drop file zone (with click-to-browse) that surfaces the chosen
 * files via `onFilesChange` and renders them as a removable list. Presentational
 * only — the actual upload (network, progress) stays the consumer's job; feed
 * per-file progress/error back through the `fileStatus` slot.
 */
export const Dropzone = forwardRef<HTMLDivElement, DropzoneProps>(function Dropzone(
  {
    files,
    defaultFiles,
    onFilesChange,
    accept,
    multiple = true,
    disabled,
    label = "Drop files here",
    description = "or click to browse",
    icon = "⤓",
    showList = true,
    fileStatus,
    className,
    ...rest
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internal, setInternal] = useState<File[]>(defaultFiles ?? []);
  const [dragging, setDragging] = useState(false);
  const isControlled = files !== undefined;
  const current = isControlled ? files : internal;

  const commit = (next: File[]) => {
    if (!isControlled) setInternal(next);
    onFilesChange?.(next);
  };

  const addFiles = (incoming: FileList | File[] | null) => {
    if (!incoming || disabled) return;
    const list = Array.from(incoming);
    if (!list.length) return;
    if (!multiple) {
      commit(list.slice(0, 1));
      return;
    }
    // Append, skipping files already present (by cheap identity).
    const seen = new Set(current.map(fileKey));
    const merged = [...current];
    for (const f of list) {
      const k = fileKey(f);
      if (!seen.has(k)) {
        seen.add(k);
        merged.push(f);
      }
    }
    commit(merged);
  };

  const removeAt = (index: number) => commit(current.filter((_, i) => i !== index));

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLButtonElement>) => {
    // Ignore leaves into descendants — only clear when the pointer exits the zone.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragging(false);
  };

  return (
    <div {...rest} ref={ref} className={cx(styles.root, className)}>
      <button
        type="button"
        className={styles.zone}
        data-dragging={dragging || undefined}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
        <span className={styles.label}>{label}</span>
        {description && <span className={styles.description}>{description}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        className={styles.input}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          addFiles(e.target.files);
          // Reset so re-picking the same file fires `change` again.
          e.target.value = "";
        }}
      />
      {showList && current.length > 0 && (
        <ul className={styles.list}>
          {current.map((file, i) => (
            <li key={fileKey(file)} className={styles.file}>
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.fileSize}>{formatBytes(file.size)}</span>
              {fileStatus && <span className={styles.fileStatusSlot}>{fileStatus(file, i)}</span>}
              {!disabled && (
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Remove ${file.name}`}
                  onClick={() => removeAt(i)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
