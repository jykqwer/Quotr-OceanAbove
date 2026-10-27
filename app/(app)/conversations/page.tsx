"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { useConversationSearch } from "@/lib/hooks/conversation-search";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/lang-provider";

export default function ConversationsPage() {
  const { t, lang } = useI18n();
  const list = useConversationSearch(t("common.error"));

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
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
          <span className="col-head">{t("chat.history")}</span>
          <div className="flex items-center gap-3">
            <label htmlFor="archive-search" className="sr-only">
              {t("chat.searchPlaceholder")}
            </label>
            <input
              id="archive-search"
              type="search"
              value={list.search}
              onChange={(event) => list.setSearch(event.target.value)}
              placeholder={t("chat.searchPlaceholder")}
              className="w-[170px] rounded border border-white/10 bg-abyss-950 px-2 py-1 text-[11.5px] text-slate-200 placeholder:text-slate-600 focus:border-ocean-400/60 focus:outline-none focus:ring-2 focus:ring-ocean-500/25 sm:w-[220px]"
            />
            <span className="mono hidden text-[9.5px] uppercase tracking-[0.14em] text-slate-700 sm:block">
              {t("chat.resultCount", { count: list.items.length, total: list.total })}
            </span>
          </div>
        </div>

        {list.loading ? (
          <p className="py-14 text-center text-[11px] text-slate-600">{t("common.loading")}</p>
        ) : list.error ? (
          <p className="py-14 text-center text-[11px] text-rose-300">{list.error}</p>
        ) : list.items.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="col-head">
              {list.term ? t("chat.searchEmpty", { term: list.term }) : t("conversations.empty")}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-[12px] text-slate-500">
              {t("conversations.emptyHint")}
            </p>
          </div>
        ) : (
          <>
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
                {list.items.map((conversation) => (
                  <tr
                    key={conversation.id}
                    className="group border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                  >
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

            {list.nextCursor && (
              <button
                type="button"
                onClick={() => void list.loadMore()}
                disabled={list.loadingMore}
                className="mono w-full border-t border-white/10 px-4 py-2.5 text-[10px] uppercase tracking-[0.14em] text-slate-500 transition-colors hover:bg-white/[0.03] hover:text-slate-300 disabled:opacity-50"
              >
                {list.loadingMore ? t("chat.loadingMore") : t("chat.loadMore")}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
