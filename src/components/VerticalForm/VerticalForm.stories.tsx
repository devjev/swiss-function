import type { Story } from "@ladle/react";
import { DatePicker } from "../DatePicker";
import { Input } from "../Input";
import { Selector } from "../Selector";
import { TextEdit } from "../TextEdit";
import { VerticalForm } from "./VerticalForm";

/* Deterministic fixtures: fixed field lists, no randomness or dates, so the
   stories are VRT-stable. The frame constrains the height (VerticalForm scrolls
   inside it and the Minimap rail rides the edge). */

const frame: React.CSSProperties = {
  height: "24rem",
  width: "34rem",
  border: "1px solid var(--sf-color-border)",
};

/* Drag the bottom-right corner to change the width (native CSS `resize`), so the
   field descriptions can be seen reflowing (right of the control when wide,
   below it when narrow). `overflow: hidden` because VerticalForm scrolls its
   own body. */
const resizableFrame: React.CSSProperties = {
  height: "24rem",
  width: "40rem",
  minWidth: "15rem",
  maxWidth: "62rem",
  resize: "horizontal",
  overflow: "hidden",
  border: "1px solid var(--sf-color-border)",
};

const DETAILS = [
  "Full name",
  "Display name",
  "Company",
  "Job title",
  "Phone",
  "Website",
  "Address line 1",
  "Address line 2",
  "City",
  "Postal code",
];

export const Playground: Story<{
  elevation: 0 | 1 | 2 | 3;
  side: "left" | "right";
  padding: number;
  minimapWidth: number;
}> = ({ elevation, side, padding, minimapWidth }) => (
  <div style={frame}>
    <VerticalForm elevation={elevation} side={side} padding={padding} minimapWidth={minimapWidth}>
      <VerticalForm.Field label="Email" description="We never share your address." required>
        <Input type="email" placeholder="you@example.com" />
      </VerticalForm.Field>
      {DETAILS.map((name) => (
        <VerticalForm.Field key={name} label={name}>
          <Input placeholder={name} />
        </VerticalForm.Field>
      ))}
      <VerticalForm.Field label="Notes" description="Anything else we should know.">
        <TextEdit placeholder="A short note…" />
      </VerticalForm.Field>
    </VerticalForm>
  </div>
);
Playground.args = { elevation: 1, side: "right", padding: 1, minimapWidth: 6 };
Playground.argTypes = {
  elevation: { control: { type: "inline-radio" }, options: [0, 1, 2, 3] },
  side: { control: { type: "inline-radio" }, options: ["left", "right"] },
};

const COUNTRIES = [
  { value: "ch", label: "Switzerland" },
  { value: "de", label: "Germany" },
  { value: "fr", label: "France" },
  { value: "it", label: "Italy" },
];

export const WithSections: Story = () => (
  <div style={frame}>
    <VerticalForm>
      <VerticalForm.Section title="Account">
        <VerticalForm.Field label="Email" required>
          <Input type="email" />
        </VerticalForm.Field>
        <VerticalForm.Field label="Password" description="At least 12 characters." required>
          <Input type="password" />
        </VerticalForm.Field>
      </VerticalForm.Section>
      <VerticalForm.Section title="Profile">
        {DETAILS.map((name) => (
          <VerticalForm.Field key={name} label={name}>
            <Input placeholder={name} />
          </VerticalForm.Field>
        ))}
      </VerticalForm.Section>
      <VerticalForm.Section title="Preferences">
        <VerticalForm.Field label="Country">
          <Selector items={COUNTRIES} value={[]} onChange={() => {}} layout="inline" />
        </VerticalForm.Field>
        <VerticalForm.Field label="Start date">
          <DatePicker value={null} onChange={() => {}} />
        </VerticalForm.Field>
      </VerticalForm.Section>
    </VerticalForm>
  </div>
);

export const Bare: Story = () => (
  // `bare`: rows render without the surrounding Box (no surface, no padding) for
  // a minimal look. Sections and the Minimap rail work the same.
  <div style={frame}>
    <VerticalForm bare>
      <VerticalForm.Section title="Account">
        <VerticalForm.Field label="Email" description="We never share it." required>
          <Input type="email" />
        </VerticalForm.Field>
        <VerticalForm.Field label="Password" description="At least 12 characters." required>
          <Input type="password" />
        </VerticalForm.Field>
      </VerticalForm.Section>
      <VerticalForm.Section title="Profile">
        {DETAILS.map((name) => (
          <VerticalForm.Field key={name} label={name}>
            <Input placeholder={name} />
          </VerticalForm.Field>
        ))}
      </VerticalForm.Section>
    </VerticalForm>
  </div>
);

export const WithErrors: Story = () => (
  <div style={frame}>
    <VerticalForm>
      <VerticalForm.Field label="Email" error="Enter a valid email address." required>
        <Input type="email" defaultValue="not-an-email" />
      </VerticalForm.Field>
      <VerticalForm.Field label="Username" description="Your public handle.">
        <Input defaultValue="jev" />
      </VerticalForm.Field>
      <VerticalForm.Field label="Password" error="Too short." required>
        <Input type="password" defaultValue="123" />
      </VerticalForm.Field>
      {DETAILS.map((name, i) => (
        <VerticalForm.Field
          key={name}
          label={name}
          error={i === 5 ? "This field is required." : undefined}
        >
          <Input placeholder={name} />
        </VerticalForm.Field>
      ))}
    </VerticalForm>
  </div>
);

