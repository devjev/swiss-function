# Design Lineage and Aesthetic References

## The lineage, and why it is our north star

Swiss-Function descends from a single tradition: the design of precision instruments and the graphic systems that document them. Dieter Rams and Braun; the Airbus glass cockpit and the disciplines of aviation display; Porsche and the automotive instrument cluster; the tactile "quality through precision of fit" of a Curta calculator, a Leica M3, a Hasselblad V, a Tektronix scope, a Moog patchbay; the Swiss grid of Muller-Brockmann, Vignelli and Gerstner; and their digital heirs from the DEC VT100 to the Bloomberg Terminal to Teenage Engineering. These objects were not styled to impress on first sight. They were engineered to be read correctly, under stress and fatigue, for tens of thousands of hours, and they still read correctly decades later. That is exactly the test our library sets itself: an interface for people who are reading and thinking for forty hours a week, judged by whether it would look out of place next to a 1960s Olivetti manual, not by whether it looks novel this year. This document pulls out what actually transfers from these objects to a screen UI toolkit (grid, density, restraint, honesty of function, tactile feedback, legibility, colour as meaning, longevity) and, for every exemplar, states a concrete directive keyed to our tokens and components. It is the applied companion to [AESTHETICS.md](../AESTHETICS.md); read that for the stance, read this for the lineage that earns it.

---

## 1. Rams and Braun: "less, but better"

The founding discipline: subtraction, honesty of function, order through an invisible grid, and colour used as a functional code rather than a coat.

### Braun T3 pocket radio (1958, Dieter Rams with Hans Gugelot)

![Braun T3 pocket radio](inspiration/rams-braun/braun-t3-pocket-radio.jpg) - CC BY-SA 4.0, photo PeterAjtony, Wikimedia Commons.

The face splits cleanly in two honest zones: a machine-drilled speaker grid on the left, one tuning dial with an engraved scale on the right. No decorative trim, no branding on the working face. The perforation grid is not ornament; it is the speaker, exposed and regularized. Function made visible becomes the only decoration the object needs.

**Directive.** Split any control surface (a toolbar, a `DataTable` header, a `Pane.Header`) into an honest output region and a control region with one clean boundary, rather than scattering controls across the field. Let the working mechanism be the texture: a monospace numeric scale, a hairline grid, an aligned column of inputs. Derive texture from real data density (rows, ticks, digit cells), never from applied graphics.

### Braun ET66 pocket calculator (1987, Rams and Dietrich Lubs)

![Braun ET66 pocket calculator](inspiration/rams-braun/braun-et66-pocket-calculator.jpg) - CC BY-SA 2.0, photo Pinot Dita, Wikimedia Commons.

A near-monochrome field with a strict 5-column grid of keys. Colour encodes function only: numerals dark, operators a quiet warmer olive (a different class of key), and the single yellow "=" key marking the one action you commit with. That one warm key is the only saturated colour on the instrument. Restraint is what makes the accent legible.

**Directive.** Hold the interface monochrome and spend `--sf-color-primary` (or a semantic tone) only on the one action that commits or the one thing that is focused, exactly like the yellow "=". Never colour a control decoratively while it rests. Encode a second class of control (secondary vs primary) with a quiet tonal step, not a second hue. Keep numerals in `--sf-font-mono` with tabular figures so `DigitInput`, `DataTable` cells and keypads align and scan like the ET66. This is already our rule; the ET66 is the image to cite in review.

### Braun SK4 Phonosuper, "Snow White's Coffin" (1956, Rams and Gugelot)

![Braun SK4 Phonosuper ("Snow White's Coffin")](inspiration/rams-braun/braun-sk4-phonosuper-snow-white-s-coffin.jpg) - CC0 public domain, photo Alf van Beem, Wikimedia Commons.

In a market of veneered cabinets with hinged lids, this arrived looking like lab equipment: a transparent Plexiglas lid that invites inspection of the platter instead of hiding it, all controls confined to one strip on the right, and a speaker grille that is just thin horizontal rules pressed into metal. The clear lid was an honesty move and an engineering one (metal rattled at volume). A hairline rule, repeated, is enough texture.

**Directive.** Prefer transparency over friendly concealment: surface the real state and real data (a live count, the actual query, the raw value in an editable cell) rather than smoothing it behind summarized chrome. Corral controls into one honest strip (a single `Pane.Header` or toolbar), leaving the body a calm working surface. Build separation from repeated hairlines at `--sf-color-gridline`, not from shadows or fills. Let one structural element carry any warmth; do not paint warmth on.

### 606 Universal Shelving System (1960, Rams for Vitsoe, still in production)

![606 Universal Shelving System](inspiration/rams-braun/606-universal-shelving-system.jpg) - CC BY-SA 3.0, photo Vitsoe, Wikimedia Commons.

A tiny kit of parts hung from wall tracks, recombining into endless configurations, all snapped to one vertical grid: asymmetric in arrangement, rigid in alignment. A shelf bought today still fits a rail from 1960. Order comes from the grid, which frees the arrangement to be content-driven without ever looking messy. Longevity is designed in: adaptable, repairable, deliberately un-fashionable.

**Directive.** Treat the toolkit itself as a 606 kit of parts on one shared grid: every gap, height and inset a multiple of `--sf-unit` snapped to the baseline, so `Grid`, `FieldLayout` and `Pane` compositions align like shelves on a rail however they are arranged. Let layout be asymmetric and content-driven while alignment stays rigid (the `FieldLayout` left-to-right fill is exactly this). Guard backward compatibility as a feature: extend with props and tokens, never fork, so a screen built on an old version still hangs on the rail. Choose the un-fashionable long-life default (2px corners, system font, no trend styling) precisely so the interface does not date.

