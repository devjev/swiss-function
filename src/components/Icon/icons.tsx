import { createIcon } from "./Icon";

// A curated line-weight set on the 16×16 grid — square caps, currentColor, no
// fills — matched to the library's existing inline glyphs (issue #51). Each is a
// standalone, tree-shakeable export. Add sparingly and keep the posture: no
// filled shapes, no colour, no decorative flourish (see AESTHETICS.md).

// --- Chevrons & carets ------------------------------------------------------
export const ChevronUp = createIcon("ChevronUp", <path d="M3.5 10 8 5.5l4.5 4.5" />);
export const ChevronDown = createIcon("ChevronDown", <path d="M3.5 6 8 10.5 12.5 6" />);
export const ChevronLeft = createIcon("ChevronLeft", <path d="M10 3.5 5.5 8l4.5 4.5" />);
export const ChevronRight = createIcon("ChevronRight", <path d="M6 3.5 10.5 8 6 12.5" />);
export const ChevronsUpDown = createIcon(
  "ChevronsUpDown",
  <path d="M5 6.5 8 3.5l3 3M5 9.5l3 3 3-3" />,
);

// --- Arrows -----------------------------------------------------------------
export const ArrowUp = createIcon("ArrowUp", <path d="M8 13V3M4 7l4-4 4 4" />);
export const ArrowDown = createIcon("ArrowDown", <path d="M8 3v10M4 9l4 4 4-4" />);
export const ArrowLeft = createIcon("ArrowLeft", <path d="M13 8H3M7 4 3 8l4 4" />);
export const ArrowRight = createIcon("ArrowRight", <path d="M3 8h10M9 4l4 4-4 4" />);

// --- Core actions -----------------------------------------------------------
export const Check = createIcon("Check", <path d="M3 8.5 6.5 12 13 4.5" />);
export const X = createIcon("X", <path d="M4 4l8 8M12 4l-8 8" />);
export const Plus = createIcon("Plus", <path d="M8 3v10M3 8h10" />);
export const Minus = createIcon("Minus", <path d="M3 8h10" />);
export const Search = createIcon(
  "Search",
  <>
    <circle cx="7" cy="7" r="4.5" />
    <path d="m11 11 3 3" />
  </>,
);
export const Trash = createIcon(
  "Trash",
  <path d="M3 4h10M6 4V2.5h4V4M4.5 4l.6 9.5h5.8L11.5 4M6.5 6.5v5M9.5 6.5v5" />,
);
export const Pencil = createIcon("Pencil", <path d="M10.5 2.5 13.5 5.5 6 13H3v-3zM9.5 3.5l3 3" />);
export const Copy = createIcon(
  "Copy",
  <>
    <path d="M6 6h7v7H6z" />
    <path d="M10 6V3H3v7h3" />
  </>,
);
export const Download = createIcon("Download", <path d="M8 3v7M5 7l3 3 3-3M3 13h10" />);
export const Upload = createIcon("Upload", <path d="M8 11V4M5 7l3-3 3 3M3 13h10" />);
export const ExternalLink = createIcon(
  "ExternalLink",
  <path d="M9 3h4v4M13 3 7.5 8.5M11 9.5V13H3V5h3.5" />,
);
export const Hamburger = createIcon("Hamburger", <path d="M2 4h12M2 8h12M2 12h12" />);
export const MoreHorizontal = createIcon(
  "MoreHorizontal",
  <g fill="currentColor" stroke="none">
    <circle cx="3.5" cy="8" r="1.1" />
    <circle cx="8" cy="8" r="1.1" />
    <circle cx="12.5" cy="8" r="1.1" />
  </g>,
);
export const MoreVertical = createIcon(
  "MoreVertical",
  <g fill="currentColor" stroke="none">
    <circle cx="8" cy="3.5" r="1.1" />
    <circle cx="8" cy="8" r="1.1" />
    <circle cx="8" cy="12.5" r="1.1" />
  </g>,
);
export const Filter = createIcon("Filter", <path d="M2 3h12L9.5 8.5V13l-3 1V8.5z" />);
export const Sliders = createIcon(
  "Sliders",
  <>
    <path d="M2 5h5M11 5h3M2 11h3M9 11h5" />
    <circle cx="9" cy="5" r="1.6" />
    <circle cx="7" cy="11" r="1.6" />
  </>,
);
export const Refresh = createIcon("Refresh", <path d="M13 5.5A5 5 0 1 0 13.5 9M13 2.5V6h-3.5" />);

// --- Status -----------------------------------------------------------------
export const Info = createIcon(
  "Info",
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 11.5V7.5M8 4.6v.6" />
  </>,
);
export const Warning = createIcon("Warning", <path d="M8 2.5 14 13H2zM8 6.5v3.5M8 11.6v.6" />);
export const CircleCheck = createIcon(
  "CircleCheck",
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M5 8.2 7 10.2 11 6" />
  </>,
);
export const CircleX = createIcon(
  "CircleX",
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M6 6l4 4M10 6l-4 4" />
  </>,
);

// --- Files ------------------------------------------------------------------
export const File = createIcon("File", <path d="M4 2h5l3 3v9H4zM9 2v3h3" />);
export const Folder = createIcon("Folder", <path d="M2 4h4l1.5 2H14v7.5H2z" />);

// --- Visibility & security --------------------------------------------------
export const Eye = createIcon(
  "Eye",
  <>
    <path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8z" />
    <circle cx="8" cy="8" r="2" />
  </>,
);
export const EyeOff = createIcon(
  "EyeOff",
  <>
    <path d="M6.3 3.8A7.6 7.6 0 0 1 8 3.5c4.4 0 7 4.5 7 4.5a13 13 0 0 1-2.1 2.6M3.7 4.7A12 12 0 0 0 1 8s2.6 4.5 7 4.5a7.4 7.4 0 0 0 2.1-.3" />
    <path d="M2 2l12 12" />
  </>,
);
export const Lock = createIcon("Lock", <path d="M3.5 7h9v6.5h-9zM5.5 7V5a2.5 2.5 0 0 1 5 0v2" />);

// --- Time & people ----------------------------------------------------------
export const Calendar = createIcon("Calendar", <path d="M3 3.5h10V14H3zM3 6.5h10M6 2v3M10 2v3" />);
export const Clock = createIcon(
  "Clock",
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.5V8l2.5 1.5" />
  </>,
);
export const User = createIcon(
  "User",
  <>
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M3 14v-.5A3.5 3.5 0 0 1 6.5 10h3a3.5 3.5 0 0 1 3.5 3.5v.5" />
  </>,
);
export const Star = createIcon(
  "Star",
  <path d="M8 2.2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4 4.4 13.3l.7-4L2.2 6.5l4-.6z" />,
);

// --- Theme ------------------------------------------------------------------
export const Sun = createIcon(
  "Sun",
  <>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" />
  </>,
);
export const Moon = createIcon(
  "Moon",
  <path d="M13.5 9.5A5.7 5.7 0 1 1 6.5 2.5 4.6 4.6 0 0 0 13.5 9.5z" />,
);
