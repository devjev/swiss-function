import { createIcon } from "./Icon";

// A curated line-weight set on the 16×16 grid — square caps, currentColor, no
// fills — matched to the library's existing inline glyphs (issue #51). Each is a
// standalone, tree-shakeable export. Add sparingly and keep the posture: no
// filled shapes, no colour, no decorative flourish (see AESTHETICS.md).

// --- Chevrons & carets ------------------------------------------------------
export const ChevronUp = /* @__PURE__ */ createIcon(
  "ChevronUp",
  <path d="M3.5 10 8 5.5l4.5 4.5" />,
);
export const ChevronDown = /* @__PURE__ */ createIcon(
  "ChevronDown",
  <path d="M3.5 6 8 10.5 12.5 6" />,
);
export const ChevronLeft = /* @__PURE__ */ createIcon(
  "ChevronLeft",
  <path d="M10 3.5 5.5 8l4.5 4.5" />,
);
export const ChevronRight = /* @__PURE__ */ createIcon(
  "ChevronRight",
  <path d="M6 3.5 10.5 8 6 12.5" />,
);
export const ChevronsUpDown = /* @__PURE__ */ createIcon(
  "ChevronsUpDown",
  <path d="M5 6.5 8 3.5l3 3M5 9.5l3 3 3-3" />,
);

// --- Arrows -----------------------------------------------------------------
export const ArrowUp = /* @__PURE__ */ createIcon("ArrowUp", <path d="M8 13V3M4 7l4-4 4 4" />);
export const ArrowDown = /* @__PURE__ */ createIcon("ArrowDown", <path d="M8 3v10M4 9l4 4 4-4" />);
export const ArrowLeft = /* @__PURE__ */ createIcon("ArrowLeft", <path d="M13 8H3M7 4 3 8l4 4" />);
export const ArrowRight = /* @__PURE__ */ createIcon(
  "ArrowRight",
  <path d="M3 8h10M9 4l4 4-4 4" />,
);

// --- Core actions -----------------------------------------------------------
export const Check = /* @__PURE__ */ createIcon("Check", <path d="M3 8.5 6.5 12 13 4.5" />);
export const X = /* @__PURE__ */ createIcon("X", <path d="M4 4l8 8M12 4l-8 8" />);
export const Plus = /* @__PURE__ */ createIcon("Plus", <path d="M8 3v10M3 8h10" />);
export const Minus = /* @__PURE__ */ createIcon("Minus", <path d="M3 8h10" />);
export const Search = /* @__PURE__ */ createIcon(
  "Search",
  <>
    <circle cx="7" cy="7" r="4.5" />
    <path d="m11 11 3 3" />
  </>,
);
export const Trash = /* @__PURE__ */ createIcon(
  "Trash",
  <path d="M3 4h10M6 4V2.5h4V4M4.5 4l.6 9.5h5.8L11.5 4M6.5 6.5v5M9.5 6.5v5" />,
);
export const Pencil = /* @__PURE__ */ createIcon(
  "Pencil",
  <path d="M10.5 2.5 13.5 5.5 6 13H3v-3zM9.5 3.5l3 3" />,
);
export const Copy = /* @__PURE__ */ createIcon(
  "Copy",
  <>
    <path d="M6 6h7v7H6z" />
    <path d="M10 6V3H3v7h3" />
  </>,
);
export const Download = /* @__PURE__ */ createIcon(
  "Download",
  <path d="M8 3v7M5 7l3 3 3-3M3 13h10" />,
);
export const Upload = /* @__PURE__ */ createIcon(
  "Upload",
  <path d="M8 11V4M5 7l3-3 3 3M3 13h10" />,
);
export const ExternalLink = /* @__PURE__ */ createIcon(
  "ExternalLink",
  <path d="M9 3h4v4M13 3 7.5 8.5M11 9.5V13H3V5h3.5" />,
);
export const Hamburger = /* @__PURE__ */ createIcon(
  "Hamburger",
  <path d="M2 4h12M2 8h12M2 12h12" />,
);
export const MoreHorizontal = /* @__PURE__ */ createIcon(
  "MoreHorizontal",
  <g fill="currentColor" stroke="none">
    <circle cx="3.5" cy="8" r="1.1" />
    <circle cx="8" cy="8" r="1.1" />
    <circle cx="12.5" cy="8" r="1.1" />
  </g>,
);
export const MoreVertical = /* @__PURE__ */ createIcon(
  "MoreVertical",
  <g fill="currentColor" stroke="none">
    <circle cx="8" cy="3.5" r="1.1" />
    <circle cx="8" cy="8" r="1.1" />
    <circle cx="8" cy="12.5" r="1.1" />
  </g>,
);
export const Filter = /* @__PURE__ */ createIcon(
  "Filter",
  <path d="M2 3h12L9.5 8.5V13l-3 1V8.5z" />,
);
export const Sliders = /* @__PURE__ */ createIcon(
  "Sliders",
  <>
    <path d="M2 5h5M11 5h3M2 11h3M9 11h5" />
    <circle cx="9" cy="5" r="1.6" />
    <circle cx="7" cy="11" r="1.6" />
  </>,
);
export const Refresh = /* @__PURE__ */ createIcon(
  "Refresh",
  <path d="M13 5.5A5 5 0 1 0 13.5 9M13 2.5V6h-3.5" />,
);

