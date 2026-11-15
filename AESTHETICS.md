# Aesthetics

The opinionated stance behind Swiss-Function. A reference for anyone
building on the system, or contributing to it, so that taste calls
don't drift over time.

The short version: **Bauhaus, not Bay Area.** We want interfaces that
read like technical instruments (sharp, functional, dense with
information), not like social products optimized for engagement.

---

## Stance

We are deliberately stepping away from the design language of the last
fifteen years of consumer software. That language is recognizable:
plump rounded corners, oversized whitespace, soft pastel palettes, blurred
glass surfaces, body text in pale grey, "delight" micro-animations that
run on every state change, full-bleed hero imagery, and the implicit
assumption that the user is here to scroll.

None of that suits the work we actually do. We are building tools for
people who are *reading* and *thinking*, not skimming a feed. Our
posture is closer to a Braun radio, a Müller-Brockmann poster, a CAD
program, or a financial terminal than to any "design-led" SaaS dashboard
from the 2020s.

Concretely:

- We default to **sharp corners**, not soft ones.
- We default to **full-strength text**, not grey.
- We default to **typographic hierarchy**, not color hierarchy.
- We default to **density**, not whitespace-as-luxury.
- We default to **functional motion**, not decorative.
- We default to **content-first layout**, not chrome-first.

These are defaults; they bend when content demands. But they bend with
intent, not because the rest of the industry has bent that way.

**One sanctioned exception: light skeuomorphism.** In rare, deliberate
cases we reach for a touch of skeuomorphism reminiscent of *old computers*:
a tactile keycap, a physical-feeling switch, a beveled readout. The aim is
never nostalgia-as-decoration. It's to evoke the era when software was
**fast, understandable, and lightweight**, when a control looked like the
thing it did and did exactly that. Used sparingly and only where it earns
its keep (e.g. `Kbd` rendering a shortcut as a real key), it reinforces the
instrument posture rather than betraying it. The test: does it make the tool
read as *more* honest and direct, or just cuter? If the latter, drop it.

---

## Foundations

### Typography

Type carries the hierarchy. Weight and size do the work that color and
ornament do elsewhere.

- **Sans-serif for prose**, IBM Plex Sans preferred via `--sf-font-sans`.
  A system stack resolves to a different face on every platform (San
  Francisco, Segoe UI, Roboto, an Arial clone on a bare Linux), so the
  same screen reads differently on each. The optional `fonts.css` pins
  one grotesque with fixed widths and a known x-height; without it the
  token falls back to the system stack.
- **Monospace for data**, JetBrains Mono preferred via `--sf-font-mono`.
  Inputs, code, axis labels, tabular numbers, anything the eye needs to
  scan column-aligned. Monospace reads as machine-readable on purpose:
  it signals to the reader "this is information, not narrative".
- **Three sizes** (`sm`, `md`, `lg`), four weights (regular, medium,
  semibold, bold). Body sits at `md`; `sm` carries secondary content;
  `lg` carries emphasis. There is no `xs` / `xl`; restraint is the
  point. Hierarchy beyond these three lives in **weight, spacing, and
  rule lines**, not in a fourth size.
- **Two line heights**: `1.25` tight (unitless, for dense single-line
  controls like buttons, inputs, tabs) and `--sf-line-height-grid` (one
  unit, an absolute length, for block text: the value that locks prose to
  the baseline grid regardless of font-size).
- **For long-form documents**, reach for `--sf-measure` (65ch) to cap
  line length, and `text-wrap: pretty` for paragraph flow. Code,
  tables, and figures live at `--sf-measure-wide` (80ch).

### Color

Color is a tool, not decoration. Saturated colors mean something; muted
ones recede.

