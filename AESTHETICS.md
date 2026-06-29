# Aesthetics

The opinionated stance behind Swiss-Function. A reference for anyone
building on the system — or contributing to it — so that taste calls
don't drift over time.

The short version: **Bauhaus, not Bay Area.** We want interfaces that
read like technical instruments — sharp, functional, dense with
information — not like social products optimized for engagement.

---

## Stance

We are deliberately stepping away from the design language of the last
fifteen years of consumer software. That language is recognizable:
plump rounded corners, oversized whitespace, soft pastel palettes, blurred
glass surfaces, body text in pale grey, "delight" micro-animations that
run on every state change, full-bleed hero imagery, and the implicit
assumption that the user is here to scroll.

None of that suits the work we actually do. We are building tools for
people who are *reading* and *thinking* — not skimming a feed. Our
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

**One sanctioned exception — light skeuomorphism.** In rare, deliberate
cases we reach for a touch of skeuomorphism reminiscent of *old computers*:
a tactile keycap, a physical-feeling switch, a beveled readout. The aim is
never nostalgia-as-decoration. It's to evoke the era when software was
**fast, understandable, and lightweight** — when a control looked like the
thing it did and did exactly that. Used sparingly and only where it earns
its keep (e.g. `Kbd` rendering a shortcut as a real key), it reinforces the
instrument posture rather than betraying it. The test: does it make the tool
read as *more* honest and direct, or just cuter? If the latter, drop it.

---

## Foundations

### Typography

Type carries the hierarchy. Weight and size do the work that color and
ornament do elsewhere.

- **Sans-serif for prose**, system stack via `--sf-font-sans`. We don't
  ship a custom display face. The OS font is fine; it's also fast and
  cache-stable across users.
- **Monospace for data**, JetBrains Mono preferred via `--sf-font-mono`.
  Inputs, code, axis labels, tabular numbers, anything the eye needs to
  scan column-aligned. Monospace reads as machine-readable on purpose —
  it tells the reader "this is information, not narrative".
- **Three sizes** (`sm`, `md`, `lg`), four weights (regular, medium,
  semibold, bold). Body sits at `md`; `sm` carries secondary content;
  `lg` carries emphasis. There is no `xs` / `xl` — restraint is the
  point. Hierarchy beyond these three lives in **weight, spacing, and
  rule lines**, not in a fourth size.
- **Two line heights**: `1.25` tight (unitless, for dense single-line
  controls — buttons, inputs, tabs) and `--sf-line-height-grid` (an
  absolute `1.5rem`, for block text — what locks prose to the baseline
  grid regardless of font-size).
- **For long-form documents**, reach for `--sf-measure` (65ch) to cap
  line length, and `text-wrap: pretty` for paragraph flow. Code,
  tables, and figures live at `--sf-measure-wide` (80ch).

### Color

Color is a tool, not decoration. Saturated colors mean something; muted
ones recede.

- **Body text is full-strength.** Default to `--sf-color-fg`. The
  number-one anti-pattern in modern web design is grey body text in the
  name of "soft" or "elegant" — it is neither. It is *less legible*.
  Save `--sf-color-fg-subtle` and `--sf-color-muted` for genuinely
  secondary metadata: timestamps next to a username, byte counts beside a
  filename, axis labels under a chart. Never for the sentence you want
  the reader to read.
- **One accent**, primary blue (`--sf-color-primary: #2563eb`). It marks
  what's interactive and what's focused. Everything else is neutral.
- **Semantic colors are reserved** — `--sf-color-danger`, `-success`,
  `-warning` mean something. Don't use them decoratively. A red bar in
  a chart should mean "negative"; a green one, "positive". A red border
  should mean "this is wrong".
- **Dark mode is native, not a port.** Tokens are redefined under
  `[data-theme="dark"]`; subtle borders use `color-mix` so they adapt
  automatically. Never hard-code hex values in component CSS.

### Density

The page is not a slide. Information should fit on it without
journeying.

