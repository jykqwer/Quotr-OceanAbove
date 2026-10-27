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
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  loading?: boolean;
}) {
  const { t, lang } = useI18n();

  return (
    <aside className="card hidden min-h-0 flex-col overflow-hidden lg:flex">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
          {t("chat.history")}
        </span>
        <button type="button" onClick={onNew} className="btn-quiet">
          <PlusIcon className="h-3.5 w-3.5" />
          {t("chat.newChat")}
        </button>
      </div>

      <div className="scroll-slim flex-1 space-y-0.5 overflow-y-auto p-2">
        {loading ? (
          <p className="px-2 py-6 text-center text-xs text-slate-500">{t("common.loading")}</p>
        ) : conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-slate-500">{t("chat.noHistory")}</p>
        ) : (
          conversations.map((conversation) => {
            const active = conversation.id === activeId;
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelect(conversation.id)}
                className={`w-full rounded-xl px-2.5 py-2 text-left transition ${
                  active
                    ? "bg-ocean-500/12 ring-1 ring-inset ring-ocean-400/25"
                    : "hover:bg-white/[0.05]"
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={`truncate text-[12.5px] font-medium ${
                      active ? "text-ocean-100" : "text-slate-200"
                    }`}
                  >
                    {conversation.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-600">
                    {formatDateTime(conversation.updatedAt, lang)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                  {conversation.preview || "—"}
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
