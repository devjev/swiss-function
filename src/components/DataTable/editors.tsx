import type { KeyboardEvent, ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { Checkbox } from "../Checkbox";
import { Input } from "../Input";
import styles from "./DataTable.module.css";
import type { AdvanceHint, EditConfig, SelectOption } from "./types";

export interface EditorProps {
  value: unknown;
  config: EditConfig;
  onCommit: (value: unknown, advance?: AdvanceHint) => void;
  onCancel: () => void;
  /** Optional initial keystroke to seed the editor (type-to-edit). */
  initialText?: string;
}

export function CellEditor({
  value,
  config,
  onCommit,
  onCancel,
  initialText,
}: EditorProps): ReactElement {
  switch (config.type) {
    case "text":
      return (
        <TextEditor
          value={value}
          onCommit={onCommit}
          onCancel={onCancel}
          initialText={initialText}
        />
      );
    case "number":
      return (
        <NumberEditor
          value={value}
          onCommit={onCommit}
          onCancel={onCancel}
          initialText={initialText}
        />
      );
    case "boolean":
      return <BooleanEditor value={value} onCommit={onCommit} onCancel={onCancel} />;
    case "select":
      return (
        <SelectEditor
          value={value}
          options={config.options}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      );
  }
}

function TextEditor({ value, onCommit, onCancel, initialText }: Omit<EditorProps, "config">) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string>(initialText ?? (value == null ? "" : String(value)));

  useEffect(() => {
    // Spreadsheet convention: focus places caret at end of existing value
    // (typing appends). Type-to-edit replaces because the editor mounts with
    // draft = initialText, not the prior value.
    inputRef.current?.focus();
  }, []);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onCommit(draft, e.shiftKey ? "up" : "down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      onCommit(draft, e.shiftKey ? "leftWrap" : "rightWrap");
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Input
      ref={inputRef}
      className={styles.editor}
      value={draft}
      onChange={(e) => setDraft((e.target as HTMLInputElement).value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={handleKey}
    />
  );
}

function NumberEditor({ value, onCommit, onCancel, initialText }: Omit<EditorProps, "config">) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string>(initialText ?? (value == null ? "" : String(value)));

  useEffect(() => {
    // Spreadsheet convention: focus places caret at end of existing value
    // (typing appends). Type-to-edit replaces because the editor mounts with
    // draft = initialText, not the prior value.
    inputRef.current?.focus();
  }, []);

  const commit = (advance?: AdvanceHint) => {
    const parsed = Number(draft);
    onCommit(Number.isNaN(parsed) ? null : parsed, advance);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(e.shiftKey ? "up" : "down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit(e.shiftKey ? "leftWrap" : "rightWrap");
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Input
      ref={inputRef}
      type="number"
      className={styles.editor}
      value={draft}
      onChange={(e) => setDraft((e.target as HTMLInputElement).value)}
      onBlur={() => commit()}
      onKeyDown={handleKey}
    />
  );
}

function BooleanEditor({ value, onCommit, onCancel }: Omit<EditorProps, "config">) {
  // Boolean cells toggle immediately on edit-mode entry — no separate commit.
  // Intentionally fires once on mount; consumers re-render with the new value.
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot intent
  useEffect(() => {
    onCommit(!value);
  }, []);
  return <Checkbox checked={!value} onClick={onCancel} />;
}

function SelectEditor({
  value,
  options,
  onCommit,
  onCancel,
}: Omit<EditorProps, "config"> & { options: SelectOption[] }) {
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <select
      ref={ref}
      className={styles.selectEditor}
      defaultValue={value == null ? "" : String(value)}
      onChange={(e) => onCommit(e.target.value)}
      onBlur={() => onCancel()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