- **Spacing scales from `--sf-unit`** (1.5rem, equal to the leading of
  body text). Every gap, padding, and component height is a multiple of
  that unit. That's why the whole system lines up on the baseline grid.
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
  for everything except circles and pills. Buttons, inputs, cards — all
  2px. The result reads as drawn with a hard pencil, not a felt-tip pen.
- **Only round what's meant to be round.** Switch handles are circular
  because they roll. Avatars are circular because faces are round.
  Buttons are not circular.
- **Pill shapes** (radius-full) are reserved for tags and toggle states
  where the rounded form carries semantic weight — typically "this is a
  badge, not a button".

### Borders

- **One structural border.** Every edge that frames a thing — panes,
  cards, dialogs, popovers, menus, inputs, and the dividers inside tables
  and lists — uses the single `--sf-color-border`. There is no "strong vs
  subtle" tier for structure; `--sf-color-border-strong`/`-subtle` are
  aliases of it. When you need two things to read as separate, use
  elevation and spacing, not a second, lighter line.
- **A resting border is never primary.** Inputs sit on the neutral border
  at rest; `--sf-color-primary` appears only on *state* — focus ring,
  hover, checked/selected. A blue box just sitting there means nothing.
- **`--sf-color-gridline` is the one exception, and it is not a border.**
  It's the faint hairline for data-viz scaffolding — chart gridlines and
  axes, Skeleton placeholder edges — deliberately quieter than the
  structural border so data and content stay in front of the scaffolding.

### Depth

Depth indicates layer, not personality.

- **Six elevation steps** (`--sf-elevation-0` through `-5`). Surfaces
  use them sparingly. Most of the page sits at 0 or 1.
- **Controls get a tactile cue**: `inset 0 1px 0 rgb(255 255 255 /
  0.18)` along the top edge, plus their elevation drop shadow. Together
  they read as a slightly raised key on an instrument panel. Buttons,
  inputs, switches all share this signature.
- **No glassmorphism**, no backdrop blur, no semi-transparent overlays
  pretending to be physical. We are not simulating frosted plastic. We
  are stacking flat planes.

**One sanctioned exception — measured 3D for genuinely-3D data.** The chrome
stacks flat planes, but data can be intrinsically three-dimensional (a surface
`z = f(x,y)`, a point cloud), and flattening it loses information. There the 3D
charts (`Surface`, `PointCloud`) are allowed — rendered as *instruments*, not
decoration: **orthographic (axonometric) projection**, so there's no
vanishing-point perspective and lengths stay comparable along each axis, like a
CAD/engineering drawing; flat shading and a single-hue, token-derived height
ramp; a measured bounding-box frame with axis ticks; **drag-to-rotate only —
never auto-spin** (the idle view is a fixed angle, so `prefers-reduced-motion` is
satisfied by construction). The test is the usual one: does the depth *measure*
the data, or just perform? If the latter, drop it — and reach for the flat
`Heatmap` (2.5D contour/heatmap) instead, which is the default for `z = f(x,y)`.
**3D bars, 3D pies, ribbon charts, and perspective cameras stay banned** —
that's depth-for-personality, which distorts comparison.

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
  target then settles — the feel of a good mechanical keyboard:
  immediate, physical, decisive. Reserve it for *discrete, deliberate*
  moments — a value label revealing on hover, a button settling after a
  press — paired with a fast duration and a single transformed property
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
should be `--sf-color-fg-subtle` (#4b5563), not the lighter `--sf-color-muted`
(#6b7280) unless there's a contrast-tier reason. If your text looks
"too strong", the problem is typographic hierarchy, not color value.

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
  cards, headers. Gradients exist in the system for data fills
  (chart areas, sparklines) — that's it.
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

---

## When in doubt

Two checks that catch most drift:

1. **Would this look out of place next to a 1960s Olivetti manual?**
   If yes, redesign.
2. **Is this element competing with the content for the user's
   attention?** If yes, remove it.

If a third check is needed: **strip it, ship the strip, and only add
back what proves necessary.** This is almost always the right move.