- **Body text is full-strength.** Default to `--sf-color-fg`. The
  number-one anti-pattern in modern web design is grey body text in the
  name of "soft" or "elegant": it is neither. It is *less legible*.
  Save `--sf-color-fg-subtle` and `--sf-color-muted` for genuinely
  secondary metadata: timestamps next to a username, byte counts beside a
  filename, axis labels under a chart. Never for the sentence you want
  the reader to read. Labels sit in the reading class, not the metadata
  class: control captions, column titles, tags, group/section headers,
  and descriptions stay full-strength. State (weekend, pending, inactive)
  is signalled by an indicator or a background tint, never by graying
  the label.
- **One accent**, a deep ultramarine (`--sf-color-primary: #1432c8`). It
  marks what's interactive and what's focused. Everything else is
  neutral, and the neutrals are pure greys: they carry no hue, so the
  accent is the only colour on the page.
- **Every colour passes as text.** The secondary text tones and the four
  status colours clear 4.5:1 on the page in both themes, so a status
  word can be set in its colour on the plain page. That is what removes
  the need for tinted backgrounds behind coloured text.
- **Semantic colors are reserved.** `--sf-color-danger`, `-success`,
  `-warning` mean something. Don't use them decoratively. A red bar in
  a chart should mean "negative"; a green one, "positive". A red border
  should mean "this is wrong".
- **Dark mode is native, not a port.** Tokens are redefined under
  `[data-theme="dark"]`. Never hard-code hex values in component CSS.

### Density

The page is not a slide. Information should fit on it without
journeying.

- **Spacing scales from `--sf-unit`**, the leading of body text. Every
  gap, padding, and component height is a multiple of that unit. That's
  why the whole system lines up on the baseline grid.
- **The default density is compact**: 14px text on a 20px unit. A
  control is 30px, a small one 20px, a table row 25px. These are the
  metrics of a working tool: a trading screen, a spreadsheet, an IDE.
  16px text on 24px with 36px rows is the scale of a reading page, and
  on a screen of fields and tables it reads as a slide. A density is
  four values (the copy size, its leading, the two neighbouring type
  sizes); everything else follows from the unit.
  `data-density="comfortable"` on any ancestor restores the roomier
  16px on 24px for a reading view.
- **No oversized whitespace for "breathing room".** Whitespace earns
  its place by separating things that need separation. If two elements
  are related, they sit close. If they aren't, they sit at one unit's
  remove. Past that, nothing improves.
- **Tables and dense lists are good.** A well-built table conveys more
  in less space than any card grid. Use them.
- **Cards are not free.** Each card costs at least 1u of padding on
  four sides and a border or shadow. They're worth that cost when the
  content is genuinely independent. They're not worth it for a flat list
  of three items.

### Shape

- **`--sf-radius-default` is 2px** (`--sf-radius-xs`). That's the default
  for everything except circles and pills. Buttons, inputs, and cards are
  all 2px. The result reads as drawn with a hard pencil, not a felt-tip pen.
- **Only round what's meant to be round.** Switch handles are circular
  because they roll. Avatars are circular because faces are round.
  Buttons are not circular.
- **Pill shapes** (radius-full) are reserved for tags and toggle states
  where the rounded form carries semantic weight, typically "this is a
  badge, not a button".

### Borders

- **Three line tones, chosen by what the line does.**
  `--sf-color-border-strong` outlines a region (a table, a panel, a
  window, a popup) and draws the rules of its chrome (a title bar's
  underline, the rule under a table header, a pane splitter).
  `--sf-color-border` is the edge of a control (a field, a secondary
  button, a checkbox, a chip) and of a small box nested in a region.
  `--sf-color-border-subtle` separates repeated things: table cells,
  list rows, calendar days, menu separators, axis lines. In the light
  theme the first two are ink and the third a mid grey, so a screen
  reads like a printed form: ruled boxes, thin rules between rows.
- **Structure must be visible.** A region outline and a control edge
  reach at least 3:1 on the page (WCAG 1.4.11). A frame at 1.2:1 leaves
  the layout to be guessed from whitespace, and the page reads as
  washed out however good the grid under it is.
