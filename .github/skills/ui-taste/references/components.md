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

**Idle** — headline, the traditional form (two native `<select>`s grouped as Hubs / Cities, a swap button, a primary "Get quote"), a divider, the natural-language composer, example chips, and the "continue last conversation" card.

**Thread** — the form, the examples and the continue card disappear; the panel becomes a scrollable conversation with the composer pinned at the bottom and a "New search" button in the header. Sending from home must never navigate to `/chat`.

Selects use `.select` with a `▾` marker; option groups reuse `map.statHubs` / `map.statCities` so the labels stay bilingual for free.

## Composer

```tsx
<form className="flex items-stretch rounded-lg border border-white/15 bg-abyss-950 focus-within:border-sunset-400">
  <span className="mono hidden border-r border-white/10 px-2.5 pt-3 text-sunset-400/70 sm:block">&gt;</span>
  <textarea className="max-h-32 min-h-[42px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[13px] outline-none" />
  <button className="flex w-12 items-center justify-center border-l border-white/10 bg-sunset-500 text-abyss-950" />
</form>
```

A prompt caret plus a solid coral send block. That block is the only filled coral on the page besides a pass button.

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
- Hubs are **squares**, cities are **dots**, both in pale `lamp` cream — they read as lights. The selected hub turns ember.
- Selecting a hub turns its links into dashed ember curves with `animate-flow` and curves its client cities in.
- **Recent-ticket rows drive the map**: hovering a row previews its route as gold arcs; clicking pins it (row stays highlighted, map keeps the route). Endpoint nodes are gold dots, transfers are cream.
- Legend and counts sit in the footer row; the honesty note gets its own line.
- The hover tooltip flips below the point near the top and right-aligns past 55% width so it never clips.

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
