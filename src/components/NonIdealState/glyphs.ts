/** Block-art emblems for each non-ideal state, drawn from the console shade
 *  ramp (░ ▒ ▓ █). Each is a list of equal-width rows; the component renders
 *  them in a monospace <pre> with tight line-height so the cells fuse into a
 *  single dithered glyph. Decorative only — the title carries the meaning. */

export type NonIdealStateVariant = "empty" | "no-results" | "error" | "loading";

/** An empty container: a solid frame around a faint (░) interior. */
const empty = [
  "▓▓▓▓▓▓▓▓▓",
  "▓░░░░░░░▓",
  "▓░░░░░░░▓",
  "▓░░░░░░░▓",
  "▓░░░░░░░▓",
  "▓░░░░░░░▓",
  "▓▓▓▓▓▓▓▓▓",
];

/** A magnifying glass — lens ring with a faint interior + a diagonal handle. */
const noResults = [
  " ▓▓▓▓▓   ",
  "▓▒░░░▒▓  ",
  "▓░░░░░▓  ",
  "▓▒░░░▒▓  ",
  " ▓▓▓▓█▓  ",
  "     ▓██ ",
  "       ▓█",
];

/** A bold dithered ✕ — something failed. Tinted with the danger color. */
const error = [
  "█▓     ▓█",
  " █▓   ▓█ ",
  "  █▓ ▓█  ",
  "   ███   ",
  "  █▓ ▓█  ",
  " █▓   ▓█ ",
  "█▓     ▓█",
];

/** A density ramp in horizontal bands — a console gradient. The component
 *  sweeps a scanline down it while loading, reading like a working meter. */
const loading = [
  "█████████",
  "▓▓▓▓▓▓▓▓▓",
  "▒▒▒▒▒▒▒▒▒",
  "░░░░░░░░░",
  "▒▒▒▒▒▒▒▒▒",
  "▓▓▓▓▓▓▓▓▓",
  "█████████",
];

export const GLYPHS: Record<NonIdealStateVariant, string[]> = {
  empty,
  "no-results": noResults,
  error,
  loading,
};
