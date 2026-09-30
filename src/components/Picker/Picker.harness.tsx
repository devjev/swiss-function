import type { SVGProps } from "react";
import { IconProvider } from "../../lib/icons";
import { iconAdapter } from "../Icon/adapter";
import { Picker } from "./Picker";

// Playwright CT serializes a mounted root across the Node/browser boundary, so
// a component built at runtime (the adapter) cannot be mounted from the spec
// file. This harness keeps every `mount()` root a static import.

/** A stand-in for another icon set's chevron (a 24-grid, round-cap svg). */
function ExternalChevron(props: SVGProps<SVGSVGElement>) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: the adapter supplies the a11y attrs.
    <svg
      data-testid="external-chevron"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      {...props}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const CITIES = ["Bern", "Geneva", "Zurich"];

/** The field's chevron, bespoke. */
export function PickerDefaultChevron() {
  return <Picker items={CITIES} />;
}

/** The same field with another set swapped in through the `chevronDown` slot. */
export function PickerSwappedChevron() {
  return (
    <IconProvider icons={{ chevronDown: iconAdapter(ExternalChevron) }}>
      <Picker items={CITIES} />
    </IconProvider>
  );
}
