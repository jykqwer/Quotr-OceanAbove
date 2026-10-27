"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MessageBubble } from "@/components/message-bubble";
import { ArrowRightIcon } from "@/components/icons";
import { api } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { Conversation, Message } from "@/lib/types";

export default function ConversationDetailPage() {
  const { t, lang } = useI18n();
  const params = useParams<{ id: string }>();
  const conversationId = params?.id;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) return;
    let alive = true;
    setLoading(true);
    api
      .getConversation(conversationId)
      .then((result) => {
        if (!alive) return;
        setConversation(result.conversation);
        setMessages(result.messages);
      })
      .catch(() => {
        if (alive) setError(t("conversations.notFound"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [conversationId, t]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Link href="/conversations" className="btn-quiet -ml-2">
        <ArrowRightIcon className="h-3.5 w-3.5 rotate-180" />
        {t("conversations.back")}
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-50">
            {conversation?.title ?? t("conversations.title")}
          </h1>
          {conversation && (
            <p className="mt-1 text-[11.5px] text-slate-500">
              {t("conversations.updated", { time: formatDateTime(conversation.updatedAt, lang) })}
            </p>
          )}
        </div>
        <span className="pill">{t("conversations.readOnly")}</span>
      </header>

      <section className="card px-4 py-5 sm:px-6">
        {loading ? (
          <p className="py-10 text-center text-xs text-slate-500">{t("common.loading")}</p>
        ) : error ? (
          <p className="py-10 text-center text-xs text-rose-300">{error}</p>
        ) : (
          <div className="flex flex-col gap-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} readOnly />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
