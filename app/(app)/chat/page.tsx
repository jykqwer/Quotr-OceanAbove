"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatComposer } from "@/components/chat-composer";
import { ConversationList } from "@/components/conversation-list";
import { MessageBubble } from "@/components/message-bubble";
import { ListIcon } from "@/components/icons";
import { api } from "@/lib/api/client";
import { useConversationSearch } from "@/lib/hooks/conversation-search";
import { suggestions } from "@/lib/i18n/dictionary";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { Message, Quote, Ticket } from "@/lib/types";

export default function ChatPage() {
  const { t, lang } = useI18n();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("c");

  const list = useConversationSearch(t("chat.errorGeneric"));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<{ text: string } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const skipLoadFor = useRef<string | null>(null);
  const selected = useRef(false);

  // Pick a conversation to open once the first page arrives, preferring ?c=.
  useEffect(() => {
    if (selected.current || list.loading || list.items.length === 0) return;
    selected.current = true;
    const preferred =
      requestedId && list.items.some((item) => item.id === requestedId) ? requestedId : null;
    setActiveId(preferred ?? list.items[0].id);
  }, [list.items, list.loading, requestedId]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    if (skipLoadFor.current === activeId) {
      skipLoadFor.current = null;
      return;
    }

    let alive = true;
    setThreadLoading(true);
    api
      .getConversation(activeId)
      .then(({ messages: loaded }) => {
        if (alive) setMessages(loaded);
      })
      .catch(() => {
        if (alive) setError(t("chat.errorGeneric"));
      })
      .finally(() => {
        if (alive) setThreadLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [activeId, t]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const handleQuoteUpdated = useCallback(
    (quote: Quote, ticket?: Ticket) => {
      setMessages((current) =>
        current.map((message) => (message.quote?.id === quote.id ? { ...message, quote } : message)),
      );
      if (ticket) list.reload();
    },
    [list],
  );

  async function handleSend(text: string) {
    setSending(true);
    setError(null);
    setLive({ text: "" });

    const optimisticId = `pending-${Date.now()}`;
    setMessages((current) => [
      ...current,
      {
        id: optimisticId,
        conversationId: activeId ?? "",
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const result = await api.chat({ conversationId: activeId ?? undefined, text, lang }, {
        onUserMessage: (message) =>
          setMessages((current) => current.map((item) => (item.id === optimisticId ? message : item))),
        onDelta: (chunk) =>
          setLive((current) => (current ? { ...current, text: current.text + chunk } : current)),
      });
      if (result.conversation.id !== activeId) {
        skipLoadFor.current = result.conversation.id;
        setActiveId(result.conversation.id);
      }
      setMessages((current) => [
        ...current.filter((message) => message.id !== optimisticId && message.id !== result.userMessage.id),
        result.userMessage,
        result.assistantMessage,
      ]);
      list.setItems((current) => [
        result.conversation,
        ...current.filter((item) => item.id !== result.conversation.id),
      ]);
    } catch {
      setMessages((current) => current.filter((message) => message.id !== optimisticId));
      setError(t("chat.errorGeneric"));
    } finally {
      setLive(null);
      setSending(false);
    }
  }

  function handleNewConversation() {
    setActiveId(null);
    setMessages([]);
    setError(null);
  }

  const active = list.items.find((item) => item.id === activeId) ?? null;
  const isEmpty = messages.length === 0 && !threadLoading;

  return (
    <div className="grid h-[calc(100dvh-12.5rem)] min-h-[520px] grid-cols-1 gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
      <ConversationList
        conversations={list.items}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNewConversation}
        loading={list.loading}
        search={list.search}
        onSearch={list.setSearch}
        nextCursor={list.nextCursor}
        loadingMore={list.loadingMore}
        onLoadMore={() => void list.loadMore()}
      />

      <section className="flex min-h-0 flex-col border border-white/10 bg-abyss-900">
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-2">
          <span className="col-head hidden shrink-0 sm:inline">{t("chat.title")}</span>
          <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden="true" />
          <h1 className="min-w-0 flex-1 truncate text-[12px] text-slate-200">
            {active?.title ?? t("chat.newChat")}
          </h1>
          <Link href="/conversations" className="btn-quiet shrink-0 lg:hidden" title={t("chat.allConversations")}>
            <ListIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("chat.allConversations")}</span>
          </Link>
        </header>

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {threadLoading && messages.length === 0 ? (
            <p className="py-16 text-center text-[11px] text-slate-600">{t("common.loading")}</p>
          ) : isEmpty ? (
            <div className="mx-auto flex h-full max-w-md flex-col justify-center">
              <p className="col-head">{t("chat.emptyTitle")}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-400">{t("chat.emptyHint")}</p>
              <ul className="mt-5 divide-y divide-white/5 border-y border-white/5">
                {suggestions[lang].map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void handleSend(suggestion)}
                      className="group flex w-full items-center gap-2 py-2 text-left disabled:opacity-40"
                    >
                      <span aria-hidden="true" className="mono text-[10px] text-sunset-500/70">▸</span>
                        <span className="flex-1 text-[12px] text-slate-300 transition-colors group-hover:text-sunset-200">
                        {suggestion}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
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
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="border-t border-white/10 p-3">
          {error && <p className="mb-2 text-[11px] text-rose-300">{error}</p>}
          <ChatComposer
            onSend={handleSend}
            disabled={sending}
            showPlaceholder={messages.length === 0}
          />
        </div>
      </section>
    </div>
  );
}
