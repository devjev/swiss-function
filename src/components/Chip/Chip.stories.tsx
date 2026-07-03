import type { Story } from "@ladle/react";
import { useState } from "react";
import { Chip, type ChipTone } from "./Chip";

export default { title: "Chip" };

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: "grid", gap: "0.5rem" }}>
    <span style={{ color: "var(--sf-color-fg-subtle)", fontSize: "var(--sf-font-size-sm)" }}>
      {label}
    </span>
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
      {children}
    </div>
  </div>
);

const TONES: ChipTone[] = ["neutral", "primary", "success", "warning", "danger"];

/** Neutral is the default; tones tint only when the colour is information. */
export const Tones: Story = () => (
  <div style={{ display: "grid", gap: "1.25rem", fontFamily: "var(--sf-font-sans)" }}>
    <Row label="Tones (sharp default)">
      {TONES.map((t) => (
        <Chip key={t} tone={t}>
          {t}
        </Chip>
      ))}
    </Row>
    <Row label="With status dot">
      {TONES.map((t) => (
        <Chip key={t} tone={t} dot>
          {t}
        </Chip>
      ))}
    </Row>
    <Row label="Pill form (round)">
      {TONES.map((t) => (
        <Chip key={t} tone={t} round dot>
          {t}
        </Chip>
      ))}
    </Row>
  </div>
);

/** Both sizes line up on the baseline grid — sm matches a small Button. */
export const Sizes: Story = () => (
  <div style={{ display: "grid", gap: "1.25rem", fontFamily: "var(--sf-font-sans)" }}>
    <Row label="md (default)">
      <Chip>label</Chip>
      <Chip tone="primary" dot>
        active
      </Chip>
      <Chip round tone="success">
        shipped
      </Chip>
    </Row>
    <Row label="sm">
      <Chip size="sm">label</Chip>
      <Chip size="sm" tone="primary" dot>
        active
      </Chip>
      <Chip size="sm" round tone="success">
        shipped
      </Chip>
    </Row>
  </div>
);

/** Removable selections — the ✕ is keyboard-reachable and won't fire the
 *  chip's own onClick. */
export const Removable: Story = () => {
  const [tags, setTags] = useState(["design", "typescript", "swiss", "bauhaus", "tokens"]);
  return (
    <div style={{ display: "grid", gap: "0.75rem", fontFamily: "var(--sf-font-sans)" }}>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", maxWidth: 420 }}>
        {tags.map((t) => (
          <Chip key={t} round onRemove={() => setTags((cur) => cur.filter((x) => x !== t))}>
            {t}
          </Chip>
        ))}
      </div>
      {tags.length === 0 ? (
        <button type="button" onClick={() => setTags(["design", "typescript", "swiss"])}>
          reset
        </button>
      ) : null}
    </div>
  );
};

/** Clickable filter chips — the whole chip is a button (role, focus ring,
 *  Enter/Space). */
export const Filters: Story = () => {
  const all = ["all", "open", "in-review", "merged", "closed"];
  const [active, setActive] = useState("open");
  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        flexWrap: "wrap",
        fontFamily: "var(--sf-font-sans)",
      }}
    >
      {all.map((f) => (
        <Chip
          key={f}
          round
          tone={active === f ? "primary" : "neutral"}
          dot={active === f}
          onClick={() => setActive(f)}
        >
          {f}
        </Chip>
      ))}
    </div>
  );
};

export const Disabled: Story = () => (
  <div style={{ display: "flex", gap: "0.5rem", fontFamily: "var(--sf-font-sans)" }}>
    <Chip disabled>disabled</Chip>
    <Chip disabled tone="primary" dot>
      disabled
    </Chip>
    <Chip disabled round onRemove={() => {}}>
      disabled
    </Chip>
  </div>
);
