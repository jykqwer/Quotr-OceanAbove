---
name: ui-taste
description: "Design and review UI for Ocean Above with the project's visual language: golden-hour palette, departure-board structure, boarding-pass documents, cream paper stubs, monospace numerals. Use when building or restyling pages, components, quote and ticket cards, empty/loading/error states, tables, responsive layouts, bilingual (zh/en) copy, color, typography — or when judging whether a screen looks right, too cold, or AI-generated."
argument-hint: "Which screen or component should I design or review?"
---

# Ocean Above UI Taste

A booking desk at golden hour, not a control room.

Three reference objects drive every decision:

- **Structure is a departure board**: warm near-black ground, 1px hairlines, uppercase micro-labels, monospace numbers, dense scannable rows.
- **Documents are boarding passes**: perforated rule, serif FROM/TO block, segment table, then a **cream paper stub** carrying the price, barcode and the button you press.
- **Routes are arcs**: every flight connection on the map is a curve, never a straight line.

The whole page must feel warm. A cold grey-black page with a warm button bolted on is a failure — warmth comes from the ground colour, the text colour, the paper and the copper routes, not from one accent.

## When to Use

- Creating or restyling any page or component.
- Reviewing a screenshot, a diff, or "does this look right?".
- Fixing responsive behaviour, long copy, or bilingual layout.
- Designing quote, ticket, empty, loading, and error states.
- Choosing colour, type, spacing, radius, motion.

## Source of truth

| Concern | File |
|---|---|
| Component recipes (`panel`, `col-head`, `mono`, `display`, `paper`, `field`, `btn-*`) | [app/globals.css](../../../app/globals.css) |
| Tokens (abyss, warm slate, ocean/copper, sunset, sand, lamp, cream, ink), fonts, motion | [tailwind.config.ts](../../../tailwind.config.ts) |
| Anatomy of pass, table, board row, empty state | [./references/components.md](./references/components.md) |
| All copy, both languages | [lib/i18n/dictionary.ts](../../../lib/i18n/dictionary.ts) |
| Number formatting | [lib/format.ts](../../../lib/format.ts) |

Read the nearest existing component before inventing anything.

## Palette — one job per colour

