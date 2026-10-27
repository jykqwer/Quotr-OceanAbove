"use client";

import { useI18n } from "@/lib/i18n/lang-provider";
import { formatKm } from "@/lib/format";
import type { Leg } from "@/lib/types";

export function LegTimeline({ legs, dense = false }: { legs: Leg[]; dense?: boolean }) {
  const { t } = useI18n();

  return (
    <ol className={dense ? "space-y-3" : "space-y-4"}>
      {legs.map((leg, index) => {
        const isLast = index === legs.length - 1;
        return (
          <li key={`${leg.seq}-${leg.from}-${leg.to}`} className="relative pl-6">
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute left-[4.5px] top-3 h-[calc(100%+0.25rem)] w-px bg-gradient-to-b from-ocean-400/50 to-white/10"
              />
            )}
            <span
              aria-hidden="true"
              className={`absolute left-0 top-1.5 h-[9px] w-[9px] rounded-full ring-4 ${
                isLast
                  ? "bg-sand ring-sand/15"
                  : "bg-ocean-400 ring-ocean-500/15"
              }`}
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-[13px] font-medium text-slate-100">
                {leg.from}
                <span className="mx-1.5 text-slate-500">→</span>
                {leg.to}
              </p>
              <span className="font-mono text-[12px] tabular-nums text-slate-300">
                {formatKm(leg.distanceKm)}
              </span>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
              <span className="uppercase tracking-[0.14em]">{t("quote.leg", { n: leg.seq })}</span>
              {!isLast && (
                <span className="inline-flex items-center gap-1 rounded-full border border-ocean-400/25 bg-ocean-500/10 px-1.5 py-0.5 text-[10px] font-medium text-ocean-200">
                  {t("quote.transferAt", { city: leg.to })}
                </span>
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