---

## 2. Aviation cockpits: colour as a reserved channel, lit by exception

High-trust displays that a trained eye reads at a glance, under glare and fatigue. The strongest lesson in the whole lineage about colour discipline and spatial constancy.

### Airbus Primary Flight Display and Flight Mode Annunciator (1982 to present)

![Airbus Primary Flight Display (PFD) and the Flight Mode Annunciator](inspiration/aviation-cockpit/airbus-primary-flight-display-pfd-and-the-flight-mod.jpg) - CC0 1.0, photo Olivier Cleynen.

A near-monochrome screen where every saturated pixel is answerable to a state: green engaged, cyan armed, amber attention, red hazard or limit. The live altitude is boxed and holds its pixel position while the scale scrolls behind it. A fixed header strip (the FMA) always names the active mode in words plus one colour, and never moves.

**Directive.** Give every live numeric readout (`DigitInput`, `DataTable` metric cells, KPI tiles) a fixed-width box with tabular monospace numerals so digits never reflow as they change; let the scale or trend move, never the number. Keep colour strictly semantic: a resting control is neutral (`--sf-color-border`, `--sf-color-fg`), and `--sf-color-primary` / `-success` / `-warning` / `-danger` appear only to mark a genuine state or limit. Provide a persistent status strip in a fixed `Pane.Header` slot that spells out the current mode in words plus one colour, and never reorders it.

### ECAM and the dark cockpit (1983 to present)

![Electronic Centralised Aircraft Monitor (ECAM) and the dark cockpit](inspiration/aviation-cockpit/electronic-centralised-aircraft-monitor-ecam-and-the.jpg) - CC BY 2.0, photo Steve Jurvetson.

The overhead panel sits dark under normal operation; a fault lights a single button and posts a colour-tiered message. Severity is two tiers that never collapse into one alert: red master WARNING (immediate action, steady light, continuous chime) versus amber master CAUTION (awareness, single chime). Each alert is paired with the corrective action, so the display tells you what to do, not just that something is wrong.

**Directive.** Make the resting UI genuinely quiet: no colour, no badges, no notification dots when nothing is wrong (our "no engagement signifiers" rule as an instrument principle). Reserve exactly two alert tiers and keep them distinct: `--sf-color-warning` for an awareness caution (persists, does not interrupt) and `--sf-color-danger` for an action-required hazard (stronger, may interrupt); never a third decorative alert colour. Pair every error or warning with the concrete next action, and route both through `NonIdealState` or a status region rather than scattering them.

### MCDU / FMS data-entry unit and the scratchpad (late 1980s to present)

![MCDU / FMS data-entry unit and the scratchpad](inspiration/aviation-cockpit/mcdu-fms-data-entry-unit-and-the-scratchpad.jpg) - Public domain, photo Christoph Paulus.

A fixed 14 by 24 monospace screen, two columns of labelled fields, each flanked by a line-select key so the label sits right beside the control that acts on it. Input is typed into one scratchpad line at the bottom, then committed into a chosen field with a single deliberate press. Edits are staged, previewable and reversible before they take effect.

**Directive.** In forms use the `Field` compound so the label sits immediately adjacent to its control (never a distant floating legend), and lay whole forms out with `FieldLayout` so fields hold strict source order on a fixed grid. For dense inline editing (`DataTable` cells, a command bar), stage the pending edit in one consistent location and commit on an explicit action (the scratchpad-then-line-select pattern) so a value is previewed before it takes effect. Keep entered and tabular data in `--sf-font-mono` with `font-size-adjust: var(--sf-font-mono-adjust)`, and reserve amber (`--sf-color-warning`) purely for a genuine input problem.

### The glass flight deck as a fixed-layout workplace (1988 to present)

![The glass flight deck as a fixed-layout workplace](inspiration/aviation-cockpit/the-glass-flight-deck-as-a-fixed-layout-workplace.jpg) - CC BY-SA 2.5, photo Ralf Roletschek.

Six identical-format screens in a permanent grid; nothing moves house between flights. The Navigation Display is a dark scan showing only the route arc, range rings and traffic that matter now. Spatial constancy means recognition replaces search, and cross-crew training transfers directly. The layout is judged by decades of fatigue-free use, not by novelty.

**Directive.** Assign each region of an app a permanent home with `Pane` / `Grid` and do not reflow or reorder critical information on state change; a `DataTable` column, a status strip and a detail pane should be where the user last left their eyes. Follow the Navigation Display in charts: default to `scaffolding="hover"` so gridlines and axes stay quiet (`--sf-color-gridline`) and the data marks carry the ink, adding scale only when density demands it. Strip anything competing with the data and add back only what proves necessary.

---

## 3. Automotive instruments: rank by decision-value, one colour for one threshold

Porsche instrument clusters: a matte field that recedes so only the data is lit, typographic hierarchy rendered in metal and paint, and layout treated as a decades-long contract.

### Porsche 356 A cockpit: the centrally placed tachometer (1955 to 1959)

![Porsche 356 A cockpit: the centrally placed tachometer](inspiration/automotive-instruments/porsche-356-a-cockpit-the-centrally-placed-tachomete.jpg) - CC BY-SA 3.0, photo PekePON, Wikimedia Commons.