| Token | Job | Never |
|---|---|---|
| `abyss-950/900/850` | page, panel, row lift — **warm** near-black (R > G > B) | neutral grey, cool blue-black |
| `slate-*` | **remapped to warm stone**; every text class goes warm automatically | the stock cool slate |
| `ocean-300/400` (copper) | routes on the map, links, secondary accents | the primary action |
| `sunset-500` | **the one thing to click** — primary button, active tab, send arrow | borders, body copy, decoration |
| `lamp-300/400` (pale cream) | cities and hubs on the map — they read as lights | text |
| `sand` (#ffc46b) | money **on dark**, and the highlighted route on the map | anything non-monetary |
| `sunset-600` | money **printed on cream** | on dark surfaces |
| `cream-100` + `ink-*` | the paper stub on every pass | full-page backgrounds |

Balance rule: **warm ground, one ember action.** If the page reads cold at arm's length, the ground is wrong — not the button.

## Geometry

- Radius: **0** for tables, rows, cells; **8px** for panels, buttons, fields, chips. The stub inherits the card radius. Perforation notches are the only true circles.
- Structure comes from rules (`border-t border-white/10`, `divide-y divide-white/5`), not shadows. `shadow-ember` is allowed **only** under a coral button.
- Vertical rhythm 4 / 8 / 12 / 16 / 20. Panel header `px-4 py-2`; body `px-4 py-3.5`.
- Tables are `w-full table-fixed` so narrowing wraps text instead of pushing the page sideways.

## Typography

- Micro-label (`col-head`): 12.5px, uppercase, `tracking-[0.18em]`, `text-slate-500/600`. **Never go below 11px** — 9px monospace labels proved unreadable on a laptop, and the whole scale has since been raised twice (10.5 → 11.5 → 12.5); do not introduce anything smaller again.
- Body: 14–15px, `leading-relaxed`, `text-slate-300`. Fields 16px, buttons 15px.
- Table cells that hold a number, date or price are `whitespace-nowrap`: a wrapped `11,229.09` / `km` reads as two different facts. Numeric columns are sized for the longest English string, not the Chinese one — "Oct 27, 10:06 PM" is the widest thing a date cell must hold.
- **City names on a pass use `display` (serif) at 25px** — the single editorial voice in an otherwise monospaced document. Never uppercase, never translated.
- Page titles 22px; the booking-desk headline 28px; the quote total 29px. Those display sizes rise 2px per type step (everything ≤19px rises 1px) so the hierarchy gaps never shrink.
- **Every number, code, time, distance and id uses `mono`.**
- Amounts are never grey: gold on dark, coral ink on paper.
- Max ~65 characters per line; never centre a paragraph.

## Light and motion

Warmth is ambient, not an illustration. Do **not** paint a literal sun behind a data chart.

- The ground carries the warmth: `body` has a warm gradient plus one soft ember radial at the bottom edge.
- The map gets only a faint radial wash (`rgba(255,122,69,0.10)`), never artwork.
- **Flight routes are curves.** Draw them with `arcPath()` (quadratic, bowing upward). Straight `<line>` elements are banned on the map.
- **Flow**: a selected hub's links become dashed ember curves with `animate-flow`; a highlighted ticket route is a gold arc with an ember glow underneath.
- **A selection breathes.** The chosen city wears a four-point sparkle (`animate-star`) inside one expanding ring (`animate-ripple`); the chosen route carries a comet with a long head and a short tail (`animate-flow`, negative `stroke-dashoffset`) so it visibly travels from origin to destination. That is the only place a pulse is allowed, and it must die under `prefers-reduced-motion`. Sizes are in map units — the viewBox is 21 040 wide and drawn at ~0.02 scale, so anything below ~60 units does not exist on screen.
- **Stamp lands**: `animate-stamp` when a quote becomes a ticket.

Not allowed: gradient card fills, gradient text, glow on cards, `backdrop-blur`, parallax, bounce, shimmer, sun/cloud/horizon illustrations inside panels.

## Copy

- Operational, not promotional: "New booking", "Booking desk", "Fare quote", "Segment", "Confirm & book", "Valid 15 min".
- No exclamation marks, no emoji, no "✨", no "Let's get you flying".
- **No AI flavour.** One short sentence beats a compound marketing line. No "Tell X it will…", no "Welcome aboard", no customer-service filler like "Review the itinerary below and confirm to book" — state the rule once and stop. Example prompts must read like things a person would actually type ("What's the cheapest way from Chengdu to Split?"), never arrow-notation keywords ("Chengdu → Split, cheapest").
- Errors state what happened and what to do next. Both languages, same key, same meaning.
- **Never narrate the machine.** The screen carries the trip and the price. It does not carry build badges ("preview · sample data"), database names, `read-only`, the pricing formula, our modelling assumptions ("every flight is assumed available"), counts of cities we do not serve, or an explanation of why a control behaves as it does (the barcode accordion, the empty passenger field). Those go in README / PLAN. If a line only makes sense to the person who wrote the code, delete it.

## Honesty rules

- Show the whole itinerary: every segment, every transfer city, total distance, total price — and every leg's distance must add up to the total on screen, so the reader can check it without being told the formula.
- States are labelled in words (`Pending` / `Issued` / `Expired`) plus a dot — never colour alone.
- Never display a number the domain engine did not produce.
- The map is an abstract coordinate plane. That is a fact for the docs and for anyone reading the data model — not a footnote under the chart. Draw it honestly: hub-only transfers, curves, real database coordinates.

## Anti-patterns

**Cold look — the failure this project already had, never drift back:** neutral grey-black ground, a single clinical teal accent, 100% flat surfaces with no warmth, tiny grey uppercase type with no large element, no serif, no physical object on screen. That reads as an admin dashboard and kills purchase intent.

**Generic AI gloss:** purple/blue radial glows, glassmorphism, `rounded-2xl + shadow` on every card, emoji icons, gradient text, centred hero + search box, three nested cards, pill nav, skeleton shimmer, "✨ Smart" microcopy.

**Also wrong here:** gradients as card fills, coral used for borders or body copy, gold for non-monetary things, a second warm light source.

**Platform widgets in a dark product.** A native `<select>` dropdown or an `input[type=datetime-local]` calendar arrives in the browser's own chrome — blue highlights, system font, its own radii — and no amount of styling on the closed control fixes the open state. If a control opens a surface, build that surface from the tokens (`role="listbox"` / `role="dialog"`, `bg-abyss-950`, `border-white/15`, coral selection). Anchor it `fixed` through `useAnchoredPanel` when it lives inside a scrolling panel, or it will be clipped by `overflow-y-auto`.

## Procedure

1. **Read** the tokens and the nearest component; reuse `panel` / `col-head` / `mono` / `display` / `paper` / `divide-y`.
2. **List states** first: default, empty, loading, error, long city name, 300px, longest zh and en string.
3. **Build**; add every new string to `lib/i18n/dictionary.ts` in both languages in the same change.
4. **Verify**: `npm run typecheck`, then each page at 300 / 900 / 1440 with `document.documentElement.scrollWidth <= clientWidth`, toggle 中⇄EN, and reconcile numbers by hand (legs sum to the total, total × 0.13 equals the price).
5. **Look** at a screenshot: is there warm light? is the coral button the only loud thing? would you want to press it?
6. **Report** what changed visually, not just which files changed.

## Review checklist

- [ ] The ground is warm, not neutral grey or cool blue-black
- [ ] One ember action, no more
- [ ] Price is the largest number: gold on dark, coral ink on paper
- [ ] Every map connection is a curve, never a straight line
- [ ] The pass ends in a cream stub with the total, barcode and button
- [ ] City names in serif, verbatim from the database
- [ ] Numbers, times, ids and distances all monospace
- [ ] Status readable as a word, not just a colour
- [ ] No gradient card fills, no blur, no glow on cards, no sun illustrations
- [ ] Radius is 0 (tables) or 8px (controls/panels) only
- [ ] No horizontal scroll at 300px on any page
- [ ] Both languages present, nothing important truncated
- [ ] Displayed numbers reconcile by hand
