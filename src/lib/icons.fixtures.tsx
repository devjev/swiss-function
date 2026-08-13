import type { SVGProps } from "react";
import { iconAdapter } from "../components/Icon/adapter";
import { Check, Search, X } from "../components/Icon/icons";
import { Glyph, IconProvider } from "./icons";

// Importable fixtures for `icons.spec.tsx`. Playwright CT serializes mounted
// components across the Node/browser boundary, so a component built at runtime
// (the adapter) or defined in the test file cannot be mounted directly. Wrapping
// each scenario as an exported component keeps every `mount()` root a static
// import with primitive props.

/** A stand-in "external" library icon (Feather/Lucide/Tabler shape): a 24-grid,
 *  round-cap svg that spreads whatever attributes the adapter hands it. */
export function ExternalStar(props: SVGProps<SVGSVGElement>) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: the adapter under test supplies the a11y attrs.
    <svg data-testid="external" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M12 2l3 7 7 .5-5 4.5 1.5 7L12 17l-6 4 1.5-7-5-4.5 7-.5z" />
    </svg>
  );
}

const Adapted = iconAdapter(ExternalStar);

/** No provider: the slot falls back to its bespoke glyph. */
export function DefaultCheck() {
  return <Glyph slot="check" fallback={Check} />;
}

/** One slot overridden; a sibling slot with no mapping stays bespoke. */
export function OverrideCheckOnly() {
  return (
    <IconProvider icons={{ check: Adapted }}>
      <div>
        <Glyph slot="check" fallback={Check} label="Checked" />
        <Glyph slot="close" fallback={X} />
      </div>
    </IconProvider>
  );
}

/** Nested providers: the inner remaps `check` back to a bespoke glyph while
 *  `close` still resolves through the outer (external) provider. */
export function NestedMerge() {
  return (
    <IconProvider icons={{ check: Adapted, close: Adapted }}>
      <IconProvider icons={{ check: Check }}>
        <div>
          <Glyph slot="check" fallback={X} />
          <Glyph slot="close" fallback={Search} />
        </div>
      </IconProvider>
    </IconProvider>
  );
}

/** The adapter, labelled: role="img" + aria-label, size on the grid. */
export function AdaptedLabelled() {
  return <Adapted label="Star" size={2} />;
}

/** The adapter, decorative: aria-hidden, default 1em. */
export function AdaptedDecorative() {
  return <Adapted />;
}