export const LongForm: Story = () => (
  <div style={frame}>
    <VerticalForm>
      {Array.from({ length: 24 }, (_, i) => (
        <VerticalForm.Field
          // biome-ignore lint/suspicious/noArrayIndexKey: static generated fields; the index is the identity
          key={i}
          label={`Question ${i + 1}`}
          description={`Answer for question ${i + 1}.`}
        >
          <Input placeholder={`Answer ${i + 1}`} />
        </VerticalForm.Field>
      ))}
    </VerticalForm>
  </div>
);

export const Resizable: Story = () => (
  // Drag the container's bottom-right corner: each field's description moves to
  // the right of the control when the row is wide, and drops back below it when
  // narrow (a container query on the row, so it tracks the container, not the
  // viewport).
  <div style={resizableFrame}>
    <VerticalForm>
      <VerticalForm.Field label="Email" description="We never share your address." required>
        <Input type="email" placeholder="you@example.com" />
      </VerticalForm.Field>
      <VerticalForm.Field label="Password" description="At least 12 characters, mixed case.">
        <Input type="password" />
      </VerticalForm.Field>
      <VerticalForm.Field
        label="Recovery code"
        description="Store this somewhere safe; it is shown only once."
      >
        <Input />
      </VerticalForm.Field>
      <VerticalForm.Field label="Display name">
        <Input placeholder="No description: the control fills the row." />
      </VerticalForm.Field>
      {DETAILS.map((name) => (
        <VerticalForm.Field key={name} label={name} description={`Your ${name.toLowerCase()}.`}>
          <Input placeholder={name} />
        </VerticalForm.Field>
      ))}
    </VerticalForm>
  </div>
);

export const ResizableWithSections: Story = () => (
  // The same reflow, now across grouped sections and with the nav bar. Resize to
  // watch every section's descriptions react together.
  <div style={{ ...resizableFrame, height: "26rem", width: "44rem" }}>
    <VerticalForm nav>
      <VerticalForm.Section title="Account">
        <VerticalForm.Field label="Email" description="We never share it." required>
          <Input type="email" />
        </VerticalForm.Field>
        <VerticalForm.Field label="Password" description="At least 12 characters, mixed case.">
          <Input type="password" />
        </VerticalForm.Field>
      </VerticalForm.Section>
      <VerticalForm.Section title="Profile">
        {DETAILS.map((name) => (
          <VerticalForm.Field key={name} label={name} description={`Your ${name.toLowerCase()}.`}>
            <Input placeholder={name} />
          </VerticalForm.Field>
        ))}
      </VerticalForm.Section>
    </VerticalForm>
  </div>
);

export const WithNav: Story = () => (
  // `nav` adds a bottom bar: a searchable Picker of every title. Selecting one
  // scrolls to it; scrolling updates the Picker to the title at the top.
  <div style={frame}>
    <VerticalForm nav>
      <VerticalForm.Section title="Account">
        <VerticalForm.Field label="Email" required>
          <Input type="email" />
        </VerticalForm.Field>
        <VerticalForm.Field label="Password">
          <Input type="password" />
        </VerticalForm.Field>
      </VerticalForm.Section>
      <VerticalForm.Section title="Profile">
        {DETAILS.map((name) => (
          <VerticalForm.Field key={name} label={name}>
            <Input placeholder={name} />
          </VerticalForm.Field>
        ))}
      </VerticalForm.Section>
      <VerticalForm.Section title="Preferences">
        <VerticalForm.Field label="Start date">
          <DatePicker value={null} onChange={() => {}} />
        </VerticalForm.Field>
      </VerticalForm.Section>
    </VerticalForm>
  </div>
);

export const Dense: Story = () => (
  // Many fields: block markers never compress below 0.5u, so the rail itself
  // grows taller than its viewport and scrolls, auto-following the band as you
  // scroll the form. More labels survive than in the fit-everything overview.
  <div style={{ ...frame, height: "26rem" }}>
    <VerticalForm nav>
      {Array.from({ length: 120 }, (_, i) => (
        <VerticalForm.Field
          // biome-ignore lint/suspicious/noArrayIndexKey: static generated fields; the index is the identity
          key={i}
          label={`Field ${i + 1}`}
          description={i % 4 === 0 ? `Notes for field ${i + 1}.` : undefined}
        >
          <Input placeholder={`Value ${i + 1}`} />
        </VerticalForm.Field>
      ))}
    </VerticalForm>
  </div>
);

export const MaxBlockCompressed: Story = () => (
  // A small maxBlock caps the rail blocks and compresses the rail vertically:
  // the density strip packs into the top rather than spreading over the full
  // rail. (minBlock still floors dense forms; here max is the binding one.)
  <div style={{ ...frame, height: "22rem" }}>
    <VerticalForm maxBlock={0.75}>
      {Array.from({ length: 12 }, (_, i) => (
        <VerticalForm.Field
          // biome-ignore lint/suspicious/noArrayIndexKey: static generated fields; the index is the identity
          key={i}
          label={`Field ${i + 1}`}
        >
          <Input placeholder={`Value ${i + 1}`} />
        </VerticalForm.Field>
      ))}
    </VerticalForm>
  </div>
);

export const FitsWithoutRail: Story = () => (
  <div style={frame}>
    {/* Few fields: the content fits, so the Minimap rail stays hidden. */}
    <VerticalForm>
      <VerticalForm.Field label="Name">
        <Input />
      </VerticalForm.Field>
      <VerticalForm.Field label="Email" description="We never share it.">
        <Input type="email" />
      </VerticalForm.Field>
    </VerticalForm>
  </div>
);
