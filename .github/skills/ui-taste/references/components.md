# Component anatomy

As implemented. Copy these strings; do not invent parallel ones.

## Board panel (every section is this)

```tsx
<section className="rounded-lg border border-white/10 bg-abyss-900">
  <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
    <span className="col-head">{title}</span>
    <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-700">{meta}</span>
  </div>
  <div className="px-4 py-3.5">{children}</div>
</section>
```

8px radius, one hairline, no shadow, no tint — except the booking panel, which may tint its header warm (`bg-sunset-500/[0.07]`, label `text-sunset-300/80`) because it is the primary action area.

## Board table

```tsx
<table className="w-full table-fixed border-collapse">
  <thead>
    <tr className="border-b border-white/10">
      <th scope="col" className="col-head px-4 py-1.5 text-left">Route</th>
      <th scope="col" className="col-head px-4 py-1.5 text-right">Total</th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
      <td className="px-4 py-2.5 text-[12.5px] text-slate-200">…</td>
      <td className="mono px-4 py-2.5 text-right text-[12px] text-sand">$879.15</td>
    </tr>
  </tbody>
</table>
```

`table-fixed` is mandatory: it stops a long city name from pushing the page sideways at 300px.
Hide secondary columns with `hidden sm:table-cell`, never by shrinking type.

## Board row (sidebar, list)

```tsx
<button className="flex w-full flex-col gap-1 border-l-2 border-transparent px-3 py-2.5 text-left hover:bg-white/[0.03] aria-[current=true]:border-ocean-400">
  <span className="flex items-baseline justify-between gap-2">
    <span className="truncate text-[12px] text-slate-300">{title}</span>
    <span className="mono shrink-0 text-[9.5px] text-slate-600">{time}</span>
  </span>
  <span className="truncate text-[10.5px] text-slate-600">{preview}</span>
</button>
```

Active state is a 2px left rule plus a 4% lift. Coral is reserved for actions, so navigation stays `ocean-400`.

**Search field above the rows**: full width, `bg-abyss-950`, 1px `border-white/10`, 11.5px text, and the same
focus ring as every other control. It sits inside the panel header block, never floating over the list.
When results are empty show one line naming the term (`Nothing matches “bogotá”`), not a generic empty state.
Paging is a single full-width `LOAD OLDER` text button in mono 9.5px at the end of the list — no page numbers,
no arrows, no spinner (the label becomes `Loading…`).

## Boarding pass (quote and ticket) — the most important component

Order is contractual; it satisfies "confirm before booking":

1. **Header** (dark): `OA` · document kind · ticket id, and the status word with a dot.
2. **Route block** (dark): `FROM` / `TO` labels with **serif 23px** city names and a coral `→`.
3. **Segment table** (dark): `#` · `from → to` with `transfer {city}` underneath · distance.
4. **Facts** (dark): transfers, distance, and on tickets passenger / booked at / ticket id.
5. `PerforatedRule` — dashed line with a punched notch at each edge.
6. **Paper stub** (cream): total in coral ink, barcode, validity or ticket id, and the coral button.
7. Optional `IssuedStamp` straddling the perforation.

```tsx
<article className="overflow-hidden rounded-lg border border-white/15 bg-abyss-900 shadow-pass">
  …
  <PerforatedRule />
  <div className="paper relative px-4 py-3">
    {booked && <IssuedStamp label="Issued" />}
    <div className="flex items-end justify-between gap-3 pt-1">
      <div>
        <p className="col-head">Total</p>
        <p className="mono mt-0.5 text-[27px] leading-none text-sunset-600">$789.98</p>
      </div>
      <span className="hidden sm:block"><Barcode value={quote.id} /></span>
    </div>
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-900/15 pt-2.5">
      <span className="text-[10px] uppercase tracking-[0.14em] text-ink-600">Valid 15 min</span>
      <button className="btn-primary">Confirm & book</button>
    </div>
    <p className="mt-1.5 text-[10px] leading-relaxed text-ink-600">{formula}</p>
  </div>
</article>
```

Rules:
- The stub is the **only** light surface in the app. It is what makes the price feel physical.
- The button lives on the paper, not on the dark part — pressing it should feel like tearing the ticket.
- Amounts on paper use `text-sunset-600`; on dark surfaces use `text-sand`.

### Multi-journey and multi-passenger on the same pass

A pass may hold several city pairs and several travellers. Never drop the grouping:

- **Journeys**: `JourneyList` renders one bordered block per city pair, each with its own header
  (`Journey 2` coral micro-label · `origin → destination` · that journey's distance) and its own segment table.
  A single-trip pass renders exactly one naked leg table — it must look unchanged from before.
- **Travellers**: one fact row `Passengers · Ada · Grace Hopper ×2`. Names come from the data verbatim.
- **Money**: the largest number is the **order total** when there is more than one passenger, labelled
  `Order total`, with `$2,870.83 × 2` in mono `10.5px` underline beneath it. With one passenger it stays
  `Total` and shows the fare. Prices are never split into per-leg sums.
- The route block still shows the **trip** endpoints (first departure → last arrival), not the first journey only.

## Perforation, barcode, stamp

```tsx
<div className="relative">
  <div className="border-t border-dashed border-ink-900/30" />
  <span className="absolute -left-[8px] -top-[8px] h-4 w-4 rounded-full border border-white/10 bg-abyss-950" />
  <span className="absolute -right-[8px] -top-[8px] h-4 w-4 rounded-full border border-white/10 bg-abyss-950" />
</div>
```

- Notches use the **page** colour so they read as punched through.
- `Barcode` is deterministic from the document id — it encodes that id and nothing else; bars are `bg-ink-700/80` on paper.
- `IssuedStamp` is centred on the tear line, `animate-stamp`, coral double border, semi-transparent cream fill. It must not overlap the amount or the barcode.

## Transcript message

```tsx
<div className="flex flex-col gap-1.5 sm:flex-row sm:gap-4">
  <div className="flex items-center gap-2 sm:block sm:w-12 sm:shrink-0 sm:text-right">
    <p className="text-[9.5px] uppercase tracking-[0.16em] text-sunset-300">OA</p>
    <p className="mono text-[9.5px] text-slate-700">{time}</p>
  </div>
  <div className="min-w-0 flex-1 border-l border-sunset-500/45 pl-3">…</div>
</div>
```

Assistant uses the warm rule (the brand speaking); the user uses `border-white/15` and a slate label. On phones the gutter collapses above the text.

## Booking desk (home)

Two columns on desktop: the map plus recent tickets on the left, the booking panel on the right. The panel has two modes:

**Idle** — headline, the traditional form (two native `<select>`s grouped as Hubs / Cities, swap between them, departure, a primary "Get quote"), a divider, the natural-language composer, example chips, and the "continue last conversation" card.

The panel has **no title row** — the headline is the only heading. In thread mode a single row carries the conversation title (mono 9.5px, muted) and the "New search" button; there is no persistent "New booking" strip.

**Thread** — the form, the examples and the continue card disappear; the panel becomes a scrollable conversation with the composer pinned at the bottom. Sending from home must never navigate to `/chat`.

Selects use `.select` with a `▾` marker; option groups reuse `map.statHubs` / `map.statCities` so the labels stay bilingual for free.

**Swap** sits *between* origin and destination (`sm:grid-cols-[1fr_auto_1fr]`, aligned to the bottom) and disappears
entirely once a second city pair is added — swapping a multi-city trip is meaningless.

**Departure** uses a native `datetime-local` (`.field mono`) and defaults to tomorrow 09:00. It never changes the
price, so it must never look like a filter — and it carries **no hint line**: "every flight is assumed available"
is our internal model, not something the passenger asked to read.

**The composer's blurb belongs to the composer.** The line explaining the quote-then-ticket promise sits
directly above the input, under the "or ask in your own words" divider — not under the headline. Keep it short
enough to fit one line in the panel (`text-[12px]`, no `max-w-*`, **never `text-balance`**: balancing CJK copy
splits it mid-word, e.g. 航 / 程).

**Multi-city and passengers stay secondary.** Under the city pair sit a `Passengers` text field (11.5px `.field`,
placeholder names, **no hint line** — an empty field quietly means the account holder) and a dashed-border, quiet
`+ Add a leg` button that only grows to 3 extra pairs. Added pairs are indented with a 2px coral left rule,
labelled `Leg 2` in mono 9px, and carry a text-only `Remove` on the right. The idle panel must still read as
"one form", not as a builder.

**A multi-city trip is a chain, and the form must say so.** Journey 2 departs where journey 1 lands, so an extra
pair has **no origin select** — the implied origin lives in the row header instead, as
`Leg 2 · from Split` (mono 9px `text-sunset-300/70`, the city in `text-slate-500`). Never render an empty
"from" control: it invites the user to build an open-jaw itinerary the engine rejects. `+ Add a leg` stays
disabled until the previous destination is chosen, with a one-line reason in the title attribute rather than a
tooltip component.

**`New search` resets everything.** Origin, destination, every extra leg, the passenger list and the departure
time all return to their initial values (departure back to tomorrow 09:00). A partial reset leaves invisible
state behind and the next quote comes out wrong.

**No tool trace anywhere.** The engine records every tool call (`messages.tools_json`, the SSE `step` events),
but the transcript shows only prose and the boarding pass. Do not reintroduce chips, collapsible "thinking" rows
or a debug gutter — this product speaks in sentences, not in function names.

## Composer

```tsx
<form className="flex items-stretch border border-white/15 bg-abyss-950 focus-within:border-ocean-400">
  <textarea className="max-h-32 min-h-[42px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[13px] leading-relaxed outline-none placeholder:text-slate-600" />
  <button className="flex w-12 shrink-0 items-center justify-center border-l border-white/10 bg-sunset-500 text-abyss-950 disabled:bg-transparent disabled:text-slate-600" />
</form>
```

A solid coral send block is the only filled coral on the page besides a pass button. No prompt caret before the
text — a `>` reads as a clickable affordance that does nothing.

**The example sentence is a first-run hint, not a label.** It lives in `placeholder`, so it must be suppressed
once the conversation has content: `showPlaceholder={messages.length === 0}` on `/chat` and always `false` in the
home panel's thread mode. Keep `aria-label` unconditionally set — an empty input still needs an accessible name.

## Stat strip

```tsx
<dl className="grid grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-lg border border-white/10 bg-abyss-900">
  <div className="px-4 py-3">
    <dt className="col-head">Total spend</dt>
    <dd className="mono mt-1.5 text-[16px] text-sand">$2,039.86</dd>
  </div>
</dl>
```

## Empty state

```tsx
<div className="rounded-lg border border-white/10 bg-abyss-900 px-6 py-16 text-center">
  <p className="col-head">{title}</p>
  <p className="mx-auto mt-2 max-w-sm text-[12px] text-slate-500">{hint}</p>
  <Link className="btn-primary mt-5">…</Link>
</div>
```

A label, one sentence, one coral action. No illustration.

## Map panel

- Flat panel; the ground carries the warmth, the panel adds only a faint ember wash at the bottom edge. No sun, no horizon, no scenery inside a data panel.
- **All connections are quadratic curves** (`arcPath()`), including hub links, client connectors and highlighted routes.
- Hubs are **squares**, cities are **dots**, both in pale `lamp` cream — they read as lights. Hover **or** selection turns either one ember and enlarges it; every dot is hoverable, not just hubs.
- **Every city is clickable.** A hub reveals the cities it serves (dashed ember arcs, `animate-flow`); a non-hub reveals the hubs it flies to. Same gesture, symmetric result — never make ordinary cities look inert.
- **Recent-ticket rows drive the map**: hovering a row previews its route as gold arcs; clicking pins it (row stays highlighted, map keeps the route). Endpoint nodes are gold dots, transfers are cream. A preview outranks a pinned city — the row you are pointing at is the most recent intent.
- **The open conversation's route is persistent**: with a quote (pending or booked) in the thread, the map keeps drawing it whenever nothing more specific is showing.
- Counts sit top-right and are **buttons**: hovering `711 Cities` or `40 Hubs` opens a list panel with letter buckets (A–C, D–F, …) plus `All`, two columns, scrollable, no search box. Do not show a hub-link count here — two numbers only.
  Every name in the list is a **button**: clicking it selects that city on the map (same highlight as clicking its dot) and closes the list. A plain `<li>` is a dead end.
  The **Cities** list holds all 711 cities — hubs included, marked with the same cream square the legend uses (spokes are round dots) — so "711 Cities · 40 Hubs" reads as a subset, not two separate sets.
  The panel is wide and the trigger is small, so **it must not close on leaving the trigger**: it stays open while the pointer crosses the gap, closes when the pointer leaves the panel (with a ~220 ms grace), on `Escape`, or on a click outside. Panel background is opaque, never translucent, so the dots cannot read through the names.
- Legend and state sit in the footer row. No "abstract map, not real geography" footnote: it explains our data model, not the passenger's trip.
- **Two highlights never share the map.** A pinned city and an active route are mutually exclusive: while a route is live (a hovered ticket row, or the open conversation's quote) the pinned city's arcs, dimming and tooltip step aside and the footer reads `Showing this route`; the pin returns when the route ends. Clicking a city (or its entry in the list) takes the map back and the route steps aside until the route changes — an explicit click must always outrank a passive route.
- The hover tooltip flips below the point near the top and right-aligns past 55% width so it never clips. Non-hub tooltips name the direct hubs; hub tooltips give route/client counts.

## Ticket list (accordion)

`/tickets` is an **accordion, one open at a time, all collapsed by default**. Collapsed shows: header (id + status),
`FROM / TO`, then one row with the departure datetime and the amount. Expanded adds the journeys, the facts grid,
the perforation and the cream stub.

The reason is physical: a scanner must never read the wrong barcode. So the stub (and therefore `Barcode`) is
**not rendered at all** when collapsed — not hidden with CSS. Toggle is a 24px square with `−` / `+` in mono,
`aria-expanded` + `aria-controls`, and the state line `Only the open ticket shows its barcode…` sits above the list.

## Do / Don't

| Do | Don't |
|---|---|
| `rounded-lg` + 1px border | `rounded-2xl bg-white/5 backdrop-blur-xl shadow-2xl` |
| `col-head` uppercase 10px label | sentence-case label, same size as value |
| `display` serif for city names | serif everywhere, or uppercase city names |
| `mono` on every number | proportional digits, bold prices |
| coral on the one action per screen | coral borders, coral body text |
| cream paper stub for the price | price floating on dark with no object |
| `divide-y` rows | separate card per row |
| one horizon + one page glow | a glow per card |
| city name verbatim | `toUpperCase()` or a translation map |
