"use client";

import { QuoteCard } from "@/components/quote-card";
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

  return (
    <div className="flex flex-col gap-1.5 animate-rise sm:flex-row sm:gap-4">
      <div className="flex items-center gap-2 sm:block sm:w-12 sm:shrink-0 sm:pt-0.5 sm:text-right">
        <p
          className={`text-[9.5px] font-medium uppercase tracking-[0.16em] ${
            isUser ? "text-slate-500" : "text-sunset-300"
          }`}
        >
          {isUser ? t("chat.you") : "OA"}
        </p>
        <p className="mono text-[9.5px] text-slate-700 sm:mt-0.5">
          {formatDateTime(message.createdAt, lang)}
        </p>
      </div>

      <div
        className={`min-w-0 flex-1 ${
          isUser ? "border-l border-white/15 pl-3" : "border-l border-sunset-500/45 pl-3"
        }`}
      >
        <p
          className={`whitespace-pre-line break-words text-[13px] leading-relaxed ${
            isUser ? "text-slate-300" : "text-slate-200"
          }`}
        >
          {message.content}
        </p>

        {message.quote && (
          <QuoteCard quote={message.quote} readOnly={readOnly} onUpdated={onQuoteUpdated} />
        )}

        {message.tools?.length ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[9.5px] uppercase tracking-[0.16em] text-slate-700">
              {t("chat.tools")}
            </span>
            {message.tools.map((tool, index) => (
              <span key={`${message.id}-${tool.name}-${index}`} className="mono text-[9.5px] text-slate-600">
                {tool.name}
                <span className="ml-1 text-slate-700">{tool.ms}ms</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
