import type { KeyboardEvent, ReactElement } from "react";
import { useCallback, useEffect, useRef } from "react";
import { DatePicker } from "../DatePicker";
import { DigitInputMicro } from "../DigitInputMicro";
import { Picker } from "../Picker";
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
 *  at a wrapper element (DigitInputMicro, DatePicker), not the input itself. */
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

// --- Number: the variable-length DigitInputMicro ---------------------------

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
    <DigitInputMicro
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

// --- Boolean: a two-option Picker (True / False) ---------------------------

const BOOLEAN_ITEMS: SelectOption[] = [
  { value: "true", label: "True" },
  { value: "false", label: "False" },
];

function BooleanEditor({ value, onCommit, onCancel }: Omit<EditorProps, "config">) {
  const rootRef = useFocusInner();

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Picker
      ref={rootRef}
      className={styles.editor}
      items={BOOLEAN_ITEMS}
      value={value ? "true" : "false"}
      clearable={false}
      placeholder=""
      onChange={(v) => {
        if (v) onCommit(v === "true", "down");
      }}
      onKeyDown={handleKey}
    />
  );
}

// --- Select: a searchable single-choice Picker -----------------------------

function SelectEditor({
  value,
  options,
  onCommit,
  onCancel,
}: Omit<EditorProps, "config"> & { options: SelectOption[] }) {
  const rootRef = useFocusInner();

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Picker
      ref={rootRef}
      className={styles.editor}
      items={options}
      value={value == null ? "" : String(value)}
      clearable={false}
      placeholder=""
      onChange={(v) => {
        if (v) onCommit(v, "down");
      }}
      onKeyDown={handleKey}
    />
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Render a value the way its editor presents it, so an editable cell's resting
 * display matches what appears when it's activated — no jump from `true` to
 * `True`, a raw select value to its label, or an ISO string to a `Date`'s
 * `toString()`. Used for editable columns that don't supply a custom `cell`.
 */
export function formatEditDisplay(value: unknown, config: EditConfig): string {
  switch (config.type) {
    case "boolean":
      return value ? "True" : "False";
    case "select": {
      const opt = config.options.find((o) => o.value === String(value));
      return opt ? opt.label : value == null ? "" : String(value);
    }
    case "number": {
      const n = toNumber(value);
      if (n == null) return "";
      return `${n.toFixed(config.decimals ?? 0)}${config.unit ? ` ${config.unit}` : ""}`;
    }
    case "date": {
      const d = toDate(value);
      return d ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` : "";
    }
    default:
      return value == null ? "" : String(value);
  }
}
