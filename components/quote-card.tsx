"use client";

import { useEffect, useState } from "react";
import { LegTimeline } from "@/components/leg-timeline";
import { ArrowRightIcon, CheckIcon, ClockIcon, TicketIcon } from "@/components/icons";
import { ApiError, api } from "@/lib/api/client";
import { formatKm, formatUsd } from "@/lib/format";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { Quote, QuoteStatus, Ticket } from "@/lib/types";

const STATUS_STYLES: Record<QuoteStatus, string> = {
  pending: "border-sand/35 bg-sand/10 text-sand",
  booked: "border-ocean-400/35 bg-ocean-500/12 text-ocean-200",
  expired: "border-white/10 bg-white/[0.04] text-slate-400",
};

function StatusBadge({ status }: { status: QuoteStatus }) {
  const { t } = useI18n();
  const label =
    status === "pending"
      ? t("quote.pending")
      : status === "booked"
        ? t("quote.booked")
        : t("quote.expired");

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${STATUS_STYLES[status]}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          status === "pending"
            ? "bg-sand animate-pulseSoft"
            : status === "booked"
              ? "bg-ocean-300"
              : "bg-slate-500"
        }`}
      />
      {label}
    </span>
  );
}

export function QuoteCard({
  quote,
  readOnly = false,
  onUpdated,
}: {
  quote: Quote;
  readOnly?: boolean;
  onUpdated?: (quote: Quote, ticket?: Ticket) => void;
}) {
  const { t } = useI18n();
  const [current, setCurrent] = useState(quote);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(quote);
  }, [quote]);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.confirmQuote(current.id, current.conversationId);
      setCurrent(result.quote);
      setTicketId(result.ticket.id);
      onUpdated?.(result.quote, result.ticket);
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.code === "quote_unavailable"
          ? t("quote.confirmError")
          : t("chat.errorGeneric"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-abyss-900/70">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
        <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
          <TicketIcon className="h-3.5 w-3.5 text-ocean-300" />
          {t("quote.title")}
        </span>
        <StatusBadge status={current.status} />
      </div>

      <div className="px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t("quote.route")}</p>
            <p className="mt-1 flex items-center gap-2 text-base font-semibold text-slate-50 sm:text-lg">
              <span className="truncate">{current.origin}</span>
              <ArrowRightIcon className="h-4 w-4 shrink-0 text-ocean-400" />
              <span className="truncate">{current.destination}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              {t("quote.totalPrice")}
            </p>
            <p className="font-mono text-xl font-semibold tabular-nums tracking-tight text-sand sm:text-2xl">
              {formatUsd(current.priceUsd)}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/5 bg-black/25 px-3.5 py-3">
          <LegTimeline legs={current.legs} dense />
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
            <dt className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              {t("quote.totalDistance")}
            </dt>
            <dd className="mt-0.5 font-mono text-[13px] tabular-nums text-slate-200">
              {formatKm(current.totalDistanceKm)}
            </dd>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
            <dt className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              {t("quote.transfersLabel")}
            </dt>
            <dd className="mt-0.5 truncate text-[13px] text-slate-200">
              {current.transfers.length > 0
                ? current.transfers.join(" · ")
                : t("quote.direct")}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{t("quote.priceNote")}</p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
          {current.status === "pending" ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                <ClockIcon />
                {t("quote.expires")}
              </span>
              {readOnly ? null : (
                <button
                  type="button"
                  className="btn-primary px-4 py-2 text-[13px]"
                  onClick={handleConfirm}
                  disabled={busy}
                >
                  {busy ? t("quote.confirming") : t("quote.confirm")}
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          ) : current.status === "booked" ? (
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ocean-200">
              <CheckIcon className="h-3.5 w-3.5" />
              {t("quote.confirmed")}
              {ticketId && <span className="text-slate-500">{t("quote.bookedNote", { id: ticketId })}</span>}
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">{t("quote.expired")}</span>
          )}
        </div>

        {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}
      </div>
    </section>
  );
}
