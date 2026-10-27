"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightIcon } from "@/components/icons";
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
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-medium tracking-tight text-slate-100">
            {t("conversations.title")}
          </h1>
          <p className="mt-1 text-[12px] text-slate-500">{t("conversations.subtitle")}</p>
        </div>
        <Link href="/chat" className="btn-ghost">
          {t("common.startChat")}
          <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </header>

      <section className="border border-white/10 bg-abyss-900">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <span className="col-head">{t("chat.history")}</span>
          <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-700">
            {t("conversations.readOnly")}
          </span>
        </div>

        {loading ? (
          <p className="py-14 text-center text-[11px] text-slate-600">{t("common.loading")}</p>
        ) : error ? (
          <p className="py-14 text-center text-[11px] text-rose-300">{error}</p>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="col-head">{t("conversations.empty")}</p>
            <p className="mx-auto mt-2 max-w-sm text-[12px] text-slate-500">
              {t("conversations.emptyHint")}
            </p>
          </div>
        ) : (
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th scope="col" className="col-head hidden w-[132px] px-4 py-1.5 text-left sm:table-cell">
                  {t("conversations.updated", { time: "" }).trim()}
                </th>
                <th scope="col" className="col-head px-4 py-1.5 text-left">
                  {t("conversations.colSubject")}
                </th>
                <th scope="col" className="col-head hidden w-20 px-2 py-1.5 text-right sm:table-cell">
                  {t("conversations.messages", { count: "" }).trim()}
                </th>
                <th scope="col" className="w-8 px-2" />
              </tr>
            </thead>
            <tbody>
              {conversations.map((conversation) => (
                <tr key={conversation.id} className="group border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="mono hidden whitespace-nowrap px-4 py-2.5 text-[11px] text-slate-600 sm:table-cell">
                    {formatDateTime(conversation.updatedAt, lang)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/conversations/${conversation.id}`} className="block min-w-0">
                      <span className="block truncate text-[12.5px] text-slate-200 group-hover:text-ocean-200">
                        {conversation.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[10.5px] text-slate-600">
                        {conversation.preview || "—"}
                      </span>
                    </Link>
                  </td>
                  <td className="mono hidden whitespace-nowrap px-2 py-2.5 text-right text-[11px] text-slate-500 sm:table-cell">
                    {conversation.messageCount}
                  </td>
                  <td className="px-2 text-right">
                    <ArrowRightIcon className="h-3.5 w-3.5 text-slate-700 group-hover:text-slate-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
