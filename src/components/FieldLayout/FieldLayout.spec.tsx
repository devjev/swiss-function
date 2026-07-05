import { expect, test } from "@playwright/experimental-ct-react";
import { DatePicker } from "../DatePicker";
import { Input } from "../Input";
import { TextEdit } from "../TextEdit";
import { FieldLayout } from "./FieldLayout";

// The unit is 1.5rem = 24px at the default root font size.
const U = 24;

test("a rigid field holds its whole-unit width; a row with a filler justifies", async ({
  mount,
}) => {
  const c = await mount(
    <div style={{ width: 720 }}>
      <FieldLayout padding={1}>
        <FieldLayout.Section data-testid="sec">
          <FieldLayout.Field label="Ticker" kind="rigid" width={8}>
            <Input aria-label="Ticker" defaultValue="GEF" />
          </FieldLayout.Field>
          <FieldLayout.Field label="Name">
            <Input aria-label="Name" defaultValue="Fund" />
          </FieldLayout.Field>
          <FieldLayout.Filler data-testid="filler" />
        </FieldLayout.Section>
      </FieldLayout>
    </div>,
  );

  // The rigid control is exactly 8u wide.
  const ticker = c.getByRole("textbox", { name: "Ticker" });
  const tickerBox = await ticker.boundingBox();
  if (!tickerBox) throw new Error("no ticker box");
  expect(tickerBox.width).toBeCloseTo(8 * U, 0);

  // The row justifies: the trailing filler's right edge meets the section's
  // right content edge (everything wide enough to be one line).
  const sec = c.getByTestId("sec");
  const filler = c.getByTestId("filler");
  const [secBox, fillerBox] = await Promise.all([sec.boundingBox(), filler.boundingBox()]);
  if (!secBox || !fillerBox) throw new Error("no box");
  expect(fillerBox.x + fillerBox.width).toBeCloseTo(secBox.x + secBox.width, 0);
});

function threeFields() {
  return (
    <FieldLayout>
      <FieldLayout.Section data-testid="sec">
        <FieldLayout.Field label="A">
          <Input aria-label="A" />
        </FieldLayout.Field>
        <FieldLayout.Field label="B">
          <Input aria-label="B" />
        </FieldLayout.Field>
        <FieldLayout.Field label="C">
          <Input aria-label="C" />
        </FieldLayout.Field>
      </FieldLayout.Section>
    </FieldLayout>
  );
}

test("wide: three flexible fields share one line (flex-wrap breaks on the 14u basis)", async ({
  mount,
}) => {
  // Three 14u-basis fields share a line only past ~1104px (3×336 + 2×24 gap +
  // 2×24 pad) — wrapping is basis-driven, not min-driven.
  const c = await mount(<div style={{ width: 1140 }}>{threeFields()}</div>);
  const [a, b, cc] = await Promise.all(
    ["A", "B", "C"].map((n) => c.getByRole("textbox", { name: n }).boundingBox()),
  );
  expect(a?.y).toBeCloseTo(b?.y ?? -1, 0);
  expect(b?.y).toBeCloseTo(cc?.y ?? -1, 0);
});

test("narrow: rows carry fewer fields and keep strict source order", async ({ mount }) => {
  const c = await mount(<div style={{ width: 360 }}>{threeFields()}</div>);
  const [a, b, cc] = await Promise.all(
    ["A", "B", "C"].map((n) => c.getByRole("textbox", { name: n }).boundingBox()),
  );
  if (!a || !b || !cc) throw new Error("no box");
  // Each stands alone at this width; strict source order means they stack A→B→C
  // top to bottom (never reordered, unlike a grid dense pack).
  expect(b.y).toBeGreaterThan(a.y);
  expect(cc.y).toBeGreaterThan(b.y);
});

test("the label associates with a composite control (DatePicker) as its accessible name", async ({
  mount,
}) => {
  const c = await mount(
    <FieldLayout>
      <FieldLayout.Section>
        <FieldLayout.Field label="Valid from" kind="rigid" width={8}>
          <DatePicker defaultValue={new Date(2026, 6, 1)} />
        </FieldLayout.Field>
      </FieldLayout.Section>
    </FieldLayout>,
  );
  // Not the YYYY-MM-DD placeholder — the label.
  await expect(c.getByRole("combobox", { name: "Valid from" })).toBeVisible();
});

test("a resizable control defaults to a whole-unit height and snaps after a resize", async ({
  mount,
}) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <FieldLayout>
        <FieldLayout.Section>
          <FieldLayout.Field label="Notes" kind="prose">
            <TextEdit aria-label="Notes" rows={4} />
          </FieldLayout.Field>
        </FieldLayout.Section>
      </FieldLayout>
    </div>,
  );
  const ta = c.getByRole("textbox", { name: "Notes" });

  // rows=4 paints at 4.5u (108px); the snap lifts it onto the grid on mount.
  await expect
    .poll(async () => {
      const h = (await ta.boundingBox())?.height ?? 0;
      return Math.round(h) % U;
    })
    .toBe(0);

  // Simulate a drag-resize to an off-grid height; it snaps to the nearest unit.
  await ta.evaluate((el) => {
    (el as HTMLElement).style.height = "100px";
  });
  await expect.poll(async () => Math.round((await ta.boundingBox())?.height ?? 0)).toBe(4 * U); // 100px → nearest 4u = 96px
});

test("a rigid control keeps its width when narrow; the hint wraps beneath (issue #33)", async ({
  mount,
}) => {
  const c = await mount(
    <div style={{ width: 300 }}>
      <FieldLayout>
        <FieldLayout.Section>
          <FieldLayout.Field label="Valid from" kind="rigid" width={8} hint="Effective date.">
            <DatePicker data-testid="dp" defaultValue={new Date(2026, 6, 1)} />
          </FieldLayout.Field>
        </FieldLayout.Section>
      </FieldLayout>
    </div>,
  );
  // The rigid DatePicker's outer box still holds 8u even though 8u + gap +
  // hint(10u) can't fit the 300px field — the hint wraps below instead of
  // squishing it. (The inner combobox is narrower — field padding + clear.)
  const dpBox = await c.getByTestId("dp").boundingBox();
  if (!dpBox) throw new Error("no datepicker box");
  expect(dpBox.width).toBeCloseTo(8 * U, 0);
});

test("the Field label wins over a control's own aria-label as the accessible name", async ({
  mount,
}) => {
  const c = await mount(
    <FieldLayout>
      <FieldLayout.Section>
        <FieldLayout.Field label="Correct name">
          <Input aria-label="Wrong name" />
        </FieldLayout.Field>
      </FieldLayout.Section>
    </FieldLayout>,
  );
  await expect(c.getByRole("textbox", { name: "Correct name" })).toBeVisible();
  await expect(c.getByRole("textbox", { name: "Wrong name" })).toHaveCount(0);
});