- **Pick the tone by role.** A divider drawn in ink turns a table into
  a cage. A frame drawn in the divider grey dissolves the region. A row
  that holds a ruled control (a VerticalForm field) takes the divider
  tone for its own box, so the control keeps the ink.
- **A resting border is never primary.** Inputs sit on the neutral border
  at rest; `--sf-color-primary` appears only on *state*: focus ring,
  hover, checked/selected. A blue box just sitting there means nothing.
- **`--sf-color-gridline` is the one exception, and it is not a border.**
  It's the faint hairline for data-viz scaffolding (chart gridlines and
  axes, Skeleton placeholder edges), deliberately quieter than the
  structural border so data and content stay in front of the scaffolding.

### Depth

Depth indicates layer, not personality.

- **Six elevation steps** (`--sf-elevation-0` through `-5`). Surfaces
  use them sparingly. Most of the page sits at 0 or 1.
- **In the light theme a cast is hard, at every level.** It is a
  zero-blur offset in the frame's ink, the thickness of the part seen
  from the side. Height is the length of the offset: 1 and 2px for a key
  or a card (things that sit on the page), 3, 4 and 6px for a menu, a
  popover or a dialog (things that float over it). No level blurs: a
  soft shadow beside an ink frame reads as a second, unrelated light.
- **Dark mode reads depth three ways, since near-black swallows a soft
  drop shadow.** All ride the same `--sf-elevation-N` shadow, so every
  consumer gets them with no component change: a brutalist hard cast (a
  zero-blur offset in a dark grey a step above the page, stepping to the
  lower-right and growing with the level); a slight, full-bleed lightening film that
  lifts the surface a little above the page (engaged only above level 1,
  and kept subtle); and a 1px inset edge that brightens with the level,
  so a bordered surface's rim reads progressively lighter and a
  borderless one gains a faint lit edge.
- **Controls are lit by one light.** `--sf-light-x` / `-y` (from the top
  left by default, the classic bevel) drives every tactile recipe in
  `tokens.css` and the elevation and recess casts, so a surface, a key, a
  slot and a cap agree on where the light is. A key wears
  `--sf-edge`, a 1px lit band on the side facing the light and a 1px
  shade band opposite, plus its elevation cast. A slot (a text field, a
  slider track, a switch rail) wears `--sf-groove`, a shadow band under
  the lit wall and a bounce off the far wall, and sits flush: a slot does
  not float. A small cap (checkbox, radio, thumb) takes `--sf-cap-rest`.
  Pressed is travel: the face stays, the cast drops a step and the key
  moves 1px. Never an inverted dent, which reads as a hollow tile. The
  geometry and alphas are Ambient CSS's Blender-fitted constants (MIT),
  rescaled to the unit, with the lamp's colour cast removed. The
  dark theme re-declares the tokens (a dimmer lit band, a deeper shade
  band, a soft cast under small caps), so components carry no dark
  overrides of their own.
- **Small keys have a face; wide ones are flat.** A Kbd cap and the
  LaunchButton lid carry the keycap dish from `lib/surface`: a little
  dark at the lit rim, the floor at 20%, brightest at the far rim, about
  0.045 OKLCH lightness end to end (`--sf-curve`). A Switch thumb and a
  Knob are domes, a DigitInput cell is a scoop. The ramp describes a
  curve across a cap of one or two units. Stretched over a wide button,
  a title bar or a table header it stops reading as a curve and becomes
  a gradient on chrome, so Button, ToggleGroup, WindowArray title bars
  and the DataTable and Explorer headers are flat by default: they keep
  the edge bands and the cast, which is what makes them keys. The
  `surface` prop opts a single key back in. Box, Pane, Dialog and
  Popover are flat planes.
- **A text field is a ruled box on the page colour.** Its fill
  (`--sf-color-input-bg`) equals the page, its edge is the control
  border, and it sits in a groove. Focus turns the edge primary and
  doubles it to 2px. Input, TextEdit, Combobox, DatePicker and
  DigitInput share this.
