"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightIcon, ChatIcon } from "@/components/icons";
import { api } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { Conversation } from "@/lib/types";

export default function ConversationsPage() {
  const { t, lang } = useI18n();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .listConversations()
      .then(({ conversations: list }) => {
        if (alive) setConversations(list);
      })
      .catch(() => {
        if (alive) setError(t("common.error"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [t]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            {t("conversations.title")}
          </h1>
          <p className="mt-1 text-[13px] text-slate-400">{t("conversations.subtitle")}</p>
        </div>
        <Link href="/chat" className="btn-ghost text-[13px]">
          {t("common.startChat")}
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      </header>

      {loading ? (
        <p className="py-16 text-center text-xs text-slate-500">{t("common.loading")}</p>
      ) : error ? (
        <p className="py-16 text-center text-xs text-rose-300">{error}</p>
      ) : conversations.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-ocean-500/25 bg-ocean-500/10">
            <ChatIcon className="h-5 w-5 text-ocean-300" />
          </span>
          <p className="mt-4 text-sm font-medium text-slate-200">{t("conversations.empty")}</p>
          <p className="mt-1 max-w-sm text-[12.5px] text-slate-500">
            {t("conversations.emptyHint")}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/conversations/${conversation.id}`}
                className="card flex items-center gap-4 px-4 py-3.5 transition hover:border-ocean-400/25 hover:bg-white/[0.06]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-slate-100">
                    {conversation.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-slate-500">
                    {conversation.preview || "—"}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right text-[11px] text-slate-500 sm:block">
                  <p>{t("conversations.messages", { count: conversation.messageCount })}</p>
                  <p className="text-slate-600">
                    {t("conversations.updated", {
                      time: formatDateTime(conversation.updatedAt, lang),
                    })}
                  </p>
                </div>
                <ArrowRightIcon className="h-4 w-4 shrink-0 text-slate-600" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
