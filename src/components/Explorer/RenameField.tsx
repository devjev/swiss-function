import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Input } from "../Input";
import styles from "./Explorer.module.css";

interface RenameFieldProps {
  initialValue: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
}

export function RenameField({ initialValue, onCommit, onCancel }: RenameFieldProps) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onCommit(value.trim() || initialValue);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else {
      // Don't let arrow keys etc. bubble up to the row navigation.
      e.stopPropagation();
    }
  };

  return (
    <Input
      ref={ref}
      className={styles.renameInput}
      inputSize="sm"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKey}
      onBlur={() => onCommit(value.trim() || initialValue)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}