// --- Status -----------------------------------------------------------------
export const Info = /* @__PURE__ */ createIcon(
  "Info",
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 11.5V7.5M8 4.6v.6" />
  </>,
);
export const Warning = /* @__PURE__ */ createIcon(
  "Warning",
  <path d="M8 2.5 14 13H2zM8 6.5v3.5M8 11.6v.6" />,
);
export const CircleCheck = /* @__PURE__ */ createIcon(
  "CircleCheck",
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M5 8.2 7 10.2 11 6" />
  </>,
);
export const CircleX = /* @__PURE__ */ createIcon(
  "CircleX",
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M6 6l4 4M10 6l-4 4" />
  </>,
);

// --- Files ------------------------------------------------------------------
export const File = /* @__PURE__ */ createIcon("File", <path d="M4 2h5l3 3v9H4zM9 2v3h3" />);
export const Folder = /* @__PURE__ */ createIcon("Folder", <path d="M2 4h4l1.5 2H14v7.5H2z" />);

// --- Visibility & security --------------------------------------------------
export const Eye = /* @__PURE__ */ createIcon(
  "Eye",
  <>
    <path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8z" />
    <circle cx="8" cy="8" r="2" />
  </>,
);
export const EyeOff = /* @__PURE__ */ createIcon(
  "EyeOff",
  <>
    <path d="M6.3 3.8A7.6 7.6 0 0 1 8 3.5c4.4 0 7 4.5 7 4.5a13 13 0 0 1-2.1 2.6M3.7 4.7A12 12 0 0 0 1 8s2.6 4.5 7 4.5a7.4 7.4 0 0 0 2.1-.3" />
    <path d="M2 2l12 12" />
  </>,
);
export const Lock = /* @__PURE__ */ createIcon(
  "Lock",
  <path d="M3.5 7h9v6.5h-9zM5.5 7V5a2.5 2.5 0 0 1 5 0v2" />,
);

// --- Time & people ----------------------------------------------------------
export const Calendar = /* @__PURE__ */ createIcon(
  "Calendar",
  <path d="M3 3.5h10V14H3zM3 6.5h10M6 2v3M10 2v3" />,
);
export const Clock = /* @__PURE__ */ createIcon(
  "Clock",
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.5V8l2.5 1.5" />
  </>,
);
export const User = /* @__PURE__ */ createIcon(
  "User",
  <>
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M3 14v-.5A3.5 3.5 0 0 1 6.5 10h3a3.5 3.5 0 0 1 3.5 3.5v.5" />
  </>,
);
export const Star = /* @__PURE__ */ createIcon(
  "Star",
  <path d="M8 2.2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4 4.4 13.3l.7-4L2.2 6.5l4-.6z" />,
);

// --- Theme ------------------------------------------------------------------
export const Sun = /* @__PURE__ */ createIcon(
  "Sun",
  <>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" />
  </>,
);
export const Moon = /* @__PURE__ */ createIcon(
  "Moon",
  <path d="M13.5 9.5A5.7 5.7 0 1 1 6.5 2.5 4.6 4.6 0 0 0 13.5 9.5z" />,
);

// --- Window chrome ----------------------------------------------------------
export const Expand = /* @__PURE__ */ createIcon(
  "Expand",
  <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />,
);
export const Collapse = /* @__PURE__ */ createIcon(
  "Collapse",
  <path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4" />,
);
export const Split = /* @__PURE__ */ createIcon(
  "Split",
  <path d="M2.5 3.5h4.25v9H2.5zM9.25 3.5h4.25v9h-4.25z" />,
);
// An arrow docking back into a box (return a popped-out window to the strip);
// the mirror of ExternalLink, which serves the `popOut` slot.
export const PopIn = /* @__PURE__ */ createIcon(
  "PopIn",
  <path d="M8 4v4h4M13 3 8 8M11 9.5V13H3V5h3.5" />,
);

// --- Viewport & canvas controls ---------------------------------------------
export const ZoomIn = /* @__PURE__ */ createIcon(
  "ZoomIn",
  <>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5 14 14M7 5v4M5 7h4" />
  </>,
);
export const ZoomOut = /* @__PURE__ */ createIcon(
  "ZoomOut",
  <>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5 14 14M5 7h4" />
  </>,
);
export const Fit = /* @__PURE__ */ createIcon(
  "Fit",
  <path d="M2 5V2h3M14 5V2h-3M2 11v3h3M14 11v3h-3" />,
);
export const Connect = /* @__PURE__ */ createIcon(
  "Connect",
  <>
    <circle cx="4" cy="12" r="2.25" />
    <circle cx="12" cy="4" r="2.25" />
    <path d="M5.6 10.4 10.4 5.6" />
  </>,
);

// --- Media transport ---------------------------------------------------------
// Stroked outlines, not filled solids: the same line weight as every other
// glyph, so a transport row doesn't read heavier than the rest of the chrome.
export const Play = /* @__PURE__ */ createIcon("Play", <path d="M5.5 3.5v9l8-4.5z" />);
export const Pause = /* @__PURE__ */ createIcon("Pause", <path d="M5.5 3.5v9M10.5 3.5v9" />);
export const Stop = /* @__PURE__ */ createIcon("Stop", <path d="M4.5 4.5h7v7h-7z" />);
