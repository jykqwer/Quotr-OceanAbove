"use client";

import { PlusIcon } from "@/components/icons";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { Conversation } from "@/lib/types";

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
  loading = false,
  search = "",
  onSearch,
  nextCursor = null,
  loadingMore = false,
  onLoadMore,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  loading?: boolean;
  search?: string;
  onSearch?: (value: string) => void;
  nextCursor?: string | null;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const { t, lang } = useI18n();

  return (
    <aside className="hidden min-h-0 flex-col border border-white/10 bg-abyss-900 lg:flex">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <span className="col-head">{t("chat.history")}</span>
        <button type="button" onClick={onNew} className="btn-quiet">
          <PlusIcon className="h-3 w-3" />
          {t("common.new")}
        </button>
      </div>

      {onSearch && (
        <div className="border-b border-white/10 px-2 py-2">
          <label htmlFor="conversation-search" className="sr-only">
            {t("chat.searchPlaceholder")}
          </label>
          <input
            id="conversation-search"
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={t("chat.searchPlaceholder")}
            className="w-full rounded border border-white/10 bg-abyss-950 px-2 py-1.5 text-[11.5px] text-slate-200 placeholder:text-slate-600 focus:border-ocean-400/60 focus:outline-none focus:ring-2 focus:ring-ocean-500/25"
          />
        </div>
      )}

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-3 py-6 text-center text-[11px] text-slate-600">{t("common.loading")}</p>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-[11px] text-slate-600">
            {search.trim() ? t("chat.searchEmpty", { term: search.trim() }) : t("chat.noHistory")}
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {conversations.map((conversation) => {
              const active = conversation.id === activeId;
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    aria-current={active ? "true" : undefined}
                    className={`flex w-full flex-col gap-1 border-l-2 px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "border-ocean-400 bg-white/[0.04]"
                        : "border-transparent hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-[12px] ${
                          active ? "text-slate-100" : "text-slate-300"
                        }`}
                      >
                        {conversation.title}
                      </span>
                      <span className="mono shrink-0 text-[9.5px] text-slate-600">
                        {formatDateTime(conversation.updatedAt, lang)}
                      </span>
                    </span>
                    <span className="truncate text-[10.5px] text-slate-600">
                      {conversation.preview || "—"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {nextCursor && onLoadMore && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="mono w-full border-t border-white/5 px-3 py-2 text-[9.5px] uppercase tracking-[0.14em] text-slate-500 transition-colors hover:bg-white/[0.03] hover:text-slate-300 disabled:opacity-50"
          >
            {loadingMore ? t("chat.loadingMore") : t("chat.loadMore")}
          </button>
        )}
      </div>

      <a
        href="/conversations"
        className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-300"
      >
        {t("chat.allConversations")}
        <span aria-hidden="true">→</span>
      </a>
    </aside>
  );
}
