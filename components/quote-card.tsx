"use client";

import { useEffect, useState } from "react";
import { JourneyList } from "@/components/journey-list";
import { Barcode, IssuedStamp, PerforatedRule } from "@/components/pass-parts";
import { ApiError, api } from "@/lib/api/client";
import { formatKm, formatUsd } from "@/lib/format";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { Quote, QuoteStatus, Ticket } from "@/lib/types";

const STATUS: Record<QuoteStatus, { dot: string; text: string }> = {
  pending: { dot: "bg-sand", text: "text-sand" },
  booked: { dot: "bg-sunset-400", text: "text-sunset-300" },
  expired: { dot: "bg-slate-600", text: "text-slate-500" },
};

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
      // Step 1: prove the user is looking at this exact snapshot.
      const consent = await api.consentQuote(current.id, current.snapshotHash);
      // Step 2: exchange the single-use nonce for a ticket.
      const result = await api.confirmQuote(current.id, consent.nonce);
      setCurrent(result.quote);
      setTicketId(result.ticket.id);
      onUpdated?.(result.quote, result.ticket);
    } catch (cause) {
      setError(describeConfirmError(cause));
    } finally {
      setBusy(false);
    }
  }

  function describeConfirmError(cause: unknown): string {
    if (!(cause instanceof ApiError)) return t("chat.errorGeneric");
    switch (cause.code) {
      case "expired":
        return t("quote.errExpired");
      case "nonce_expired":
        return t("quote.errNonceExpired");
      case "snapshot_mismatch":
      case "snapshot_changed":
        return t("quote.errSnapshotChanged");
      case "nonce_used":
        return t("quote.errNonceUsed");
      case "not_pending":
        return t("quote.errNotPending");
      default:
        return t("quote.confirmError");
    }
  }

  const status = STATUS[current.status];
  const statusLabel =
    current.status === "pending"
      ? t("quote.pending")
      : current.status === "booked"
        ? t("quote.booked")
        : t("quote.expired");

  return (
    <article className="mt-3 overflow-hidden rounded-lg border border-white/15 bg-abyss-900 shadow-pass">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-100">
            OA
          </span>
          <span className="col-head">{t("pass.quoteLabel")}</span>
        </span>
        <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] ${status.text}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {statusLabel}
        </span>
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 px-4 pb-3.5 pt-3.5">
        <div className="min-w-0">
          <p className="col-head">{t("pass.from")}</p>
          <p className="display mt-1 truncate text-[23px] leading-tight text-slate-50">{current.origin}</p>
        </div>
        <div className="pb-1.5 text-[14px] text-sunset-400" aria-hidden="true">
          →
        </div>
        <div className="min-w-0 text-right">
          <p className="col-head">{t("pass.to")}</p>
          <p className="display mt-1 truncate text-[23px] leading-tight text-slate-50">
            {current.destination}
          </p>
        </div>
      </div>

      <div className="px-4 pb-3">
        <JourneyList journeys={current.journeys} />
      </div>

      <div className="px-4 pb-3">
        <dl className="space-y-2 text-[11.5px]">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <dt className="col-head">{t("quote.passengersLabel")}</dt>
            <dd className="text-slate-300 sm:text-right">
              {current.passengers.join(" · ")}
              <span className="mono ml-1.5 text-slate-500">×{current.passengers.length}</span>
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <dt className="col-head">{t("quote.totalDistance")}</dt>
            <dd className="mono text-slate-300 sm:text-right">{formatKm(current.totalDistanceKm)}</dd>
          </div>
        </dl>
      </div>

      <PerforatedRule />

      <div className="paper relative px-4 py-3">
        {current.status === "booked" && <IssuedStamp label={t("quote.booked")} />}

        <div className="flex items-end justify-between gap-3 pt-1">
          <div className="min-w-0">
            <p className="col-head">
              {current.passengers.length > 1 ? t("quote.orderTotal") : t("quote.totalPrice")}
            </p>
            <p className="mono mt-0.5 text-[27px] leading-none text-sunset-600">
              {formatUsd(current.passengers.length > 1 ? current.totalPriceUsd : current.priceUsd)}
            </p>
            {current.passengers.length > 1 && (
              <p className="mono mt-1 text-[10.5px] text-ink-600">
                {formatUsd(current.priceUsd)} × {current.passengers.length}
              </p>
            )}
          </div>
          <span className="hidden sm:block">
            <Barcode value={current.id} />
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-900/15 pt-2.5">
          {current.status === "pending" ? (
            <>
              <span className="text-[10px] uppercase tracking-[0.14em] text-ink-600">
                {t("quote.expires")}
              </span>
              {readOnly ? null : (
                <button type="button" className="btn-primary" onClick={handleConfirm} disabled={busy}>
                  {busy ? t("quote.confirming") : t("quote.confirm")}
                </button>
              )}
            </>
          ) : current.status === "booked" ? (
            <span className="mono text-[11px] text-ink-700">
              {ticketId ?? t("quote.confirmed")}
            </span>
          ) : (
            <span className="text-[11px] text-ink-600">{t("quote.expired")}</span>
          )}
        </div>

        <p className="mt-1.5 text-[10px] leading-relaxed text-ink-600">{t("quote.priceNote")}</p>
      </div>

      {error && (
        <p className="border-t border-white/10 px-4 py-2 text-[11px] text-rose-300">{error}</p>
      )}
    </article>
  );
}
