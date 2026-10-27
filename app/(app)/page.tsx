"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightIcon, ClockIcon, PlusIcon } from "@/components/icons";
import { ChatComposer } from "@/components/chat-composer";
import { MessageBubble } from "@/components/message-bubble";
import { NetworkMap } from "@/components/network-map";
import { api } from "@/lib/api/client";
import { formatDateTime, formatKm, formatUsd } from "@/lib/format";
import { suggestions } from "@/lib/i18n/dictionary";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { Conversation, Leg, Message, Network, Quote, Ticket, ToolTrace } from "@/lib/types";

export default function HomePage() {
  const { t, lang } = useI18n();

  const [network, setNetwork] = useState<Network | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<{ text: string; tools: ToolTrace[] } | null>(null);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
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
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setSending(true);
      setError(null);
      setLive({ text: "", tools: [] });

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
        const result = await api.chat(
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
            onStep: (trace) =>
              setLive((current) => (current ? { ...current, tools: [...current.tools, trace] } : current)),
            onDelta: (chunk) =>
              setLive((current) => (current ? { ...current, text: current.text + chunk } : current)),
          },
        );
        setConversationId(result.conversation.id);
        setMessages((current) => [
          ...current.filter(
            (message) => message.id !== optimisticId && message.id !== result.userMessage.id,
          ),
          result.userMessage,
          result.assistantMessage,
        ]);
      } catch {
        setMessages((current) => current.filter((message) => message.id !== optimisticId));
        setError(t("chat.errorGeneric"));
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
    void send(`${origin} → ${destination}`);
  }

  function resetThread() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setOrigin("");
    setDestination("");
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
  const latest = conversations[0];
  const recent = tickets.slice(0, 3);
  const pinned = tickets.find((ticket) => ticket.id === pinnedId) ?? null;
  const highlight = hoverLegs ?? pinned?.legs ?? null;
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
                    onMouseEnter={() => setHoverLegs(ticket.legs)}
                    onMouseLeave={() => setHoverLegs(null)}
                    onFocus={() => setHoverLegs(ticket.legs)}
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
                      {formatUsd(ticket.priceUsd)}
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
        <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-sunset-500/[0.07] px-4 py-2">
          <span className="col-head text-sunset-300/80">{t("home.newBooking")}</span>
          <div className="flex items-center gap-2">
            {inThread && (
              <span className="mono hidden max-w-[9rem] truncate text-[9.5px] uppercase tracking-[0.14em] text-slate-600 sm:block">
                {activeConversation?.title ?? ""}
              </span>
            )}
            {inThread ? (
              <button type="button" onClick={resetThread} className="btn-quiet text-sunset-300/80">
                <PlusIcon className="h-3 w-3" />
                {t("home.newSearch")}
              </button>
            ) : (
              <span className="mono text-[9px] uppercase tracking-[0.16em] text-slate-700">NLQ</span>
            )}
          </div>
        </div>

        {inThread ? (
          <>
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
                      {live && live.tools.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-[9.5px] uppercase tracking-[0.16em] text-slate-700">
                            {t("chat.tools")}
                          </span>
                          {live.tools.map((tool, index) => (
                            <span
                              key={`live-${tool.name}-${index}`}
                              className={`mono text-[9.5px] ${tool.ok ? "text-slate-600" : "text-rose-300/80"}`}
                            >
                              {tool.name}
                              <span className="ml-1 text-slate-700">{tool.ms}ms</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-white/10 p-3">
              {error && <p className="mb-2 text-[11px] text-rose-300">{error}</p>}
              <ChatComposer onSend={send} disabled={sending} />
            </div>
          </>
        ) : (
          <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <h1 className="display text-[26px] leading-tight text-slate-50">{t("home.headline")}</h1>
            <p className="mt-2 max-w-[38ch] text-[12px] leading-relaxed text-slate-400">
              {t("home.subline")}
            </p>

            <form onSubmit={handleFormSubmit} className="mt-4 space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="origin" className="col-head mb-1 block">
                    {t("home.fromCity")}
                  </label>
                  <div className="relative">
                    <select
                      id="origin"
                      className="select"
                      value={origin}
                      onChange={(event) => setOrigin(event.target.value)}
                    >
                      <option value="">{t("home.selectCity")}</option>
                      <optgroup label={t("map.statHubs")}>
                        {groups.hubs.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={t("map.statCities")}>
                        {groups.cities.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </optgroup>
                      {groups.unserved.length > 0 && (
                        <optgroup label={t("home.noServiceGroup")}>
                          {groups.unserved.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-500"
                    >
                      ▾
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="destination" className="col-head mb-1 block">
                    {t("home.toCity")}
                  </label>
                  <div className="relative">
                    <select
                      id="destination"
                      className="select"
                      value={destination}
                      onChange={(event) => setDestination(event.target.value)}
                    >
                      <option value="">{t("home.selectCity")}</option>
                      <optgroup label={t("map.statHubs")}>
                        {groups.hubs.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={t("map.statCities")}>
                        {groups.cities.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </optgroup>
                      {groups.unserved.length > 0 && (
                        <optgroup label={t("home.noServiceGroup")}>
                          {groups.unserved.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-500"
                    >
                      ▾
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOrigin(destination);
                    setDestination(origin);
                  }}
                  title={t("home.swap")}
                  aria-label={t("home.swap")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 text-[13px] text-slate-400 transition hover:border-sunset-400/50 hover:text-sunset-300"
                >
                  ⇄
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={!origin || !destination || origin === destination || sending}
                >
                  {t("home.getQuote")}
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[9.5px] uppercase tracking-[0.14em] text-slate-600">
                {t("home.orAsk")}
              </span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <ChatComposer onSend={send} disabled={sending} />
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