Porsche put the tachometer dead centre and dominant, on the stated reasoning that exact speed is secondary (a racer drives as fast as possible anyway) while rpm governs the shift point and protects the engine. Hierarchy by importance, not convention. A complete driver surface is built from only three instruments, each present because a real decision needs it.

**Directive.** In a dense readout or dashboard, put the metric the user acts on in the optical centre and give it the largest type, even when convention would front-load a different number. Use `Grid` to reserve one fixed central primary-readout slot with smaller `sm`-sized satellites around it; rank tiles by decision-value and refuse to make every KPI the same size. Add a readout only when a real decision needs it.

### Air-cooled Porsche 911 five-gauge cluster, VDO (1963 onward)

![Air-cooled Porsche 911 five-gauge cluster (VDO)](inspiration/automotive-instruments/air-cooled-porsche-911-five-gauge-cluster-vdo.jpg) - CC BY-SA 3.0, photo KarleHorn, Wikimedia Commons.

A fixed symmetrical fan of graduated dials with one dominant member, matte black faces so the only bright things are needles and numbers, and a single saturated colour (red) reserved strictly for the redline threshold. Nothing decorative survives.

**Directive.** Build stat and metric clusters as a fixed, ordered grid with one dominant tile and equal-weight satellites; keep the ground neutral (`--sf-color-bg`, near-black in dark mode) and let only the values carry contrast. Reserve saturated colour (`--sf-color-danger`) for an actual threshold crossing, never for decoration, and use tabular numerals wherever a number can change. This is typographic hierarchy, not colour hierarchy, rendered in dials.

### Porsche 997 central tachometer with warning tell-tales (2004 to 2012)

![Porsche 997 central tachometer with warning tell-tales](inspiration/automotive-instruments/porsche-997-central-tachometer-with-warning-tell-tal.jpg) - CC BY-SA 2.5, Wikimedia Commons.

Status tell-tales hold fixed, learnable positions but render nothing until their condition is true, so nothing competes for attention it has not earned. And the gauge dual-encodes: an analog sweep for the instantaneous rate, a small digital inset for the exact figure, both inside one instrument. Ticks stay crisp and fixed; only the needle moves.

**Directive.** Give status indicators reserved, stable slots but render nothing (or the quietest neutral) until the state is real: no notification dots, no decorative new-badges. When a value needs both a quick trend read and an exact figure, pair a sparkline or a `Spinner`-style glyph with a tabular numeric readout instead of choosing one. Keep chrome (ticks, rules, cell edges) crisp and pixel-snapped while the moving mark stays anti-aliased.

### Porsche 997 five-gauge cluster through the wheel (2004 to 2012)

![Porsche 997 five-gauge cluster through the wheel](inspiration/automotive-instruments/porsche-997-five-gauge-cluster-through-the-wheel.jpg) - CC BY-SA 2.5, photo Cerafino, Wikimedia Commons.

Forty years on, the layout is unchanged: still tachometer-centred and largest, but new digital data (odometer, clock, temperature) was folded into the existing dials rather than bolted on as a new panel. Porsche kept the cluster only lightly configurable, on the record, to protect the driver's spatial memory. Consistency is treated as a feature you do not spend lightly.

**Directive.** When adding features to a dense tool, fit them into established layout slots instead of reflowing the surface, and keep component positions stable across versions so muscle memory survives. Absorb new data into an existing readout (an inline value inside a tile) rather than adding a panel, and resist configurability that fragments a shared layout. This backs our fixed token grid and stable-chrome stance.

---

## 4. Mechanical precision: one locus and one gesture, group by zoning not boxes

Instruments that read as high quality because of the fit and the decisive detent of each control, not any ornament. The cluster that most directly licenses our tactile-feedback vocabulary.

### Curta mechanical calculator (1948 to 1970, Curt Herzstark)

![Curta mechanical calculator (Type I / II)](inspiration/mechanical-precision/curta-mechanical-calculator-type-i-ii.jpg) - CC BY 2.0, Wikimedia Commons / Computer History Museum.

The whole interaction concentrates in one input locus: the crank is the only submit. Subtraction is not a far-away button but the same crank entered with a small pull-first gesture. State is engraved and always visible in the register; quality is communicated entirely through precision of fit and the decisive click of each turn.

**Directive.** Give a dense entry control one primary action locus and express its secondary mode as a modifier on that same gesture, never as a distant toggle. In `DigitInput` / `DigitInputMicro` keep the calculator "push" feel where digits commit decisively into fixed, always-visible tabular-numeral cells (never placeholder text that vanishes); reserve `--sf-ease-snap` for that single committing keystroke so the value seats like a detent. Show current state permanently in engraved monospace rather than revealing it on hover.

### Hewlett-Packard HP-35 scientific calculator (1972)

![Hewlett-Packard HP-35 scientific calculator](inspiration/mechanical-precision/hewlett-packard-hp-35-scientific-calculator.jpg) - CC BY-SA 3.0, Wikimedia Commons.

A crowded 35-key panel zoned by weight, size, spacing and a single accent, not by boxes. The most important action (ENTER, the stack push) is the largest and most saturated key, so the hand finds it without reading. Legends were molded through the plastic so they could never wear off.