- **No glassmorphism**, no backdrop blur, no semi-transparent overlays
  pretending to be physical. We are not simulating frosted plastic. We
  are stacking flat planes.

**One sanctioned exception: measured 3D for genuinely-3D data.** The chrome
stacks flat planes, but data can be intrinsically three-dimensional (a surface
`z = f(x,y)`, a point cloud), and flattening it loses information. There the 3D
charts (`Surface`, `PointCloud`) are allowed, rendered as *instruments*, not
decoration: **orthographic (axonometric) projection**, so there's no
vanishing-point perspective and lengths stay comparable along each axis, like a
CAD/engineering drawing; flat shading and a single-hue, token-derived height
ramp; a measured bounding-box frame with axis ticks; **drag-to-rotate only,
never auto-spin** (the idle view is a fixed angle, so `prefers-reduced-motion` is
satisfied by construction). The test is the usual one: does the depth *measure*
the data, or just perform? If the latter, drop it, and reach for the flat
`Heatmap` (2.5D contour/heatmap) instead, which is the default for `z = f(x,y)`.
**3D bars, 3D pies, ribbon charts, and perspective cameras stay banned**:
that's depth-for-personality, which distorts comparison.

**The flat pie is allowed, and narrowly.** We long routed every pie to the
treemap, and for a hierarchy or for many parts that is still the right answer.
But the case the pie is actually good at is real: three to six parts of one
whole, where the reading is "about half, about a quarter, the rest", and where
the round shape itself says *this is a whole*. Refusing it only pushed people to
hand-roll an SVG arc, which is worse than shipping a restrained one. `PieChart`
is that restrained one, and the discipline is in its defaults: slices sorted
biggest-first from 12 o'clock so the eye compares neighbours; the share printed
on every slice, because an angle is the hardest quantity to judge by eye; a
percent tick ring around the circumference under the full posture, so a share
can be read off a scale instead of guessed; one neutral ink ramp, never a
rainbow; labels measured, ellipsized and thinned, never rotated; and `maxSlices`
to group a long tail into one named remainder rather than draw twenty
indistinguishable slivers. What stays banned is everything that makes a pie a
picture of itself: depth, explode, a spin on mount, a slice pulled out for
emphasis, and a pie of things that are not parts of one total.

**Maps: a restrained default, with off-aesthetic opt-ins.** Geographic data is
intrinsically spatial, so `Map` is sanctioned like the 3D charts. Its default
`minimal` basemap stays on-posture: a monochrome vector style colored entirely
from `--sf-*` tokens (land/water/roads/labels), data-ink only, re-tinted with the
theme. The `street` and `terrain` presets are deliberately *off-aesthetic*
(photographic-ish, busy, personality-laden) and exist only because some tasks
genuinely need a recognizable map; reach for `minimal` first. One hard rule:
tile-provider **attribution stays visible** (it's a license requirement, not a
decoration to strip), even under `frame={false}` or fullscreen.

### Motion

Motion is functional. It explains state changes; it does not perform
delight.

- **Three durations**: `--sf-duration-fast` (120ms), `-base` (180ms),
  `-slow` (240ms). Anything longer is going to feel laggy to the user
  who's actually trying to work.
- **Three easings**: `--sf-ease-out` for entrances and reveals,
  `-in-out` for state transitions, and `--sf-ease-snap` for a tactile
  "pop". Don't introduce custom curves unless a component genuinely
  needs one.
- **The snap easing is a tactile cue, used sparingly.** `--sf-ease-snap`
  (`cubic-bezier(0.34, 1.7, 0.5, 1)`) overshoots slightly past the
  target then settles, like the feel of a good mechanical keyboard:
  immediate, physical, decisive. Reserve it for *discrete, deliberate*
  moments (a value label revealing on hover, a button settling after a
  press), paired with a fast duration and a single transformed property
  (use the individual `scale`/`translate` properties so it composes with
  layout transforms). It is **not** a general entrance curve and never
  goes on continuous or incidental motion. This is the one sanctioned
  exception to "no bouncy springs" below: one crisp overshoot on a
  purposeful interaction reads as quality; springs on *everything* read
  as a toy.
