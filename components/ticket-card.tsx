"use client";

import { LegTable } from "@/components/leg-timeline";
import { Barcode, IssuedStamp, PerforatedRule } from "@/components/pass-parts";
import { formatDateTime, formatKm, formatUsd } from "@/lib/format";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { Ticket } from "@/lib/types";

export function TicketCard({ ticket }: { ticket: Ticket }) {
  const { t, lang } = useI18n();

  return (
    <article className="overflow-hidden rounded-lg border border-white/15 bg-abyss-900 shadow-pass animate-rise">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-100">
            OA
          </span>
          <span className="col-head">{t("pass.ticketLabel")}</span>
          <span className="mono text-[10px] text-slate-500">{ticket.id}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-sunset-300">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sunset-400" />
          {t("quote.booked")}
        </span>
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 px-4 pb-3.5 pt-3.5">
        <div className="min-w-0">
          <p className="col-head">{t("pass.from")}</p>
          <p className="display mt-1 truncate text-[23px] leading-tight text-slate-50">{ticket.origin}</p>
        </div>
        <div className="pb-1.5 text-[14px] text-sunset-400" aria-hidden="true">
          →
        </div>
        <div className="min-w-0 text-right">
          <p className="col-head">{t("pass.to")}</p>
          <p className="display mt-1 truncate text-[23px] leading-tight text-slate-50">
            {ticket.destination}
          </p>
        </div>
      </div>

      <div className="px-4 pb-3">
        <LegTable legs={ticket.legs} />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pb-3 sm:grid-cols-4">
        <Field label={t("quote.totalDistance")} value={formatKm(ticket.totalDistanceKm)} mono />
        <Field label={t("tickets.passenger")} value={ticket.passenger} />
        <Field label={t("tickets.bookedAtLabel")} value={formatDateTime(ticket.bookedAt, lang)} mono />
        <Field label={t("tickets.ticketId")} value={ticket.id} mono />
      </div>

      <PerforatedRule />

      <div className="paper relative px-4 py-3">
        <IssuedStamp label={t("quote.booked")} />
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="col-head">{t("quote.totalPrice")}</p>
            <p className="mono mt-0.5 text-[27px] leading-none text-sunset-600">
              {formatUsd(ticket.priceUsd)}
            </p>
          </div>
          <span className="hidden sm:block">
            <Barcode value={ticket.id} />
          </span>
        </div>
        <p className="mono mt-2 border-t border-ink-900/15 pt-2 text-[10px] uppercase tracking-[0.14em] text-ink-600">
          {t("quote.ticketFor")}
        </p>
      </div>
    </article>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="col-head">{label}</p>
      <p className={`mt-1 truncate text-[12px] text-slate-300 ${mono ? "mono" : ""}`}>{value}</p>
    </div>
  );
}
