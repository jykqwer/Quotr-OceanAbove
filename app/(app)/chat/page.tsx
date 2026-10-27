"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatComposer } from "@/components/chat-composer";
import { ConversationList } from "@/components/conversation-list";
import { MessageBubble } from "@/components/message-bubble";
import { ListIcon, PlaneIcon } from "@/components/icons";
import { api } from "@/lib/api/client";
import { suggestions } from "@/lib/i18n/dictionary";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { Conversation, Message, Quote, Ticket } from "@/lib/types";

export default function ChatPage() {
  const { t, lang } = useI18n();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const skipLoadFor = useRef<string | null>(null);

  const loadConversations = useCallback(
    async (selectFirst: boolean) => {
      try {
        const { conversations: list } = await api.listConversations();
        setConversations(list);
        if (selectFirst) setActiveId((current) => current ?? list[0]?.id ?? null);
      } catch {
        setError(t("chat.errorGeneric"));
      } finally {
        setListLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void loadConversations(true);
  }, [loadConversations]);

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
        current.map((message) =>
          message.quote?.id === quote.id ? { ...message, quote } : message,
        ),
      );
      if (ticket) void loadConversations(false);
    },
    [loadConversations],
  );

  async function handleSend(text: string) {
    setSending(true);
    setError(null);

    const optimisticId = `pending-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      conversationId: activeId ?? "",
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);

    try {
      const result = await api.chat({ conversationId: activeId ?? undefined, text, lang });
      if (result.conversation.id !== activeId) {
        skipLoadFor.current = result.conversation.id;
        setActiveId(result.conversation.id);
      }
      setMessages((current) => [
        ...current.filter((message) => message.id !== optimisticId),
        result.userMessage,
        result.assistantMessage,
      ]);
      setConversations((current) => [
        result.conversation,
        ...current.filter((item) => item.id !== result.conversation.id),
      ]);
    } catch {
      setMessages((current) => current.filter((message) => message.id !== optimisticId));
      setError(t("chat.errorGeneric"));
    } finally {
      setSending(false);
    }
  }

  function handleNewConversation() {
    setActiveId(null);
    setMessages([]);
    setError(null);
  }

  const isEmpty = messages.length === 0 && !threadLoading;

  return (
    <div className="grid h-[calc(100dvh-12.5rem)] min-h-[520px] grid-cols-1 gap-4 lg:h-[calc(100dvh-11.5rem)] lg:min-h-[560px] lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[290px_minmax(0,1fr)]">
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNewConversation}
        loading={listLoading}
      />

      <section className="card flex min-h-0 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-slate-100">{t("chat.title")}</h1>
            <p className="mt-0.5 hidden truncate text-[11px] text-slate-500 sm:block">
              {t("chat.subtitle")}
            </p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-sand/25 bg-sand/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-sand sm:inline-flex">
            {t("chat.previewBadge")}
          </span>
          <Link href="/conversations" className="btn-quiet lg:hidden">
            <ListIcon className="h-3.5 w-3.5" />
            {t("chat.history")}
          </Link>
        </header>

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {threadLoading && messages.length === 0 ? (
            <p className="py-16 text-center text-xs text-slate-500">{t("common.loading")}</p>
          ) : isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-ocean-500/25 bg-ocean-500/10">
                <PlaneIcon className="h-5 w-5 text-ocean-300" />
              </span>
              <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-100">
                {t("chat.emptyTitle")}
              </h2>
              <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-slate-400">
                {t("chat.emptyHint")}
              </p>
              <div className="mt-6 flex max-w-lg flex-wrap justify-center gap-2">
                {suggestions[lang].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={sending}
                    onClick={() => void handleSend(suggestion)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-slate-300 transition hover:border-ocean-400/35 hover:bg-ocean-500/10 hover:text-ocean-100 disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onQuoteUpdated={handleQuoteUpdated}
                />
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="h-1.5 w-1.5 animate-pulseSoft rounded-full bg-ocean-400" />
                  {t("chat.thinking")}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-3 py-3 sm:px-4">
          {error && <p className="mb-2 px-1 text-[11px] text-rose-300">{error}</p>}
          <ChatComposer onSend={handleSend} disabled={sending} />
          <p className="mt-2 px-1 text-center text-[10px] text-slate-600">{t("quote.priceNote")}</p>
        </div>
      </section>
    </div>
  );
}