- **Always respect `prefers-reduced-motion: reduce`**. This isn't
  optional. Every transition needs a static fallback. Many of our
  users have vestibular sensitivity; some are just trying to focus.
- **Animate only what changes.** A button changing color on hover gets
  a transition on `background-color`. It does not get a translate, a
  scale, a rotation, and a shadow expansion as well.
- **No looping animations** outside loading indicators. Spinners spin.
  Shimmer shimmers. Nothing else pulses, bobs, or breathes.

### Charts are instruments, not illustrations

A chart in this library should feel like a measuring device: it redraws, it
does not perform. The concrete discipline (established in the chart-polish
milestone and enforced by the shared `src/lib/chart` layer):

- **Resize tracks 1:1.** Geometry, ticks and labels move in the same commit,
  coalesced to one recompute per frame. Tick positions are never
  transitioned: animated reflow reads as smoothing, and smoothing is a lie
  about the data. Label sets stay stable under live resize (step hysteresis,
  survivor bias); a one-pixel drag never reshuffles which labels are shown.
- **Labels are measured, then thinned or ellipsized. Never rotated.** Rotated
  text is a spreadsheet default, and this library is not a spreadsheet. When labels do not fit, fewer
  legible labels beat many mangled ones; the first and last always survive
  (the range must be readable), and truncated labels carry their full text
  in a title.
- **Chrome is crisp; data is anti-aliased.** Hairlines (gridlines, ticks,
  wicks, cell edges) snap to the device-pixel grid; marks (points, bars,
  lines) do not. Numerals are tabular everywhere they can change.
- **Hover informs instantly.** Crosshair and tooltip share one anchor, appear
  with at most a fast opacity fade, and never lag, lerp, or spring. A
  lagging tooltip reads as inertia, and instruments do not have inertia.
- **Rejected outright:** mount/entrance animations (bars growing, points
  popping), positional tweening on domain changes, eased or smoothed zoom
  (zoom tracks the gesture), hover scale effects, glows and added shadows,
  animated tick reflow. An instrument redraws; it does not animate data.

---

## Anti-patterns

Things we don't do, and why. Cite this section in code review when
something drifts toward consumer-design defaults.

### Grey body text

The cardinal sin. Pale grey text on a white background, often paired
with "soft" branding language, has somehow become the default in
modern interfaces despite being objectively harder to read.

