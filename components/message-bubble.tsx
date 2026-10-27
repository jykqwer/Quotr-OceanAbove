"use client";

import { QuoteCard } from "@/components/quote-card";
import { PlaneIcon } from "@/components/icons";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { Message, Quote, Ticket } from "@/lib/types";

export function MessageBubble({
  message,
  readOnly = false,
  onQuoteUpdated,
}: {
  message: Message;
  readOnly?: boolean;
  onQuoteUpdated?: (quote: Quote, ticket?: Ticket) => void;
}) {
  const { t, lang } = useI18n();
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end animate-rise">
        <div className="max-w-[88%] sm:max-w-[72%]">
          <div className="rounded-2xl rounded-br-md bg-ocean-500/15 px-4 py-2.5 text-[13.5px] leading-relaxed text-ocean-50 ring-1 ring-inset ring-ocean-400/20">
            <p className="whitespace-pre-line break-words">{message.content}</p>
          </div>
          <p className="mt-1.5 text-right text-[10px] uppercase tracking-[0.12em] text-slate-600">
            {formatDateTime(message.createdAt, lang)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-rise">
      <div className="mt-0.5 hidden h-8 w-8 shrink-0 place-items-center rounded-xl border border-ocean-500/25 bg-ocean-500/10 sm:grid">
        <PlaneIcon className="h-4 w-4 text-ocean-300" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
          {t("chat.assistant")}
        </div>
        <p className="mt-1 whitespace-pre-line break-words text-[13.5px] leading-relaxed text-slate-200">
          {message.content}
        </p>

        {message.quote && (
          <QuoteCard
            quote={message.quote}
            readOnly={readOnly}
            onUpdated={onQuoteUpdated}
          />
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
          <span>{formatDateTime(message.createdAt, lang)}</span>
          {message.tools?.length ? (
            <span className="inline-flex flex-wrap items-center gap-1">
              <span className="uppercase tracking-[0.12em]">{t("chat.tools")}</span>
              {message.tools.map((tool) => (
                <span
                  key={`${message.id}-${tool.name}`}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-slate-400"
                >
                  <span
                    aria-hidden="true"
                    className={`h-1 w-1 rounded-full ${tool.ok ? "bg-ocean-400" : "bg-rose-400"}`}
                  />
                  {tool.name}
                  <span className="text-slate-600">{tool.ms}ms</span>
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
