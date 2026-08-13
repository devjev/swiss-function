import type { Story } from "@ladle/react";
import * as Tabler from "@tabler/icons-react";
import * as Lucide from "lucide-react";
import * as Feather from "react-feather";
import { Glyph, type IconOverrides, IconProvider } from "../../lib/icons";
import { Button } from "../Button";
import { iconAdapter } from "./adapter";
import { Icon } from "./Icon";
import * as Icons from "./icons";

const entries = Object.entries(Icons) as [string, typeof Icon][];

export const Gallery: Story = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(7rem, 1fr))",
      gap: "var(--sf-unit)",
      color: "var(--sf-color-fg)",
      fontFamily: "var(--sf-font-sans)",
    }}
  >
    {entries.map(([name, Glyph]) => (
      <div
        key={name}
        style={{
          display: "grid",
          justifyItems: "center",
          gap: "calc(var(--sf-unit) / 4)",
          padding: "calc(var(--sf-unit) / 2)",
          border: "1px solid var(--sf-color-border)",
          borderRadius: "var(--sf-radius-default)",
        }}
      >
        <Glyph size={1} label={name} />
        <span style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
          {name}
        </span>
      </div>
    ))}
  </div>
);

export const Sizes: Story = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "var(--sf-unit)",
      color: "var(--sf-color-fg)",
    }}
  >
    <Icons.Star label="1em (default)" />
    <Icons.Star size={0.75} label="0.75u" />
    <Icons.Star size={1} label="1u" />
    <Icons.Star size={1.5} label="1.5u" />
    <Icons.Star size="32px" label="32px" />
  </div>
);

export const InButtons: Story = () => (
  <div style={{ display: "flex", gap: "calc(var(--sf-unit) / 2)", flexWrap: "wrap" }}>
    <Button>
      <Icons.Download aria-hidden /> Download
    </Button>
    <Button variant="secondary">
      <Icons.Pencil aria-hidden /> Edit
    </Button>
    <Button variant="danger">
      <Icons.Trash aria-hidden /> Delete
    </Button>
    <Button variant="ghost" aria-label="Search">
      <Icons.Search aria-hidden />
    </Button>
  </div>
);

/** A custom icon — pass your own 16×16 path content to the `Icon` primitive. */
export const Custom: Story = () => (
  <Icon size={1.5} label="Lightning" color="var(--sf-color-primary)">
    <path d="M9 1 3 9h4l-1 6 6-8H8z" />
  </Icon>
);

// Three real icon libraries, each mapped onto the library's slots with
// `iconAdapter`. They are devDependencies used only by this story; the package
// ships none of them. A consumer wires their chosen library exactly like this
// (docs/API.md). Every slot the toolbar below renders is mapped here.
const lucideSet: IconOverrides = {
  add: iconAdapter(Lucide.Plus),
  search: iconAdapter(Lucide.Search),
  folder: iconAdapter(Lucide.Folder),
  file: iconAdapter(Lucide.File),
  delete: iconAdapter(Lucide.Trash2),
  check: iconAdapter(Lucide.Check),
  reset: iconAdapter(Lucide.RotateCcw),
  lock: iconAdapter(Lucide.Lock),
  menu: iconAdapter(Lucide.Menu),
  eye: iconAdapter(Lucide.Eye),
  zoomIn: iconAdapter(Lucide.ZoomIn),
  zoomOut: iconAdapter(Lucide.ZoomOut),
  moreHorizontal: iconAdapter(Lucide.MoreHorizontal),
  close: iconAdapter(Lucide.X),
};
const featherSet: IconOverrides = {
  add: iconAdapter(Feather.Plus),
  search: iconAdapter(Feather.Search),
  folder: iconAdapter(Feather.Folder),
  file: iconAdapter(Feather.File),
  delete: iconAdapter(Feather.Trash2),
  check: iconAdapter(Feather.Check),
  reset: iconAdapter(Feather.RotateCcw),
  lock: iconAdapter(Feather.Lock),
  menu: iconAdapter(Feather.Menu),
  eye: iconAdapter(Feather.Eye),
  zoomIn: iconAdapter(Feather.ZoomIn),
  zoomOut: iconAdapter(Feather.ZoomOut),
  moreHorizontal: iconAdapter(Feather.MoreHorizontal),
  close: iconAdapter(Feather.X),
};
const tablerSet: IconOverrides = {
  add: iconAdapter(Tabler.IconPlus),
  search: iconAdapter(Tabler.IconSearch),
  folder: iconAdapter(Tabler.IconFolder),
  file: iconAdapter(Tabler.IconFile),
  delete: iconAdapter(Tabler.IconTrash),
  check: iconAdapter(Tabler.IconCheck),
  reset: iconAdapter(Tabler.IconRefresh),
  lock: iconAdapter(Tabler.IconLock),
  menu: iconAdapter(Tabler.IconMenu2),
  eye: iconAdapter(Tabler.IconEye),
  zoomIn: iconAdapter(Tabler.IconZoomIn),
  zoomOut: iconAdapter(Tabler.IconZoomOut),
  moreHorizontal: iconAdapter(Tabler.IconDots),
  close: iconAdapter(Tabler.IconX),
};

const rowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "calc(var(--sf-unit) / 2)",
  alignItems: "center",
} as const;

// One toolbar, written once against the slots. Whichever IconProvider wraps it
// decides which library draws the glyphs; the built-in fallbacks show with none.
// A spread of variants, sizes, and labelled + icon-only buttons, so the swap is
// visible across a realistic toolbar rather than a single button. Top row is the
// labelled actions; the bottom row is small icon-only controls.
function Toolbar() {
  return (
    <div style={{ display: "grid", gap: "calc(var(--sf-unit) / 2)" }}>
      <div style={rowStyle}>
        <Button variant="primary">
          <Glyph slot="add" fallback={Icons.Plus} /> Add
        </Button>
        <Button variant="secondary">
          <Glyph slot="search" fallback={Icons.Search} /> Search
        </Button>
        <Button variant="secondary">
          <Glyph slot="folder" fallback={Icons.Folder} /> Open
        </Button>
        <Button variant="secondary">
          <Glyph slot="file" fallback={Icons.File} /> New file
        </Button>
        <Button variant="ghost">
          <Glyph slot="reset" fallback={Icons.Refresh} /> Reset
        </Button>
        <Button variant="ghost">
          <Glyph slot="lock" fallback={Icons.Lock} /> Lock
        </Button>
        <Button variant="ghost">
          <Glyph slot="check" fallback={Icons.Check} /> Confirm
        </Button>
        <Button variant="danger">
          <Glyph slot="delete" fallback={Icons.Trash} /> Delete
        </Button>
      </div>
      <div style={rowStyle}>
        <Button variant="ghost" size="sm" aria-label="Menu">
          <Glyph slot="menu" fallback={Icons.Hamburger} />
        </Button>
        <Button variant="ghost" size="sm" aria-label="Preview">
          <Glyph slot="eye" fallback={Icons.Eye} />
        </Button>
        <Button variant="ghost" size="sm" aria-label="Zoom in">
          <Glyph slot="zoomIn" fallback={Icons.ZoomIn} />
        </Button>
        <Button variant="ghost" size="sm" aria-label="Zoom out">
          <Glyph slot="zoomOut" fallback={Icons.ZoomOut} />
        </Button>
        <Button variant="ghost" size="sm" aria-label="More">
          <Glyph slot="moreHorizontal" fallback={Icons.MoreHorizontal} />
        </Button>
        <Button variant="ghost" size="sm" aria-label="Close">
          <Glyph slot="close" fallback={Icons.X} />
        </Button>
      </div>
    </div>
  );
}

const LIBRARIES: { name: string; note: string; icons?: IconOverrides }[] = [
  { name: "swiss-function", note: "built-in, no dependency" },
  { name: "Lucide", note: "lucide-react", icons: lucideSet },
  { name: "Feather", note: "react-feather", icons: featherSet },
  { name: "Tabler", note: "@tabler/icons-react", icons: tablerSet },
];

// One labelled toolbar for a library. With `icons` it wraps `Toolbar` in an
// `IconProvider`; without, the built-in fallbacks show.
function LibraryBlock({
  name,
  note,
  icons,
}: {
  name: string;
  note: string;
  icons?: IconOverrides;
}) {
  const body = (
    <section style={{ display: "grid", gap: "calc(var(--sf-unit) / 2)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "calc(var(--sf-unit) / 2)" }}>
        <span style={{ fontWeight: 600 }}>{name}</span>
        <span style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
          {note}
        </span>
      </div>
      <Toolbar />
    </section>
  );
  return icons ? <IconProvider icons={icons}>{body}</IconProvider> : body;
}

/** The same toolbar of buttons drawn by four icon sets. Each block wraps the
 *  identical `Toolbar` in an `IconProvider` for one library; the built-in row
 *  uses none, so the bespoke fallbacks show. Reskinning the whole app is this
 *  one wrapper. */
export const ButtonGallery: Story = () => (
  <div
    style={{
      display: "grid",
      gap: "calc(var(--sf-unit) * 1.5)",
      color: "var(--sf-color-fg)",
      fontFamily: "var(--sf-font-sans)",
    }}
  >
    {LIBRARIES.map((lib) => (
      <LibraryBlock key={lib.name} {...lib} />
    ))}
  </div>
);

/** A partial map: point only `delete` and `search` at Lucide and leave the rest
 *  bespoke. Any slot you don't map stays the built-in glyph. */
export const PartialOverride: Story = () => (
  <div style={{ color: "var(--sf-color-fg)", fontFamily: "var(--sf-font-sans)" }}>
    <IconProvider
      icons={{ delete: iconAdapter(Lucide.Trash2), search: iconAdapter(Lucide.Search) }}
    >
      <Toolbar />
    </IconProvider>
  </div>
);