Body text uses `--sf-color-fg`. Period. Muted color is for genuine
secondary content (metadata, captions, axis labels) and even there it
should be `--sf-color-fg-subtle` (#3d3d3d), not the lighter `--sf-color-muted`
(#5e5e5e) unless there's a contrast-tier reason. If your text looks
"too strong", the problem is typographic hierarchy, not color value.

### All-caps text

Never. No `text-transform: uppercase`, no letterspaced caps headings,
no caps section labels. A heading differentiates itself by size,
weight, and rule lines; caps add shout, not hierarchy. Strings that
are inherently acronyms or tickers (MCP, FX, EUR/CHF) render as-is;
it is the transform of ordinary words that is banned.

### Social-network signifiers

Avoid anything that signals "this is a feed":

- **No like / heart / star buttons** that publish public counts.
- **No "engagement" badges** ("trending", "new", "🔥") unless the
  application is literally about ranking content.
- **No avatars on rows that don't need them.** A list of files doesn't
  need a face attached to each row.
- **No infinite scroll for content the user is trying to *find*.** Use
  pagination or virtualized lists with clear position cues.
- **No notification dots on tabs** unless the underlying state genuinely
  changes asynchronously and the user needs to know.
- **No follower-style relationships.** People don't follow files.

### "Friendly" or branded chrome

- **No emoji as iconography.** Icons are line drawings or are absent.
  Emoji are user content.
- **No mascot illustrations** in empty states. An empty state is an
  opportunity to explain what would fill it, not a moment for whimsy.
- **No marketing copy in product UI.** Empty states say what's missing
  and how to add it. Errors say what went wrong and what to try. Loading
  states say what's loading. Nothing celebrates itself.
- **No "Got it!" or "Awesome!" buttons.** OK is fine. Cancel is fine.
  Save is fine.

### Gratuitous visual layers

- **No drop shadows on type.** Type is for reading. Shadows are for
  depth.
- **No gradient backgrounds for chrome.** Solid colors only on toolbars,
  cards, headers, wide buttons. Gradients exist in the system for data
  fills (chart areas, sparklines) and for the face of a small cap (see
  Depth), and that's it.
- **No tinted fills behind coloured text.** A status chip, a calendar
  event, an error banner: each is the page colour with its rim, a 3px
  leading rule and its label in the status colour at full strength. A
  10% wash of the accent behind a 60% version of it is the pastel look
  this library avoids. A tint is for *state* (hover, selection, a drop
  target), where it is transient and marks where the pointer or the
  selection is. A full-strength fill is a different thing: a solid chip
  is the status colour with its label in the colour that reads on it, and
  it is kept for the one chip that must stand out.
- **No glass / blur effects.** See "Depth" above.
- **No skeumorphic textures.** No paper grain, no wood, no leather, no
  brushed metal.

### Engagement-loop motion

- **No bouncy spring animations** on every interaction. They are
  exhausting at scale.
- **No confetti, no checkmark zoom-in celebrations**, no "saved!" tooltip
  that fades out three seconds later.
- **No skeleton screens that pulse for 300ms while real data loads in
  150ms.** Either content is fast enough to show immediately or it's
  slow enough that a skeleton actually conveys something.

### Color tropes

- **No pastel palettes**, no "soft" off-whites, no Tailwind's `gray-400`
  on `gray-50`. If the design feels insubstantial, it probably is.
- **No semantic color for non-semantic things.** Don't color a button
  red because the page section is about "Stop syncing"; color it red
  because clicking it destroys data.
- **No rainbow tag systems.** Tags can be colored when the color carries
  information (priority, status). Otherwise tags are neutral chips.

### Layout tropes

- **No 3-column "feature card" rows** at the bottom of every page.
- **No hero sections in product UI.** Heroes are for marketing pages.
- **No "join the conversation" widgets.** People are here to work.

---

## What we draw from

- **Bauhaus typography**: Tschichold, Herbert Bayer. Geometric, gridded,
  asymmetric when asymmetry pays off.
- **Swiss / International style**: Müller-Brockmann, Hofmann. The grid
  as the structural unit, content as the primary visual element.
- **Industrial design at Braun under Dieter Rams**: ten principles still
  hold. "As little design as possible" is a useful daily check.
- **Information design**: Tufte, Bertin. Data-ink, small multiples, the
  view that every pixel should be answerable for.
- **Technical interfaces**: financial terminals, audio workstations, CAD
  programs, NASA mission control consoles. Interfaces built to be used
  for forty hours a week without fatigue.

These are not nostalgic references. They reflect a specific belief:
that interfaces for working should be optimized for the worker, not for
the platform that hosts them.

The sourced version of this heritage lives in
[docs/research/design-lineage.md](./docs/research/design-lineage.md): each
exemplar paired with a historical-interface image, the design principle and
the trade-off behind it, and a directive for our UI. The table and form
layout rubrics that operationalise it sit alongside in
[docs/research/](./docs/research/).

---

## When in doubt

Two checks that catch most drift:

1. **Would this look out of place next to a 1960s Olivetti manual?**
   If yes, redesign.
2. **Is this element competing with the content for the user's
   attention?** If yes, remove it.

If a third check is needed: **strip it, ship the strip, and only add
back what proves necessary.** This is almost always the right move.
