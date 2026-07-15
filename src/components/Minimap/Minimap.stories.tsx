import type { Story } from "@ladle/react";
import type { MinimapMarker } from "./Minimap";
import { Minimap } from "./Minimap";

/* Deterministic long document: numbered sections of fixed-length prose, so the
   stories are VRT-stable (no randomness, no dates). */

const SECTION_COUNT = 24;
const PARAGRAPHS_PER_SECTION = 4;

const PARAGRAPH =
  "The grid is the invariant. Content flows into columns, columns hold the " +
  "measure, and the measure keeps the line length readable. Structure is " +
  "visible in the spacing, not in decoration; what recedes stays out of the " +
  "way until the reader asks for it.";

function Section({ index }: { index: number }) {
  return (
    <section>
      <h3 style={{ margin: "var(--sf-unit) 0 calc(var(--sf-unit) / 2)" }}>
        {index + 1}. Section {index + 1}
      </h3>
      {Array.from({ length: PARAGRAPHS_PER_SECTION }, (_, p) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static generated prose; the index is the identity
        <p key={p} style={{ margin: "0 0 calc(var(--sf-unit) / 2)" }}>
          {PARAGRAPH}
        </p>
      ))}
    </section>
  );
}

function LongDocument() {
  return (
    <div style={{ padding: "0 var(--sf-unit)" }}>
      {Array.from({ length: SECTION_COUNT }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static generated sections; the index is the identity
        <Section key={i} index={i} />
      ))}
    </div>
  );
}

/* Section markers as data: fractions, since the section rhythm is uniform.
   Every third section is a header marker (clickable label plus rule), the
   rest are block rules; two tones mark "status" sections. */
const sectionMarkers: MinimapMarker[] = Array.from({ length: SECTION_COUNT }, (_, i) => ({
  id: `s${i}`,
  topFraction: i / SECTION_COUNT,
  kind: i % 3 === 0 ? ("header" as const) : ("block" as const),
  label: `Section ${i + 1}`,
  level: i % 3 === 0 ? 2 : 3,
  tone: i === 9 ? ("warning" as const) : i === 15 ? ("danger" as const) : undefined,
}));

const frame: React.CSSProperties = {
  height: "24rem",
  border: "1px solid var(--sf-color-border)",
};

export const TallDocument: Story = () => (
  <div style={frame}>
    <Minimap markers={sectionMarkers}>
      <LongDocument />
    </Minimap>
  </div>
);

export const LeftRail: Story = () => (
  <div style={frame}>
    <Minimap markers={sectionMarkers} side="left">
      <LongDocument />
    </Minimap>
  </div>
);

export const ShortContent: Story = () => (
  <div style={frame}>
    <Minimap markers={[{ id: "only", top: 0 }]}>
      <div style={{ padding: "var(--sf-unit)" }}>
        <h3 style={{ margin: "0 0 calc(var(--sf-unit) / 2)" }}>Fits the viewport</h3>
        <p style={{ margin: 0 }}>
          No scrollable overflow, so the rail collapses and the content takes the full width.
        </p>
      </div>
    </Minimap>
  </div>
);

/* Block spans mark ranges of the document (chapters, changed regions, search
   hits). Each is a fraction of the whole content, so its edges are section
   boundaries here. The blocks below cover sections 2 to 4 (blue), 9 to 14
   (neutral), and 18 to 21 (green). */
export const BlockSpans: Story = () => (
  <div style={{ display: "grid", gap: "var(--sf-unit)", maxWidth: "60rem" }}>
    <div style={{ color: "var(--sf-color-fg)", fontSize: "var(--sf-font-size-sm)" }}>
      <p style={{ margin: "0 0 calc(var(--sf-unit) / 2)" }}>
        The three dither blocks mark ranges of the document:{" "}
        <b style={{ color: "var(--sf-color-primary)" }}>blue</b> is sections 2 to 4, <b>neutral</b>{" "}
        is sections 9 to 14, and <b style={{ color: "var(--sf-color-success)" }}>green</b> is
        sections 18 to 21. Each block is a fraction of the whole content (
        {"{ topFraction, heightFraction }"}), so its top and bottom edges sit at those section
        boundaries on the rail.
      </p>
      <p style={{ margin: 0 }}>
        The thin highlighted strip is the <b>viewport</b>, the slice of the document on screen right
        now, not a cursor at the current heading. It is one screenful tall (here about one section),
        so as you scroll it slides through the blocks and straddles a block edge whenever your
        screen spans that boundary: with a heading centred, the top of your screen is still in the
        section above, so the strip overlaps the block that section belongs to. A block fully
        contains the strip only while your whole screen is inside that block's range.
      </p>
    </div>
    <div style={frame}>
      <Minimap
        markers={[
          // Sections 2 to 4.
          { id: "a", topFraction: 1 / 24, heightFraction: 3 / 24, tone: "primary" },
          // Sections 9 to 14.
          { id: "b", topFraction: 8 / 24, heightFraction: 6 / 24 },
          // Sections 18 to 21.
          { id: "c", topFraction: 17 / 24, heightFraction: 4 / 24, tone: "success" },
        ]}
      >
        <LongDocument />
      </Minimap>
    </div>
  </div>
);

export const WideRail: Story = () => (
  <div style={frame}>
    <Minimap markers={sectionMarkers} width={10}>
      <LongDocument />
    </Minimap>
  </div>
);

/* markers="auto": the rail derives headers from the DOM (h1..h6). */
export const AutoMarkers: Story = () => (
  <div style={frame}>
    <Minimap markers="auto">
      <LongDocument />
    </Minimap>
  </div>
);

/* A dozen h3s in a tight span: label decimation drops the losers, their
   dither rules stay. */
export const ClusteredHeadings: Story = () => (
  <div style={frame}>
    <Minimap
      markers={[
        { id: "intro", top: 0, kind: "header", label: "Introduction", level: 1 },
        ...Array.from({ length: 12 }, (_, i) => ({
          id: `c${i}`,
          top: 2000 + i * 120,
          kind: "header" as const,
          label: `Case study ${i + 1}`,
          level: 3,
        })),
        { id: "conclusion", topFraction: 0.9, kind: "header", label: "Conclusion", level: 1 },
      ]}
    >
      <div style={{ height: "40000px", padding: "var(--sf-unit)" }}>
        <p>A very long document with a dense cluster of h3 headings near the top.</p>
      </div>
    </Minimap>
  </div>
);

/* A nested scrollable inside the content: its headings stay out of the rail
   and it keeps its own scrollbar hover reveal. */
export const NestedScrollable: Story = () => (
  <div style={frame}>
    <Minimap markers="auto">
      <div style={{ padding: "0 var(--sf-unit)" }}>
        <Section index={0} />
        <div
          style={{
            height: "12rem",
            overflowY: "auto",
            border: "1px solid var(--sf-color-border)",
            padding: "0 var(--sf-unit)",
          }}
        >
          <h3>Nested log (not in the rail)</h3>
          {Array.from({ length: 30 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static generated lines; the index is the identity
            <p key={i} style={{ margin: 0 }}>
              line {i + 1}
            </p>
          ))}
        </div>
        {Array.from({ length: 12 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static generated sections; the index is the identity
          <Section key={i} index={i + 1} />
        ))}
      </div>
    </Minimap>
  </div>
);

export const RTL: Story = () => (
  <div style={frame} dir="rtl">
    <Minimap markers={sectionMarkers}>
      <LongDocument />
    </Minimap>
  </div>
);
