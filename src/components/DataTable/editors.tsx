import type { KeyboardEvent, ReactElement } from "react";
import { useCallback, useEffect, useRef } from "react";
import { Checkbox } from "../Checkbox";
import { DatePicker } from "../DatePicker";
import { DigitField } from "../DigitField";
import { TextEditInline } from "../TextEditInline";
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
          config={config}
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
    case "date":
      return <DateEditor value={value} config={config} onCommit={onCommit} onCancel={onCancel} />;
  }
}

/** Callback ref that focuses the first native input/textarea inside a mounted
 *  editor root and puts the caret at the end — used by editors whose ref points
 *  at a wrapper element (DigitField, DatePicker), not the input itself. */
function useFocusInner() {
  return useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const el = node.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange?.(len, len);
  }, []);
}

// --- Text: the floating inline text editor ---------------------------------

function TextEditor({ value, onCommit, onCancel, initialText }: Omit<EditorProps, "config">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const draft = useRef<string>(initialText ?? (value == null ? "" : String(value)));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, []);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Enter commits; Shift+Enter falls through to insert a newline.
      e.preventDefault();
      onCommit(draft.current, "down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      onCommit(draft.current, e.shiftKey ? "leftWrap" : "rightWrap");
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <TextEditInline
      ref={ref}
      className={styles.textEditor}
      defaultValue={draft.current}
      onChange={(e) => {
        draft.current = e.target.value;
      }}
      onBlur={() => onCommit(draft.current)}
      onKeyDown={handleKey}
    />
  );
}

// --- Number: the variable-length DigitField --------------------------------

function NumberEditor({
  value,
  config,
  onCommit,
  onCancel,
  initialText,
}: Pick<EditorProps, "value" | "config" | "onCommit" | "onCancel" | "initialText">) {
  const rootRef = useFocusInner();
  const seed = initialText != null && initialText !== "" ? Number(initialText) : toNumber(value);
  const draft = useRef<number | null>(Number.isNaN(seed as number) ? null : seed);

  const decimals = config.type === "number" ? (config.decimals ?? 0) : 0;
  const slots = config.type === "number" ? (config.slots ?? 4) : 4;
  const unit = config.type === "number" ? config.unit : undefined;

  const handleKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onCommit(draft.current, e.shiftKey ? "up" : "down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      onCommit(draft.current, e.shiftKey ? "leftWrap" : "rightWrap");
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <DigitField
      ref={rootRef}
      className={styles.editor}
      defaultValue={draft.current}
      slots={slots}
      decimals={decimals}
      unit={unit}
      onValueChange={(v) => {
        draft.current = v;
      }}
      onBlur={() => onCommit(draft.current)}
      onKeyDown={handleKey}
    />
  );
}

// --- Date: the DatePicker --------------------------------------------------

function DateEditor({
  value,
  config,
  onCommit,
  onCancel,
}: Pick<EditorProps, "value" | "config" | "onCommit" | "onCancel">) {
  const rootRef = useFocusInner();
  const initial = toDate(value);
  const minDate = config.type === "date" ? config.minDate : undefined;
  const maxDate = config.type === "date" ? config.maxDate : undefined;

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // DatePicker consumes Escape to close its popup; when the popup is already
    // closed the key reaches here and cancels the edit.
    if (e.key === "Escape") onCancel();
  };

  return (
    <DatePicker
      ref={rootRef}
      className={styles.editor}
      defaultValue={initial}
      minDate={minDate}
      maxDate={maxDate}
      onChange={(date) => onCommit(date, "down")}
      onKeyDown={handleKey}
    />
  );
}

// --- Boolean: immediate toggle (unchanged) ---------------------------------

function BooleanEditor({ value, onCommit, onCancel }: Omit<EditorProps, "config">) {
  // Boolean cells toggle immediately on edit-mode entry — no separate commit.
  // Intentionally fires once on mount; consumers re-render with the new value.
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot intent
  useEffect(() => {
    onCommit(!value);
  }, []);
  return <Checkbox checked={!value} onClick={onCancel} />;
}

// --- Select: native dropdown (unchanged) -----------------------------------

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

// --- coercion helpers ------------------------------------------------------

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function toDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value;
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}
