"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TicketCard } from "@/components/ticket-card";
import { ArrowRightIcon } from "@/components/icons";
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

  const totalSpend = tickets.reduce((sum, ticket) => sum + ticket.totalPriceUsd, 0);
  const totalDistance = tickets.reduce((sum, ticket) => sum + ticket.totalDistanceKm, 0);
  const totalPassengers = tickets.reduce((sum, ticket) => sum + ticket.passengers.length, 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-medium tracking-tight text-slate-100">{t("tickets.title")}</h1>
          <p className="mt-1 text-[12px] text-slate-500">{t("tickets.subtitle")}</p>
        </div>
        <Link href="/" className="btn-ghost">
          {t("tickets.bookAgain")}
          <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </header>

      <dl className="grid grid-cols-3 divide-x divide-white/10 border border-white/10 bg-abyss-900">
        <Stat
          label={t("tickets.totalCount")}
          value={`${tickets.length}`}
          note={t("tickets.headsNote", { count: totalPassengers })}
        />
        <Stat label={t("tickets.totalSpend")} value={formatUsd(totalSpend)} accent />
        <Stat label={t("tickets.totalDistance")} value={formatKm(totalDistance)} />
      </dl>

      {loading ? (
        <p className="py-16 text-center text-[11px] text-slate-600">{t("common.loading")}</p>
      ) : error ? (
        <p className="py-16 text-center text-[11px] text-rose-300">{error}</p>
      ) : tickets.length === 0 ? (
        <div className="border border-white/10 bg-abyss-900 px-6 py-16 text-center">
          <p className="col-head">{t("tickets.empty")}</p>
          <p className="mx-auto mt-2 max-w-sm text-[12px] text-slate-500">{t("tickets.emptyHint")}</p>
          <Link href="/" className="btn-primary mt-5">
            {t("common.startChat")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
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
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note?: string;
  accent?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <dt className="col-head">{label}</dt>
      <dd className={`mono mt-1.5 text-[16px] ${accent ? "text-sand" : "text-slate-100"}`}>{value}</dd>
      {note && <dd className="mono mt-0.5 text-[10px] text-slate-600">{note}</dd>}
    </div>
  );
}
