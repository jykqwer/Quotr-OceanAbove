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
| Component recipes (`panel`, `col-head`, `mono`, `display`, `paper`, `select`, `btn-*`) | [app/globals.css](../../../app/globals.css) |
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

- Micro-label (`col-head`): 9.5–10px, uppercase, `tracking-[0.18em]`, `text-slate-500/600`.
- Body: 12–13px, `leading-relaxed`, `text-slate-300`.
- **City names on a pass use `display` (serif) at 23px** — the single editorial voice in an otherwise monospaced document. Never uppercase, never translated.
- **Every number, code, time, distance and id uses `mono`.**
- Amounts are never grey: gold on dark, coral ink on paper.
- Max ~65 characters per line; never centre a paragraph.

## Light and motion

Warmth is ambient, not an illustration. Do **not** paint a literal sun behind a data chart.

- The ground carries the warmth: `body` has a warm gradient plus one soft ember radial at the bottom edge.
- The map gets only a faint radial wash (`rgba(255,122,69,0.10)`), never artwork.
- **Flight routes are curves.** Draw them with `arcPath()` (quadratic, bowing upward). Straight `<line>` elements are banned on the map.
- **Flow**: a selected hub's links become dashed ember curves with `animate-flow`; a highlighted ticket route is a gold arc with an ember glow underneath.
- **Stamp lands**: `animate-stamp` when a quote becomes a ticket.

Not allowed: gradient card fills, gradient text, glow on cards, `backdrop-blur`, parallax, bounce, shimmer, sun/cloud/horizon illustrations inside panels.

## Copy

- Operational, not promotional: "New booking", "Booking desk", "Fare quote", "Segment", "Confirm & book", "Valid 15 min".
- No exclamation marks, no emoji, no "✨", no "Let's get you flying".
- Errors state what happened and what to do next. Both languages, same key, same meaning.

## Honesty rules

- Show the whole itinerary: every segment, every transfer city, total distance, total price, and the formula.
- States are labelled in words (`Pending` / `Issued` / `Expired`) plus a dot — never colour alone.
- Sample data is labelled on screen.
- Never display a number the domain engine did not produce.
- The map is an abstract coordinate plane; say so.

## Anti-patterns

**Cold look — the failure this project already had, never drift back:** neutral grey-black ground, a single clinical teal accent, 100% flat surfaces with no warmth, tiny grey uppercase type with no large element, no serif, no physical object on screen. That reads as an admin dashboard and kills purchase intent.

**Generic AI gloss:** purple/blue radial glows, glassmorphism, `rounded-2xl + shadow` on every card, emoji icons, gradient text, centred hero + search box, three nested cards, pill nav, skeleton shimmer, "✨ Smart" microcopy.

**Also wrong here:** gradients as card fills, coral used for borders or body copy, gold for non-monetary things, a second warm light source.

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
