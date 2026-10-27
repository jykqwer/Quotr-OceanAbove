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
        <ArrowRightIcon className="h-3 w-3 rotate-180" />
        {t("conversations.back")}
      </Link>

      <section className="border border-white/10 bg-abyss-900">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="col-head shrink-0">{t("conversations.readOnly")}</span>
            <span className="h-3 w-px bg-white/10" aria-hidden="true" />
            <h1 className="min-w-0 truncate text-[12px] text-slate-200">
              {conversation?.title ?? t("conversations.title")}
            </h1>
          </div>
          {conversation && (
            <span className="mono text-[10px] text-slate-600">
              {formatDateTime(conversation.updatedAt, lang)}
            </span>
          )}
        </header>

        <div className="px-4 py-4 sm:px-5">
          {loading ? (
            <p className="py-12 text-center text-[11px] text-slate-600">{t("common.loading")}</p>
          ) : error ? (
            <p className="py-12 text-center text-[11px] text-rose-300">{error}</p>
          ) : (
            <div className="flex flex-col gap-5">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} readOnly />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
