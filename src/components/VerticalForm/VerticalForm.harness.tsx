/* CT harness (Playwright components cannot be defined in the spec file).
   A fixed 320px viewport over a form tall enough to overflow, so the Minimap
   rail shows. One field carries an error to exercise the danger rail tick. */
import { Input } from "../Input";
import { VerticalForm } from "./VerticalForm";

const NAMES = Array.from({ length: 10 }, (_, i) => `Field ${i + 1}`);

export function Basic() {
  return (
    <div style={{ height: 320, width: 560 }}>
      <VerticalForm>
        {NAMES.map((name, i) => (
          <VerticalForm.Field
            key={name}
            label={name}
            description={`Notes for ${name.toLowerCase()}.`}
            error={i === 3 ? "Required." : undefined}
          >
            <Input placeholder={name} />
          </VerticalForm.Field>
        ))}
      </VerticalForm>
    </div>
  );
}

export function Sections() {
  return (
    <div style={{ height: 320, width: 560 }}>
      <VerticalForm>
        <VerticalForm.Section title="Account">
          <VerticalForm.Field label="Email">
            <Input type="email" />
          </VerticalForm.Field>
          <VerticalForm.Field label="Password">
            <Input type="password" />
          </VerticalForm.Field>
        </VerticalForm.Section>
        <VerticalForm.Section title="Profile">
          {Array.from({ length: 8 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static generated fields; the index is the identity
            <VerticalForm.Field key={i} label={`Detail ${i + 1}`}>
              <Input />
            </VerticalForm.Field>
          ))}
        </VerticalForm.Section>
      </VerticalForm>
    </div>
  );
}

export function NavForm() {
  return (
    <div style={{ height: 360, width: 560 }}>
      <VerticalForm nav>
        <VerticalForm.Section title="Account">
          <VerticalForm.Field label="Email">
            <Input type="email" />
          </VerticalForm.Field>
          <VerticalForm.Field label="Password">
            <Input type="password" />
          </VerticalForm.Field>
        </VerticalForm.Section>
        <VerticalForm.Section title="Profile">
          {NAV_FIELDS.map((name) => (
            <VerticalForm.Field key={name} label={name}>
              <Input />
            </VerticalForm.Field>
          ))}
        </VerticalForm.Section>
      </VerticalForm>
    </div>
  );
}

/** Distinct single-word labels so a filter maps unambiguously to one option. */
const NAV_FIELDS = [
  "Alfa",
  "Bravo",
  "Charlie",
  "Delta",
  "Echo",
  "Foxtrot",
  "Golf",
  "Hotel",
  "India",
  "Juliet",
];
