import type { Story } from "@ladle/react";
import { useState } from "react";
import { Box } from "../Box";
import { Button } from "../Button";
import { Field } from "../Field";
import { Input } from "../Input";
import { GridOverlay, type GridPick } from "./GridOverlay";

/** A small layout to lay the grid over: a titled box with two fields and two
 *  keys, all on the unit. */
function Sample() {
  return (
    <Box
      elevation={1}
      style={{
        display: "grid",
        gap: "var(--sf-unit)",
        padding: "var(--sf-unit)",
        maxInlineSize: "calc(var(--sf-unit) * 24)",
      }}
    >
      <h2 style={{ margin: 0, fontSize: "var(--sf-font-size-lg)", lineHeight: "var(--sf-unit)" }}>
        Account
      </h2>
      <p style={{ margin: 0 }}>Where the statements go, and who signs them.</p>
      <Field orientation="vertical">
        <Field.Label>Email</Field.Label>
        <Input type="email" placeholder="name@example.com" />
      </Field>
      <Field orientation="vertical">
        <Field.Label>Signatory</Field.Label>
        <Input placeholder="Full name" />
      </Field>
      <div style={{ display: "flex", gap: "calc(var(--sf-unit) / 2)" }}>
        <Button variant="primary">Save</Button>
        <Button>Cancel</Button>
      </div>
    </Box>
  );
}

/**
 * The unit grid over a layout. A cell is one unit square and has a name,
 * `row:col`, counted from 1 at the top left; the stronger lines every five
 * cells carry their names, the accent lines are where body text sits, and the
 * pointer's cell is named beside it. **Pick** in the panel: a press names a
 * cell, a drag a range (`3:2-5:10`), and the name is copied, ready to paste to
 * an agent. Escape leaves pick mode. On any story, `?grid` turns it on and
 * Alt+Shift+G toggles it.
 */
export const Default: Story = () => {
  const [picks, setPicks] = useState<GridPick[]>([]);
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)" }}>
      <div
        style={{
          position: "relative",
          inlineSize: "calc(var(--sf-unit) * 32)",
          blockSize: "calc(var(--sf-unit) * 22)",
        }}
      >
        <Sample />
        <GridOverlay onPick={(p) => setPicks((prev) => [...prev, p].slice(-3))} />
      </div>
      <output style={{ fontFamily: "var(--sf-font-mono)" }}>
        {picks.length > 0 ? `picked ${picks.map((p) => p.text).join(", ")}` : "nothing picked"}
      </output>
    </div>
  );
};

/**
 * Marks outline places by name (`marks={["2:2-2:12", "6:2-9:23"]}`, or
 * `&mark=2:2-2:12,6:2-9:23` on any story with `?grid`): how an agent shows what
 * it means. Here without the panel.
 */
export const Marks: Story = () => (
  <div
    style={{
      position: "relative",
      inlineSize: "calc(var(--sf-unit) * 32)",
      blockSize: "calc(var(--sf-unit) * 22)",
    }}
  >
    <Sample />
    <GridOverlay panel={false} marks={["2:2-2:12", "6:2-9:23", "19:2-20:9"]} />
  </div>
);

/** Coarser cells for coarser talk: `cell={4}`, so `2:3` is the four-unit square
 *  in the second row and third column. The baselines stay at every unit. */
export const CellSize: Story = () => (
  <div
    style={{
      position: "relative",
      inlineSize: "calc(var(--sf-unit) * 32)",
      blockSize: "calc(var(--sf-unit) * 24)",
    }}
  >
    <Sample />
    <GridOverlay cell={4} major={2} panel={false} />
  </div>
);