**Directive.** Zone a control cluster (a toolbar, a `ButtonGroup`, a form's action row) by typographic weight, key size, whitespace and exactly one accent (`--sf-color-primary` on the single primary `Button`), never by boxing every group in borders. The primary action is visually the largest and most saturated element; everything else is neutral. Keep legends full-strength and always present (never grey, never hover-only) so the affordance never wears off.

### Tektronix 465B analog oscilloscope front panel (mid-1970s)

![Tektronix 465B analog oscilloscope front panel](inspiration/mechanical-precision/tektronix-465b-analog-oscilloscope-front-panel.jpg) - CC BY-SA 4.0, Wikimedia Commons.

A high-density panel kept legible by dividing it into labelled functional regions separated by a faint background tint, rule lines and space rather than heavy borders. Red center knobs mean one specific thing (you are off calibration). A coarse control nests its fine adjustment concentrically, in the same place. Small-caps labels and quiet gridlines keep scaffolding behind the data.

**Directive.** Zone dense surfaces (a `Box` or `Pane` full of controls, a `DataTable` toolbar, a chart's control cluster) into labelled regions cued by a faint tint or a single `--sf-color-border` rule and spacing on the `--sf-unit` grid, not by nesting boxed cards. Reserve semantic colour for genuine state: a red ring or marker means "this value is out of range," echoing the red VAR knob. Keep a coarse-plus-fine pair together (a stepped value with an inline nudge), and keep gridlines and axis chrome on `--sf-color-gridline`, quieter than structural borders.

### Moog modular synthesizer patchbay (1960s to 1970s)

![Moog modular synthesizer (patchbay layout)](inspiration/mechanical-precision/moog-modular-synthesizer-patchbay-layout.jpg) - CC BY-SA 4.0, Wikimedia Commons.

A wall of modules, every one a uniform-width strip with an identical internal layout (label top, controls middle, patch jacks bottom). Density is enormous but legible because the grid of identical modules teaches the eye one layout it reuses everywhere. Patch cords make the signal routing physically visible and hand-editable.

**Directive.** Compose dense tool surfaces as a uniform `Grid` of modules that share one internal template (label top, controls middle, inputs and outputs bottom) aligned to `--sf-unit` tracks, so scanning is learned once. When elements connect, draw the connection explicitly: use `Graph`'s visible, editable edges or a rendered line rather than burying the relationship in a config panel. Favour a stable left-to-right, top-to-bottom flow so the eye follows the pipeline.

---

## 5. Cameras: only what is needed, engrave don't sticker, honest seams

Leica and Hasselblad: control density stripped to the task, labels cut into the material, modular bodies that snap together at legible joints and report their own state.

### Leica M3 top plate (1954, Ernst Leitz Wetzlar)

![Leica M3 top plate (Ernst Leitz Wetzlar, chrome brass body with 50mm Summicron)](inspiration/cameras/leica-m3-top-plate-ernst-leitz-wetzlar-chrome-brass-.jpg) - CC BY-SA 2.0 FR (dual CeCILL), author Rama, Wikimedia Commons.

The top plate carries only what shooting needs: no mode dial, no scene selector, no branding beyond a maker's mark. Each control earns its footprint and is married to one job. Labels are cut into the metal, permanent and monochrome, so hierarchy comes from position, size and rule, never colour. The one combined shutter dial consolidates a whole decision onto a single detented control. Colour appears exactly once, as a red index dot.

**Directive.** Strip component chrome to the controls the task actually needs and treat a finished-looking blank surface as done, not empty. Render labels and values in `--sf-font-mono` at full strength (`--sf-color-fg`, with `font-size-adjust: var(--sf-font-mono-adjust)`), single weight, grid-aligned, carrying hierarchy through position and rule lines rather than colour. Spend `--sf-color-primary` like the red index dot: once, only to mark the active or focused state. Prefer one consolidated control (a single `ToggleGroup`, one dial-like stepper, one `Picker`) over several scattered toggles for a single decision.

### Leica M3, low-key study (same body, rim-lit against black)

![Leica M3, low-key study (same body, rim-lit against black)](inspiration/cameras/leica-m3-low-key-study-same-body-rim-lit-against-bla.jpg) - CC BY-SA 2.0 FR (dual CeCILL), author Rama, Wikimedia Commons.

The camera does not need even lighting to be legible: the eye finds the controls from a few crisp specular highlights on the working parts while everything non-functional recedes into near-black. This is a direct model for an honest dark theme, where near-black is the field and the interactive edges catch the light rather than every surface being lifted by a soft glow.

**Directive.** Build dark mode the way this body reads at rest: let near-black be the field and let only the working edges catch light. This is exactly our `[data-theme="dark"]` elevation model (a brutalist zero-blur hard cast in the border colour, a faint lightening film only above elevation 1, and a 1px lit inset rim that brightens with level): lean on those lit edges to define controls instead of raising surface backgrounds or adding glow. Reserve the specular-highlight brightness for interactive and focused elements; keep resting chrome quiet so the active control is the thing that catches the eye.

### Hasselblad 500 C/M, profile (500C 1957, C/M from 1970)

![Hasselblad 500 C/M with waist-level finder and 80mm Carl Zeiss Planar (profile)](inspiration/cameras/hasselblad-500-c-m-with-waist-level-finder-and-80mm-.jpg) - CC BY-SA 4.0, author Christopher Crouzet, Wikimedia Commons.

Not one moulded object but body, film back, finder and lens, each swappable, each doing one job, each joined at a legible bright seam. A module carries its own always-visible status readout: the film back shows "12" frames and a film-type reminder, so the system reports its own state without a screen. The leaf shutter in the lens is what makes lens and body cleanly separable: a clean interface between parts.

**Directive.** Compose interfaces from distinct modules, each owning one job, separated by exactly one structural border (`--sf-color-border`), keeping the seam legible rather than dissolving panels into each other (use elevation and spacing, not a second lighter line). This is the compound-component grammar we already have: `Pane.Header` over `Pane.Body`, `Dialog.Root` / `Handle` / `Body`, `WindowArray` columns, a `DataTable` whose swappable data is the film back. Give each module a small, always-visible status readout of its own state (a `Chip` with a `dot`, a frame counter), engraved-quiet in mono, never a notification badge.

### Hasselblad 500C with Carl Zeiss Planar lens, three-quarter front (1957)

![Hasselblad 500C with Carl Zeiss Synchro-Compur Planar lens (three-quarter front)](inspiration/cameras/hasselblad-500c-with-carl-zeiss-synchro-compur-plana.jpg) - Public domain, author Holger Ellgaard, Wikimedia Commons.

Every coupled exposure parameter (shutter, aperture, EV, focus) is stacked coaxially on one barrel, so the whole exposure state reads in a single glance and adjacent rings turn without the hand moving. Two engraving colours separate two coupled scales without clutter. The body is a hard rectilinear cube whose only softening is a hairline radius on the chrome corner rails: sharp as a decision, radiused only where a hand grips it.

**Directive.** Co-locate and co-align coupled parameters so their combined state reads in one glance: use `FieldLayout` rigid and flexible rows and mono tabular figures so adjacent related fields line up on the baseline grid and the whole state is one read, not a hunt across a form. Keep the rectilinear body sharp: honour `--sf-radius-default` at 2px as the chrome corner rail, a whisper of rounding for grip, and resist any pull toward 8 to 16px softening. Where two coupled scales share a control, distinguish them by one restrained means (mono weight, a rule, or the single `--sf-color-primary` index), never a rainbow.

---

## 6. The Swiss grid: design the programme, not the page

Muller-Brockmann, Vignelli and Gerstner: the grid as an invisible source of order, hierarchy from scale and space rather than colour, and identity from a single strong invariant that absorbs enormous content variety.

### Josef Muller-Brockmann, Beethoven Tonhalle poster (1955, Zurich)

![Josef Muller-Brockmann, Beethoven Tonhalle concert poster](inspiration/swiss-grid/josef-muller-brockmann-beethoven-tonhalle-concert-po.jpg) - CC BY-SA 4.0, Wikimedia Commons.

One dominant rule-driven graphic idea (rhythm as concentric arcs on a fixed angular module) does all the expressive work, with no colour and almost no help from type size, beside a tiny disciplined credit block set as label/value pairs: a narrow left column of labels aligned to a common right edge, a wider value column flush-left. Alignment alone supplies the structure.

**Directive.** Set every metadata block (a `Field` row group, a key/value `DataTable`, a definition list, a chart caption cluster) exactly like this credit block: a narrow left column of labels aligned to a shared right edge, a wider value column flush-left, both at `--sf-font-size-sm`, one `--sf-unit` of leading between rows, no rules or dividers or colour. Let alignment be the structure. When one element must lead a view (a hero metric, a `NonIdealState` message, a chart), make it dominate by scale and by the silence around it, keeping every supporting label small and gridded.

### Josef Muller-Brockmann, der Film exhibition poster (1960, Zurich)

![Josef Muller-Brockmann, der Film exhibition poster](inspiration/swiss-grid/josef-muller-brockmann-der-film-exhibition-poster.jpg) - Public domain, Wikimedia Commons.

The oversized title is built on the same modular squares that structure the page, so the image is made of type rather than dropped onto it. The one accent, red, is reserved strictly for functional text (institution, dates, a tabular opening-hours block), while the big graphic element stays neutral. Large negative space is a held choice governed by the grid, not filler.

**Directive.** Reserve `--sf-color-primary` for functional, actionable or state-bearing text and marks, never for the large neutral display element (a page title, a wordmark, a big metric stays in `--sf-color-fg`). Set any schedule, hours or numeric tabular block (a `DataTable` time column, a `DatePicker` listing, a log timestamp column) in aligned monospace columns like these opening hours. When a single element is meant to be oversized, build it on the same grid and unit math as the layout, at heavy weight in deliberate negative space, so display and structure are one system.

### Massimo and Lella Vignelli, 1972 New York City Subway diagram

![Massimo and Lella Vignelli, 1972 New York City Subway diagram](inspiration/swiss-grid/massimo-and-lella-vignelli-1972-new-york-city-subway.jpg) - Photograph CC BY 2.0 (Michael Cory, Wikimedia Commons); map design by Massimo and Lella Vignelli / Unimark for the MTA.

Clarity by abstraction: every route line constrained to 0, 45 and 90 degrees, one line weight, one uniform station marker, route identity encoded by colour from a small fixed palette, geography thrown away. The worn in-situ photograph, torn and tagged, adds the second lesson: an artifact built on structure alone stays legible and dignified after decades.

**Directive.** For any node-link or route view (`Graph`, a process or pipeline diagram, connector routing, `Flows`), constrain edges to a fixed angle set (orthogonal, or orthogonal plus 45), use one uniform line weight and one uniform node marker, and encode series identity by colour from a small fixed palette rather than by varying shape or thickness. Prefer a clean schematic over geographic accuracy whenever the task is to trace a path, and ship a compact fixed legend keyed to those colours. Treat the worn map as a durability test: our chrome must read correctly stripped of gloss (no gradients, no glow, flat planes, sharp corners).

### Massimo Vignelli, National Park Service Unigrid system (1977 to present)

![Massimo Vignelli, National Park Service Unigrid brochure system](inspiration/swiss-grid/massimo-vignelli-national-park-service-unigrid-broch.jpg) - Public domain (US federal government work, National Park Service), Wikimedia Commons.

One rigid invariant (a solid black title band, fixed Helvetica, modular folding panels) absorbs hundreds of parks by many authors and still reads as one identity. The constraint is the brand. Consistency at scale comes from removing per-instance styling decisions, not from policing them.

**Directive.** This is the model for the toolkit itself: fix one invariant chrome and let content vary underneath it. Our equivalent of the black band is the token set (the `--sf-color-*` palette, `--sf-unit`, the three type sizes, sharp 2px corners) plus the fixed component chrome (`Pane.Header`, `Dialog.Handle` and title, `MenuBar`), and consumers must not re-skin it per screen. Every `Pane` header, `Dialog` title and `DataTable` header should look identical across an app, so "which module am I in" is answered by content, not by re-themed chrome. When a component needs a new look, add a prop within the system (`variant`, `size`, `tone`), never a bespoke fork.

### Karl Gerstner, Designing Programmes and the Capital magazine grid (1962 to 1964)

No freely licensed image available (Gerstner's work is still largely under copyright and absent from Wikimedia Commons). Reference: *Designing Programmes*, Lars Muller Publishers; open scan at openlab.citytech.cuny.edu.

Gerstner built one fine substructure of 58 units that resolves simultaneously into 1, 2, 3, 4, 5 or 6 columns, so one grid yields many layouts without ever breaking alignment. His thesis: design the rule set (the programme) and let it generate the solutions. Flexibility and consistency are not opposites; a well-chosen programme delivers both.

**Directive.** Make our layout primitives programmes, not fixed templates. Base column systems on one fine underlying unit (`--sf-unit`) that subdivides cleanly into 2, 3, 4 and 6 tracks, so the same grid answers many densities without new breakpoints (this is how `Grid` and `FieldLayout` factor, and it matches the container-driven, breakpoint-free collapse the library favours). Prefer a rule the consumer parameterizes through props and tokens over a hardcoded arrangement. When building any new component, first define its programme (its tokens, its unit math, its allowed states) and let the specific rendering fall out.

---

## 7. Digital heirs: monospace as a signal, keyboard-first for the daily expert

Screen-native descendants that carry the instrument posture into pixels: the VT100's character grid, Bloomberg's amber-on-black expert tool, iA Writer's honest monospace, and Teenage Engineering's constrained control surfaces.

### Teenage Engineering OP-1 (2011 to present, Sweden)

![Teenage Engineering OP-1](inspiration/digital-heirs/teenage-engineering-op-1.jpg) - CC BY-SA 2.0, author justin lincoln, Wikimedia Commons.

Four rotary encoders colour-coded blue, green, white, orange, where each colour maps to one live synth parameter and to the matching sector of the display. The colour is not a mood; it is a persistent, learnable functional code, and it survives the "one accent" rule precisely because it is a fixed channel-to-colour mapping. Direct manipulation plus a tiny always-on readout beats nested menus.

**Directive.** Reserve any multi-hue scheme for a fixed channel-to-colour mapping the user learns once and sees identically everywhere (a `ToggleGroup` or `DigitInput` whose N channels each own a stable token colour, echoed in the chart series that reads them); outside such a coded channel, stay neutral with the single primary accent. Give real controls generous hit targets and pair each with a small monospace readout rather than a modal. When a control set maps one-to-one onto distinct parameters, expose all of them at once and let the fixed colour code carry the wayfinding.

### Teenage Engineering Pocket Operators (2015 to present, Sweden)

![Teenage Engineering Pocket Operators](inspiration/digital-heirs/teenage-engineering-pocket-operators.jpg) - CC BY 2.0, author Tim Walker, Wikimedia Commons.

A caseless printed circuit board that is itself the faceplate, function names silkscreened straight onto the board right where the finger lands. The construction is the product: sensitive parts hide behind the LCD so no case is needed, and the saving goes into better components. Honest construction reads as quality.

**Directive.** Label controls directly and locally in monospace (the control carries its own name, shortcut and unit) instead of relying on a distant legend or tooltip; lay dense, equal, tactile cells on a strict grid rather than padded cards. Take the one sanctioned skeuomorphism (`Kbd` keycaps, the tactile top-edge inset on inputs and switches) only where it makes a control read as more honest and direct, and drop it the moment it reads as merely cute. Do not hide structure behind a soft surface; let the working parts of a component be visible.

### iA Writer (2010 to present, Information Architects, Tokyo)

No freely licensed image (the app UI is copyrighted). Directive derived from iA's published design rationale.

The argument is precise: a proportional font whispers "almost published" while a monospace font says "work in progress," so mono is the more honest choice for text that is still thinking. iA later refined this into a duospace design so the mono grid stays honest without fighting readability. The app ships almost no settings on purpose, a single blue accent for the caret, and a focus mode that dims surrounding context rather than hiding it.

**Directive.** Keep the monospace/sans split load-bearing: `--sf-font-mono` for anything the eye scans as data or input (fields, code, tabular numerals, axis labels) and sans only for running prose, always paired with `font-size-adjust: var(--sf-font-mono-adjust)` so mono sits on the sans x-height (the same balancing instinct as iA's duospace). Use exactly one accent (`--sf-color-primary`) for the single live element (caret, active row, focus ring) and keep everything else neutral. Prefer opinionated defaults and few props over a settings panel. When you build a focus affordance, dim surrounding context transiently as a state, and never let that become resting body copy: at rest, body text is still full-strength `--sf-color-fg`, never grey.

### Bloomberg Terminal, keyboard and amber-on-black (1982 to present)

![Bloomberg Terminal (keyboard + amber-on-black)](inspiration/digital-heirs/bloomberg-terminal-keyboard-amber-on-black.jpg) - Public domain, author Cariafraweb, Wikimedia Commons.

An expert tool that optimizes for the daily user, not the newcomer: keyboard-first command entry with a persistent command line and a single decisive commit key, a yellow function-key bank that colour-codes the whole market namespace, and amber-on-black readouts for long sessions. The 9 by 19 monospace font was reproduced pixel-for-pixel across decades of hardware; stability and recognizability outrank fashion.

**Directive.** Treat the keyboard as the primary input surface for expert flows: a persistent command or search entry, a single obvious commit key (Enter), and discoverable shortcuts shown as `Kbd` keycaps driven by a central hotkey engine (`focusFieldHotkey`), rather than burying actions in menus. Where a set of destinations forms a stable domain namespace, give it one consistent learnable colour and label code across the whole app, not per-screen ad hoc colour. Lean on native dark mode and full-strength contrast for long-session density (dense `DataTable`s, mono tabular numerals). Hold token names and component contracts stable across versions so a returning user's muscle memory still works.

### DEC VT100 and terminal culture (1978, and the grid it standardized)

![DEC VT100 and terminal/monospace culture](inspiration/digital-heirs/dec-vt100-and-terminal-monospace-culture.jpg) - CC BY 2.0, author Jason Scott, Wikimedia Commons.

The terminal that fixed the grammar of the text interface: a directory listing in perfectly aligned monospace columns, a footer totalling files and blocks, a solid block cursor at the prompt. Fixed-width cells are what make columns line up and near-identical glyphs (0/O, 1/l/I) distinguishable. The addressable character grid is the entire layout system, and small honest details (the block caret, hairlines on the pixel grid) make a readout feel like an instrument.

**Directive.** Let a grid be the layout (CSS `Grid` on the `--sf-unit` baseline, not ad hoc flexbox). Use tabular monospace numerals wherever values change or must line up (`DataTable` cells, axis labels, `DigitInput`, `StreamingTerminalText`) so columns scan vertically. Keep the block caret and terminal styling in `CodeEditor` and terminal surfaces. Snap all chrome hairlines (gridlines, ticks, cell edges) to the device-pixel grid while leaving data marks anti-aliased, so the scaffolding stays crisp and the readout reads as a measuring device, not an illustration.

---

## 8. Meta-principles: what the whole lineage shares, mapped to our system

Seven principles run through every cluster. Each maps to a token or component behaviour we already have or should have.

### 1. The grid is the source of order, and it is invisible

From the 606 E-track to the Airbus fixed-screen deck to Gerstner's 58-unit substructure to the VT100 character cell: order comes from a shared modular grid that everything aligns to, felt but never drawn. Structure carries the calm, so arrangement is free to be asymmetric and content-driven.

**Maps to:** `--sf-unit` (1.5rem) as the single source, `--sf-leading-base` and `--sf-line-height-grid` locking block text to the baseline, and the `--sf-space-0..12` ladder only for non-unit fractions. Behaviour: `Grid`, `FieldLayout` and `Pane` derive every gap, height and inset from the unit; separation comes from alignment plus elevation and spacing, never a card border doing what alignment already does.

### 2. Less, but better: restraint as the discipline of subtraction

Rams's mandate, the Leica top plate with no mode dial, iA Writer with almost no settings, the Curta with one crank. Every element justifies its presence; whitespace and chrome are costs that must be earned.

**Maps to:** three type sizes (`--sf-font-size-sm` / `-md` / `-lg`, no xs/xl), one accent (`--sf-color-primary`), one structural border (`--sf-color-border`, with `-strong`/`-subtle` as aliases only). Behaviour: opinionated components with few props over configuration surfaces; the "strip it, ship the strip, add back only what proves necessary" check; density defaults over whitespace-as-luxury.

### 3. Honesty of function: show the mechanism, don't conceal it

The SK4 under glass, the T3 speaker grid exposed, the Pocket Operator's bare board, the Hasselblad film back that shows "12." A control should look like the thing it does, and the system should report its own state without a separate screen.

**Maps to:** the one sanctioned skeuomorphism (`Kbd` keycaps, the `inset 0 1px 0 rgb(255 255 255 / 0.18)` tactile top-edge cue on inputs/switches/buttons); text-entry controls resting one shade below the page (`--sf-color-input-bg`) and lifting to `--sf-color-bg` on focus so an empty field reads as a recessed slot. Behaviour: surface real state and real data (a live count, the actual query, the raw editable value); compound components (`Pane`, `Dialog`, `WindowArray`) as honest modules each showing its own state via a `Chip` `dot` or counter; explicit `Graph` edges over relationships hidden in a config dialog.

### 4. Tactile precision: quality is felt, not decorated, through committed discrete feedback

The Curta's detent, the HP ENTER key, the Leica dial click: these read as high quality because of the decisive click of each control. On screen this is committed, discrete feedback, never springy or looping motion.

**Maps to:** `--sf-ease-snap` (`cubic-bezier(0.34, 1.7, 0.5, 1)`), the one sanctioned overshoot, reserved for a single deliberate interaction paired with `--sf-duration-fast` (120ms) and a single transformed property; the three durations (120/180/240ms) and `--sf-ease-out` / `-in-out`. Behaviour: tabular numerals seating into fixed cells in `DigitInput`; charts redraw and do not animate (no entrance tween, no eased zoom); `prefers-reduced-motion: reduce` with a static fallback everywhere; no bouncy springs on incidental motion.

### 5. Legibility for the glance, engineered for sustained attention

The PFD read under glare, the Porsche cluster read at speed, the Bloomberg screen read for forty hours a week. Fixed positions, high tick-and-numeral contrast, upright never-rotated labels, live values boxed and tabular while context scrolls behind them.

**Maps to:** `--sf-font-mono` with `--sf-font-mono-adjust` (0.52) so mono sits on the sans x-height; `--sf-color-gridline` (quieter than `--sf-color-border`) for chart scaffolding; full-strength `--sf-color-fg` for all body text. Behaviour: charts default to `scaffolding="hover"` with labels measured then thinned or ellipsized, never rotated, first and last always surviving; chrome hairlines snapped to the device-pixel grid while marks stay anti-aliased; live readouts in fixed-width boxes so digits never reflow.

### 6. Colour is a code, not a coat: saturation reserved for meaning

The ET66 yellow "=", the Porsche redline, the Airbus green/cyan/amber/red state channel, the OP-1 knob-to-parameter mapping. A near-monochrome field is what makes the one signal legible. Multi-hue is licensed only as a fixed, learnable channel-to-colour code repeated identically everywhere.

**Maps to:** one accent `--sf-color-primary` (#2563eb light / #3b82f6 dark) for interactive and focused state only; reserved semantics `--sf-color-danger` / `-success` / `-warning`, each meaning something; everything else neutral. Behaviour: a resting control is never primary (blue appears only on focus/hover/checked); exactly two alert tiers (`warning` awareness, `danger` action-required), never a third decorative alert colour; no rainbow tag systems (`Chip` is neutral unless a `tone` makes the colour mean status).

### 7. Longevity over fashion: built to look correct in twenty years

The 606 shelf that still fits a 1960 rail, the 500-series body that ran 56 years, the Porsche layout unchanged across four decades, the VT100 grid still under every terminal, Bloomberg's pixel-for-pixel font. Stability of layout and contract is a feature: it preserves the returning expert's muscle memory.

**Maps to:** `--sf-radius-default` at 2px (the deliberately un-fashionable "hard pencil" corner), system-font `--sf-font-sans`, flat planes with no glassmorphism or gradients on chrome. Behaviour: extend through props and tokens, never fork a component; hold token names and the public `exports` contract stable across versions; absorb new capability into existing layout slots rather than reflowing the surface.

---

## 9. How this should show up in swiss-function

A short checklist of directives, drawn from the sections above, to apply and to cite in review.

1. **Derive every dimension from `--sf-unit`.** Gaps, heights, insets and column tracks are multiples of the unit; separation comes from alignment plus elevation and spacing, never a card border doing alignment's job.
2. **Keep the accent for state.** `--sf-color-primary` marks only what is interactive, focused or committed. A resting control is neutral. Semantic colours (`danger`, `success`, `warning`) mean something or are not used.
3. **Two alert tiers, each paired with the next action.** `warning` for awareness (persists, does not interrupt), `danger` for action-required (stronger, may interrupt), routed through `NonIdealState` or a fixed status strip. No third decorative alert colour, no badges when nothing is wrong.
4. **Box and tabularize live values.** Metric readouts in fixed-width boxes with `--sf-font-mono` tabular numerals so digits never reflow; let the scale or trend move, never the number.
5. **Rank by decision-value.** One dominant tile or readout in the optical centre, equal-weight `sm`-sized satellites around it; refuse to make every KPI the same size.
6. **Split surfaces into an output zone and a control strip.** One clean boundary (a single `Pane.Header` or toolbar); zone dense clusters by weight, size and spacing, not by boxing every group in borders.
7. **Label adjacent, stage then commit.** `Field` and `FieldLayout` put the label beside its control in strict source order; dense inline edits stage in one consistent place (`DataTable` cell editors, a command bar) and commit on an explicit action.
8. **Keep the mono/sans split load-bearing.** `--sf-font-mono` (with `font-size-adjust: var(--sf-font-mono-adjust)`) for data, input, code and axis labels; sans for prose. Body text is always full-strength `--sf-color-fg`, never grey.
9. **Motion is a detent, not a spring.** Reserve `--sf-ease-snap` for a single deliberate interaction; charts redraw rather than animate; every transition has a `prefers-reduced-motion: reduce` static fallback.
10. **Dark mode is lit edges on near-black.** Lean on the `[data-theme="dark"]` hard cast, lightening film and 1px lit inset rim to define controls; reserve highlight brightness for interactive and focused elements. No glassmorphism, no gradients on chrome.
11. **Compose from honest modules with visible seams.** Compound components separated by one `--sf-color-border`, each owning one job and showing its own state (a `Chip` `dot`, a counter). Draw connections explicitly with `Graph` edges rather than hiding them in a config panel.
12. **Schematize node-link and route views.** Fixed angle set, one line weight, one node marker, series identity by colour from a small fixed palette, plus a compact fixed legend.
13. **Treat the toolkit as the Unigrid.** Fixed invariant chrome (tokens plus `Pane.Header`, `Dialog` title, `MenuBar`, `DataTable` header) that looks identical across an app; content varies, chrome does not.
14. **Extend, never fork; hold contracts stable.** New looks arrive as props (`variant`, `size`, `tone`) within the system; token names and the public `exports` contract stay stable so muscle memory and old screens survive the upgrade.