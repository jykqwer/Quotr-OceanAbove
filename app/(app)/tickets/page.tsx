"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TicketCard } from "@/components/ticket-card";
import { ArrowRightIcon, TicketIcon } from "@/components/icons";
import { api } from "@/lib/api/client";
import { formatKm, formatUsd } from "@/lib/format";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { Ticket } from "@/lib/types";

export default function TicketsPage() {
  const { t } = useI18n();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .listTickets()
      .then(({ tickets: list }) => {
        if (alive) setTickets(list);
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

  const totalSpend = tickets.reduce((sum, ticket) => sum + ticket.priceUsd, 0);
  const totalDistance = tickets.reduce((sum, ticket) => sum + ticket.totalDistanceKm, 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">{t("tickets.title")}</h1>
          <p className="mt-1 text-[13px] text-slate-400">{t("tickets.subtitle")}</p>
        </div>
        <Link href="/chat" className="btn-ghost text-[13px]">
          {t("tickets.bookAgain")}
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("tickets.totalCount")} value={String(tickets.length)} />
        <Stat label={t("tickets.totalSpend")} value={formatUsd(totalSpend)} accent />
        <Stat label={t("tickets.totalDistance")} value={formatKm(totalDistance)} mono />
      </div>

      {loading ? (
        <p className="py-16 text-center text-xs text-slate-500">{t("common.loading")}</p>
      ) : error ? (
        <p className="py-16 text-center text-xs text-rose-300">{error}</p>
      ) : tickets.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-ocean-500/25 bg-ocean-500/10">
            <TicketIcon className="h-5 w-5 text-ocean-300" />
          </span>
          <p className="mt-4 text-sm font-medium text-slate-200">{t("tickets.empty")}</p>
          <p className="mt-1 max-w-sm text-[12.5px] text-slate-500">{t("tickets.emptyHint")}</p>
          <Link href="/chat" className="btn-primary mt-5 text-[13px]">
            {t("common.startChat")}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
  mono = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="card px-4 py-3.5">
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tracking-tight ${
          accent ? "font-mono text-sand" : mono ? "font-mono text-slate-100" : "text-slate-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
