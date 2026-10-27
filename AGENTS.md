# Project Guidelines

Ocean Above — a natural-language flight booking web app. Next.js 15 (App Router) + TypeScript + Tailwind 3, SQLite for state, OpenAI-compatible LLM (DeepSeek) for the agent.
Read [README.md](./README.md) for setup and [docs/PLAN.zh-CN.md](./docs/PLAN.zh-CN.md) for the full design and roadmap before non-trivial changes.

## Build and Test

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm test           # lib/domain (Python-oracle parity) + lib/store (booking-gate) tests
npm run build      # must pass before calling work done
```

- Node 20+; dependencies are already installed (`npm install` only after manifest changes).
- `lib/domain/**` is pure and unit-tested. After touching route/pricing code or `locations.db`, run `npm run verify:data` (regenerates `scripts/oracle.py` fixtures and diffs both implementations). Never hand-edit `lib/domain/__fixtures__/golden.json`.

## Architecture

```
app/            routes + route handlers (home, login, (app)/chat, (app)/tickets, (app)/conversations, api/*)
components/     shared UI (app-shell, network-map, quote-card, leg-timeline, message-bubble, ...)
lib/types.ts    domain types shared by client and server
lib/format.ts   the only place numbers are formatted
lib/i18n/       zh/en dictionaries + language context
lib/api/        typed client used by all pages
lib/db/         read-only accessors for locations.db (validates the dataset on load)
lib/domain/     pure graph + route + pricing + itinerary engine — the single source of truth for numbers
lib/agent/      LLM 工具循环：llm(流式客户端) / tools / loop / guard / reply(确定性兜底)
lib/store/      SQLite repositories, snapshot hashing, and the one-time-nonce booking gate
lib/auth/       scrypt passwords, HMAC-signed session cookie, login rate limiting
lib/db/app.ts   app database connection + schema (separate file from locations.db)
data/app.db     runtime state (users, conversations, quotes, tickets) — gitignored
locations.db    read-only dataset: cities, coordinates, hub links
```

Current phase: routes, distances and prices are real (`lib/domain`, cross-checked against an independent Python oracle). State persists to `data/app.db`; `lib/store/` stores and enforces invariants but must not compute distances or prices. Booking is a two-step server-side gate (`consent` → one-time nonce → `confirm`); `lib/store/confirmQuote` is the only code that inserts a ticket. The home network map renders the raw `locations.db` coordinates, which are an abstract plane, not geography — keep it labeled as such. Keep `/api/*` request/response shapes stable.

## Non-negotiable domain rules

These come from the product spec and are easy to break; verify them in any change that touches routes or pricing.

1. **`locations.db` is the only source of truth.** Open it read-only, never mutate it, never hardcode cities, hubs, coordinates or routes in code or fixtures beyond what already exists.
2. **`hub_links` stores each hub pair once.** Treat every row as an undirected edge; do not assume both directions exist.
3. **Transfers happen only at hubs.** A valid route is `origin → hub → … → hub → destination`. A shortest path over the full city graph is wrong: it lets passengers change planes in non-hub cities (about 35% of sampled pairs get a wrong, cheaper price). Use the hub-subgraph APSP plus endpoint enumeration. `lib/domain` implements this; do not reimplement graph or pricing math anywhere else, and never inside `lib/store/` or a component.
4. **Rounding is part of the contract.** Round each leg to 2 dp, `totalDistanceKm` = sum of those rounded legs, `priceUsd = round(total × 0.13, 2)`. Never sum per-leg prices. Displayed numbers must reconcile by hand. Optimality is decided on **unrounded** distances so rounding never flips a candidate; `lib/domain/pricing.ts` is the only place these rules live.
   - **Multi-journey and multi-passenger extend the same contract.** `totalDistanceKm` is the sum of the journeys' totals; `priceUsd` is the **per-passenger** fare, rounded once from that total (never the sum of separately rounded journey fares); `totalPriceUsd = round(priceUsd × passengers.length)`. `lib/domain/itinerary.ts` owns this and `verifyItinerary` re-asserts it.
   - **Departure time is data, not money.** `departAt` is required on an itinerary, defaults to tomorrow 09:00, rejects unparseable or past values, and **never** changes a distance or a price. Every departure is assumed available — never model a schedule, a sold-out state, or a time-based surcharge. Because it is in the snapshot, changing it changes the confirmation hash.
5. **The model never does arithmetic.** The LLM resolves intent and calls tools; every distance, price and route shown to the user must come from the domain engine/tool result and be rendered verbatim. This is enforced, not just prompted: tool results carry pre-formatted display strings, and `lib/agent/guard.ts` rejects any numeric token the engine did not produce (`number_guard`) as well as any affirmative booking claim (`claim_guard`). A rejected message falls back to the deterministic summary in `lib/agent/reply.ts`; never weaken or bypass those guards.
6. **Nothing is booked without explicit confirmation.** Quote (immutable snapshot) → user confirmation in the UI (one-time nonce bound to the snapshot hash) → ticket. Do not add a "book directly" tool or path that bypasses this, and do not treat conversational "yes" as sufficient. The agent has no booking tool at all; `lib/store/confirmQuote` is the only writer of tickets, and the assistant may never claim one was issued.
7. **Never guess a city.** Ambiguous names (`San Jose` / `San José`, `Santiago` family) must return candidates and ask. A city with no service must be reported with the nearest served city — never silently substituted.
8. **A multi-journey trip is a chain.** Journey N+1 departs from journey N's destination, so `journeys[i].origin` may be omitted and is filled in from the previous journey; only the first journey has a real origin. A supplied origin that does not continue the chain is rejected (`broken_chain`) in `lib/domain/itinerary.ts` and re-checked by `verifyItinerary`. Open-jaw itineraries are out of scope — do not "fix" this into two independent trips.
9. Tie-breaks must stay deterministic: lowest distance → fewest legs → lexicographic city sequence.

## Conventions

- **i18n**: every user-facing string lives in [lib/i18n/dictionary.ts](./lib/i18n/dictionary.ts) under a flat key, with both `en` and `zh` present (the `Dictionary` type enforces parity). Use `useI18n().t(key, vars)`. **City names are never translated** — always render the database value.
- **Numbers**: use `formatUsd` / `formatKm` / `formatDateTime` (and `formatMonthYear` / `formatDayLabel` / `formatClock` / `weekdayLabels` for calendar copy) from [lib/format.ts](./lib/format.ts). Do not call `Intl` or `toFixed` in components.
- **Server vs client**: `lib/store/**`, `lib/auth/**`, `lib/db/app.ts` and anything touching `node:crypto` or `node:fs` are server-only; never import them from a `"use client"` file. `lib/auth/session.ts` imports `next/headers` for the same reason.
- **Styling**: warm golden-hour palette — `panel` (`rounded-lg border border-white/10 bg-abyss-900`), warm `slate` remapped in the Tailwind config, `col-head` micro-labels, `mono` for every number, `display` serif for city names on passes, `paper` for the cream ticket stub. Ember (`sunset-500`) is the one action per screen; gold (`sand`) is money on dark. Map connections are always quadratic curves (`arcPath` in [components/network-map.tsx](./components/network-map.tsx)), never straight lines. The ground must stay warm — no neutral or cool grey-black. Tokens live in [tailwind.config.ts](./tailwind.config.ts).
- **No native pickers**: a `<select>` menu or an `input[type=datetime-local]` calendar is drawn by the browser and cannot be themed, so both are replaced by token-built popovers ([components/city-select.tsx](./components/city-select.tsx), [components/departure-picker.tsx](./components/departure-picker.tsx)). A popover inside a scrolling panel must position itself `fixed` via [lib/hooks/use-anchored-panel.ts](./lib/hooks/use-anchored-panel.ts) — `absolute` gets clipped by `overflow-y-auto`.
- **No implementation notes on screen**: no build badges, database names, `read-only`, pricing formulas or modelling assumptions. The barcode carries its own caption; the accordion needs no explanation. Those belong in README / PLAN.
- **Types**: shared shapes belong in [lib/types.ts](./lib/types.ts); the API client in [lib/api/client.ts](./lib/api/client.ts) is the only place pages call `fetch`.
- **UI work**: follow the project's design language via the `ui-taste` skill ([.github/skills/ui-taste/SKILL.md](./.github/skills/ui-taste/SKILL.md)) — palette discipline, number display, bilingual layout, and the pre-flight checklist.
- **Map interactions**: every city dot is interactive, not just hubs (non-hubs reveal the hubs they fly to). Hover highlights the dot itself; the highlight for the open conversation's quote is persistent and must not be cleared by hovering other tickets. Keep the same rule when adding layers: `hover → pinned ticket → thread quote`.
- **Client data flow**: pages fetch on mount with an `alive` guard, keep list state locally, and pass quote updates upward instead of refetching the whole thread. Chat goes through `api.chat(payload, hooks)`: with hooks it consumes the SSE stream (`onStep` / `onDelta`), without hooks it uses the plain JSON endpoint, and it falls back to JSON if the stream cannot be opened.
- **Conversation lists**: both the sidebar and `/conversations` use [lib/hooks/conversation-search.ts](./lib/hooks/conversation-search.ts) — debounced term, cursor paging, stale-response guard. Do not add a second ad-hoc list fetch; the endpoint is `GET /api/conversations?q=&cursor=&limit=` and it is the only place search is implemented.
- **Structured vs free text**: the home form posts to `POST /api/quotes` (deterministic, no model); only free-form chat goes through the agent. Keep both on the same domain path so pricing cannot diverge.
- **Agent changes**: touch `lib/agent/tools.ts` before `loop.ts`. A new tool must return display-ready strings (via `formatKm` / `formatUsd`) so the numeric guard can accept them, and must never accept numbers from the model. Passenger names and city pairs may come from the model (they are data entry, not arithmetic). Keep `MAX_STEPS` bounded and keep the deterministic fallback reachable.

## Security

- Never commit secrets. `.env.local` is gitignored; only `.env.example` is tracked. The LLM key is read from `LLM_API_KEY` at runtime.
- Every authenticated request must derive the user from the server-side session cookie and filter by that `userId`; never trust a user id from the client.
- Passwords use `scrypt` with a per-user salt ([lib/auth/password.ts](./lib/auth/password.ts)); never store or compare a plain or fast digest. Sessions are HMAC-signed cookies whose rows must exist in the `sessions` table.
- A ticket may only be inserted by `confirmQuote` after a valid, unused, unexpired nonce minted from the exact `snapshotHash` the client rendered. Do not add an alternative write path, an idempotent "already booked" shortcut, or an admin bypass.
- Never log or expose API keys, session secrets, password hashes, or nonces. `data/` (db + generated session secret) stays gitignored.
- User text is untrusted input to the model. Keep the injection clause in `SYSTEM_PROMPT`, and never let user text reach a tool that could mutate state without the nonce chain.

## Deliverables to keep current

- Update [README.md](./README.md) when setup, routes or capabilities change; update [docs/PLAN.zh-CN.md](./docs/PLAN.zh-CN.md) when design decisions change.
- Raw agent sessions belong in `prompt history/` and must be scrubbed of API keys before delivery.
