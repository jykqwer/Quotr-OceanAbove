"use client";

import { LegTimeline } from "@/components/leg-timeline";
import { ArrowRightIcon, TicketIcon } from "@/components/icons";
import { formatDateTime, formatKm, formatUsd } from "@/lib/format";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { Ticket } from "@/lib/types";

export function TicketCard({ ticket }: { ticket: Ticket }) {
  const { t, lang } = useI18n();

  return (
    <article className="card overflow-hidden animate-rise">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3.5 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-slate-50">
            <span className="truncate">{ticket.origin}</span>
            <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-ocean-400" />
            <span className="truncate">{ticket.destination}</span>
          </p>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">
            {ticket.id}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-ocean-400/30 bg-ocean-500/10 px-2.5 py-1 text-[11px] font-medium text-ocean-200">
          <TicketIcon className="h-3.5 w-3.5" />
          {t("quote.booked")}
        </span>
        <span className="font-mono text-lg font-semibold tabular-nums text-sand">
          {formatUsd(ticket.priceUsd)}
        </span>
      </div>

      <div className="grid gap-5 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-white/5 bg-black/20 px-3.5 py-3">
          <LegTimeline legs={ticket.legs} dense />
        </div>

        <dl className="grid grid-cols-2 gap-3 self-start text-xs md:grid-cols-1">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              {t("quote.totalDistance")}
            </dt>
            <dd className="mt-0.5 font-mono text-[13px] tabular-nums text-slate-200">
              {formatKm(ticket.totalDistanceKm)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              {t("tickets.passenger")}
            </dt>
            <dd className="mt-0.5 text-[13px] text-slate-200">{ticket.passenger}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              {t("tickets.ticketId")}
            </dt>
            <dd className="mt-0.5 font-mono text-[13px] text-slate-200">{ticket.id}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              {t("tickets.bookedAtLabel")}
            </dt>
            <dd className="mt-0.5 text-[13px] text-slate-200">
              {formatDateTime(ticket.bookedAt, lang)}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
