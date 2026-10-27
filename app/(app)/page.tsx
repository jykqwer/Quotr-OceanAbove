"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightIcon, ClockIcon, PlusIcon } from "@/components/icons";
import { ChatComposer } from "@/components/chat-composer";
import { MessageBubble } from "@/components/message-bubble";
import { NetworkMap } from "@/components/network-map";
import { CitySelect, type CityGroups } from "@/components/city-select";
import { ApiError, api } from "@/lib/api/client";
import { formatDateTime, formatKm, formatUsd } from "@/lib/format";
import { suggestions } from "@/lib/i18n/dictionary";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { Conversation, Leg, Message, Network, Quote, Ticket } from "@/lib/types";

export default function HomePage() {
  const { t, lang } = useI18n();

  const [network, setNetwork] = useState<Network | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<{ text: string } | null>(null);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [extraLegs, setExtraLegs] = useState<{ destination: string }[]>([]);
  const [passengers, setPassengers] = useState("");
  const [departure, setDeparture] = useState(defaultDepartureInput);
  const [hoverLegs, setHoverLegs] = useState<Leg[] | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getNetwork().then(({ network: data }) => {
        if (alive) setNetwork(data);
      }),
      api.listConversations().then(({ conversations: list }) => {
        if (alive) setConversations(list);
      }),
      api.listTickets().then(({ tickets: list }) => {
        if (alive) setTickets(list);
      }),
    ]).catch(() => {
      if (alive) setError(t("common.error"));
    });
    return () => {
      alive = false;
    };
  }, [t]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, sending]);

  const groups = useMemo(() => {
    if (!network) return { hubs: [] as string[], cities: [] as string[], unserved: [] as string[] };
    const hubs: string[] = [];
    const cities: string[] = [];
    const unserved: string[] = [];
    for (const city of network.cities) {
      if (city.isHub) hubs.push(city.name);
      else if (city.hubs.length > 0) cities.push(city.name);
      else unserved.push(city.name);
    }
    return { hubs, cities, unserved };
  }, [network]);

  const send = useCallback(
    async (
      input:
        | string
        | {
            journeys: { origin?: string; destination: string }[];
            passengers: string[];
            departAt?: string;
          },
    ) => {
      const trimmed =
        typeof input === "string"
          ? input.trim()
          : input.journeys.map((journey) => `${journey.origin} → ${journey.destination}`).join(" · ");
      if (!trimmed) return;
      setSending(true);
      setError(null);
      setLive({ text: "" });

      const optimisticId = `pending-${Date.now()}`;
      setMessages((current) => [
        ...current,
        {
          id: optimisticId,
          conversationId: conversationId ?? "",
          role: "user",
          content: trimmed,
          createdAt: new Date().toISOString(),
        },
      ]);

      try {
        const result =
          typeof input === "string"
            ? await api.chat(
                {
                  conversationId: conversationId ?? undefined,
                  text: trimmed,
                  lang,
                },
                {
                  onUserMessage: (message) =>
                    setMessages((current) =>
                      current.map((item) => (item.id === optimisticId ? message : item)),
                    ),
                  onDelta: (chunk) =>
                    setLive((current) =>
                      current ? { ...current, text: current.text + chunk } : current,
                    ),
                },
              )
            : await api.createQuoteRequest({
                conversationId: conversationId ?? undefined,
                journeys: input.journeys,
                passengers: input.passengers,
                departAt: input.departAt,
                lang,
              });
        setConversationId(result.conversation.id);
        setMessages((current) => [
          ...current.filter(
            (message) => message.id !== optimisticId && message.id !== result.userMessage.id,
          ),
          result.userMessage,
          result.assistantMessage,
        ]);
      } catch (cause) {
        setMessages((current) => current.filter((message) => message.id !== optimisticId));
        setError(
          cause instanceof ApiError && cause.code === "no_route"
            ? t("home.noRoute")
            : t("chat.errorGeneric"),
        );
      } finally {
        setLive(null);
        setSending(false);
      }
    },
    [conversationId, lang, t],
  );

  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!origin || !destination) return;
    if (origin === destination) {
      setError(t("home.sameCity"));
      return;
    }
    const incomplete = extraLegs.some((leg) => !leg.destination);
    if (incomplete) {
      setError(t("home.sameCity"));
      return;
    }
    const departAt = departure ? new Date(departure).toISOString() : undefined;
    if (departAt && Number.isNaN(Date.parse(departAt))) {
      setError(t("home.departureError"));
      return;
    }
    void send({
      // Legs after the first continue from the previous destination.
      journeys: [{ origin, destination }, ...extraLegs.map((leg) => ({ destination: leg.destination }))],
      passengers: passengers
        .split(/[,，、;；]/)
        .map((name) => name.trim())
        .filter(Boolean),
      departAt,
    });
  }

  function updateLeg(index: number, value: string) {
    setExtraLegs((current) =>
      current.map((leg, position) => (position === index ? { destination: value } : leg)),
    );
  }

  function resetThread() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setOrigin("");
    setDestination("");
    setExtraLegs([]);
    setPassengers("");
    setDeparture(defaultDepartureInput());
  }

  const handleQuoteUpdated = useCallback((quote: Quote, ticket?: Ticket) => {
    setMessages((current) =>
      current.map((message) => (message.quote?.id === quote.id ? { ...message, quote } : message)),
    );
    if (ticket) {
      api
        .listTickets()
        .then(({ tickets: list }) => setTickets(list))
        .catch(() => undefined);
    }
  }, []);

  const inThread = messages.length > 0 || sending;
  const minDeparture = localInputValue(new Date());
  const latest = conversations[0];
  const recent = tickets.slice(0, 3);
  const pinned = tickets.find((ticket) => ticket.id === pinnedId) ?? null;
  const highlight = hoverLegs ?? ticketLegs(pinned) ?? threadLegs(messages);
  const activeConversation = conversations.find((item) => item.id === conversationId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:h-[calc(100dvh-9.5rem)] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="order-2 flex min-h-0 flex-col gap-4 lg:order-1">
          <div className="min-h-[320px] flex-1 lg:min-h-0">
            <NetworkMap network={network} highlight={highlight} />
          </div>

        <section className="shrink-0 rounded-lg border border-white/10 bg-abyss-900">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
            <span className="col-head">{t("home.recentTickets")}</span>
            {tickets.length > 0 && (
              <Link href="/tickets" className="btn-quiet">
                {t("home.viewAll")}
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            )}
          </div>

          {recent.length > 0 ? (
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="border-b border-white/5">
                  <th scope="col" className="col-head px-4 py-1.5 text-left">
                    {t("home.colRoute")}
                  </th>
                  <th scope="col" className="col-head hidden w-[108px] px-2 py-1.5 text-left sm:table-cell">
                    {t("home.colTime")}
                  </th>
                  <th scope="col" className="col-head hidden w-[92px] px-2 py-1.5 text-right md:table-cell">
                    {t("quote.totalDistance")}
                  </th>
                  <th scope="col" className="col-head w-[88px] px-4 py-1.5 text-right">
                    {t("quote.totalPrice")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((ticket) => (
                  <tr
                    key={ticket.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={pinnedId === ticket.id}
                    className={`cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.04] focus:bg-white/[0.04] focus:outline-none ${
                      pinnedId === ticket.id ? "bg-sunset-500/[0.08]" : ""
                    }`}
                    onMouseEnter={() => setHoverLegs(ticketLegs(ticket))}
                    onMouseLeave={() => setHoverLegs(null)}
                    onFocus={() => setHoverLegs(ticketLegs(ticket))}
                    onBlur={() => setHoverLegs(null)}
                    onClick={() => setPinnedId((current) => (current === ticket.id ? null : ticket.id))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setPinnedId((current) => (current === ticket.id ? null : ticket.id));
                      }
                    }}
                  >
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-1.5 text-[12px] text-slate-200">
                        <span className="truncate">{ticket.origin}</span>
                        <span aria-hidden="true" className="text-sunset-500">
                          →
                        </span>
                        <span className="truncate">{ticket.destination}</span>
                      </span>
                    </td>
                    <td className="mono hidden px-2 py-2 text-[11px] text-slate-500 sm:table-cell">
                      {formatDateTime(ticket.bookedAt, lang)}
                    </td>
                    <td className="mono hidden px-2 py-2 text-right text-[11px] text-slate-500 md:table-cell">
                      {formatKm(ticket.totalDistanceKm)}
                    </td>
                    <td className="mono px-4 py-2 text-right text-[12px] text-sand">
                      {formatUsd(ticket.totalPriceUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-4 text-[11.5px] text-slate-600">{t("home.noTickets")}</p>
          )}
        </section>
      </div>

      <section className="order-1 flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-abyss-900 shadow-pass lg:order-2">
        {inThread ? (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
              <span className="mono min-w-0 flex-1 truncate text-[9.5px] uppercase tracking-[0.14em] text-slate-600">
                {activeConversation?.title ?? ""}
              </span>
              <button type="button" onClick={resetThread} className="btn-quiet shrink-0 text-sunset-300/80">
                <PlusIcon className="h-3 w-3" />
                {t("home.newSearch")}
              </button>
            </div>
            <div ref={threadRef} className="scroll-slim min-h-[240px] flex-1 overflow-y-auto px-4 py-4">
              <div className="flex flex-col gap-5">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} onQuoteUpdated={handleQuoteUpdated} />
                ))}
                {sending && (
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-4">
                    <div className="flex items-center gap-2 sm:block sm:w-12 sm:shrink-0 sm:pt-0.5 sm:text-right">
                      <p className="text-[9.5px] font-medium uppercase tracking-[0.16em] text-sunset-300">OA</p>
                    </div>
                    <div className="min-w-0 flex-1 border-l border-sunset-500/45 pl-3">
                      {live && live.text.length > 0 ? (
                        <p className="whitespace-pre-line break-words text-[13px] leading-relaxed text-slate-200">
                          {live.text}
                          <span aria-hidden="true" className="ml-0.5 animate-blink text-sunset-400">
                            ▍
                          </span>
                        </p>
                      ) : (
                        <p className="mono text-[10px] uppercase tracking-[0.16em] text-slate-600 animate-blink">
                          {t("chat.thinking")}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-white/10 p-3">
              {error && <p className="mb-2 text-[11px] text-rose-300">{error}</p>}
              <ChatComposer onSend={send} disabled={sending} showPlaceholder={false} />
            </div>
          </>
        ) : (
          <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <h1 className="display text-[26px] leading-tight text-slate-50">{t("home.headline")}</h1>

            <form onSubmit={handleFormSubmit} className="mt-4 space-y-2">
              <div
                className={`grid grid-cols-1 items-end gap-2 ${
                  extraLegs.length > 0 ? "sm:grid-cols-2" : "sm:grid-cols-[1fr_auto_1fr]"
                }`}
              >
                <CitySelect
                  id="origin"
                  label={t("home.fromCity")}
                  value={origin}
                  onChange={setOrigin}
                  groups={groups}
                />
                {extraLegs.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setOrigin(destination);
                      setDestination(origin);
                    }}
                    title={t("home.swap")}
                    aria-label={t("home.swap")}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-[13px] text-slate-400 transition hover:border-sunset-400/50 hover:text-sunset-300"
                  >
                    ⇄
                  </button>
                )}
                <CitySelect
                  id="destination"
                  label={t("home.toCity")}
                  value={destination}
                  onChange={setDestination}
                  groups={groups}
                />
              </div>

              {extraLegs.map((leg, index) => {
                // Every leg departs where the previous one landed.
                const from = index === 0 ? destination : extraLegs[index - 1].destination;
                return (
                  <div key={`leg-${index}`} className="border-l-2 border-sunset-500/30 pl-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="mono min-w-0 truncate text-[9px] uppercase tracking-[0.14em] text-sunset-300/70">
                        {t("home.legN", { n: index + 2 })}
                        <span className="ml-1.5 normal-case tracking-normal text-slate-500">
                          {t("home.legFrom", { city: from || "—" })}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setExtraLegs((current) => current.filter((_, i) => i !== index))}
                        className="shrink-0 text-[10px] text-slate-600 transition-colors hover:text-rose-300"
                      >
                        {t("home.removeLeg")}
                      </button>
                    </div>
                    <div className="mt-1">
                      <CitySelect
                        id={`leg-${index}-destination`}
                        label={t("home.toCity")}
                        value={leg.destination}
                        onChange={(value) => updateLeg(index, value)}
                        groups={groups}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <label htmlFor="passengers" className="col-head mb-1 block">
                    {t("home.passengers")}
                  </label>
                  <input
                    id="passengers"
                    className="field"
                    value={passengers}
                    onChange={(event) => setPassengers(event.target.value)}
                    placeholder={t("home.passengersPlaceholder")}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setExtraLegs((current) => [...current, { destination: "" }])}
                  disabled={
                    extraLegs.length >= 3 ||
                    !destination ||
                    extraLegs.some((leg) => !leg.destination)
                  }
                  title={
                    !destination || extraLegs.some((leg) => !leg.destination)
                      ? t("home.addLegHint")
                      : undefined
                  }
                  className="btn-quiet h-9 justify-center border border-dashed border-white/15 px-3 disabled:opacity-40"
                >
                  + {t("home.addLeg")}
                </button>
              </div>

              <div className="min-w-0">
                <label htmlFor="departure" className="col-head mb-1 block">
                  {t("home.departure")}
                </label>
                <input
                  id="departure"
                  type="datetime-local"
                  className="field mono"
                  value={departure}
                  min={minDeparture}
                  onChange={(event) => setDeparture(event.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={!origin || !destination || origin === destination || sending}
              >
                {t("home.getQuote")}
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[9.5px] uppercase tracking-[0.14em] text-slate-600">
                {t("home.orAsk")}
              </span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <p className="text-[12px] leading-relaxed text-slate-500">{t("home.subline")}</p>
            <div className="mt-2">
              <ChatComposer onSend={send} disabled={sending} />
            </div>
            {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}

            <p className="col-head mt-5">{t("home.quickPrompts")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions[lang].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={sending}
                  onClick={() => void send(suggestion)}
                  className="rounded border border-white/10 px-2 py-1 text-left text-[11px] text-slate-300 transition-colors hover:border-sunset-400/40 hover:bg-sunset-500/10 hover:text-sunset-200 disabled:opacity-40"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {latest && (
              <div className="mt-4 rounded-lg border border-white/10">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
                  <span className="col-head">{t("home.continue")}</span>
                  <ClockIcon className="h-3 w-3 text-slate-700" />
                </div>
                <Link
                  href={`/chat?c=${latest.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] text-slate-200">{latest.title}</p>
                    <p className="mono mt-1 text-[10px] text-slate-600">
                      {formatDateTime(latest.updatedAt, lang)} ·{" "}
                      {t("conversations.messages", { count: latest.messageCount })}
                    </p>
                  </div>
                  <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                </Link>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/** The map highlights one continuous line, so multi-city tickets flatten. */
function ticketLegs(ticket: Ticket | null | undefined): Leg[] | null {
  if (!ticket) return null;
  return ticket.journeys.flatMap((journey) => journey.legs);
}

/** `datetime-local` needs a local "YYYY-MM-DDTHH:mm" value. */
function localInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Default departure: tomorrow 09:00 local. */
function defaultDepartureInput(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return localInputValue(date);
}

/** The route the current thread is discussing, so the map keeps showing it. */
function threadLegs(messages: Message[]): Leg[] | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const quote = messages[index].quote;
    if (quote) return quote.journeys.flatMap((journey) => journey.legs);
  }
  return null;
}
