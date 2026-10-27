"use client";

import { LegTable } from "@/components/leg-timeline";
import { formatKm } from "@/lib/format";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { Journey } from "@/lib/types";

/**
 * One block per city pair. A single-trip booking renders exactly one block and
 * looks exactly like before; a multi-city booking shows each journey with its
 * own leg table and its own distance.
 */
export function JourneyList({ journeys }: { journeys: Journey[] }) {
  const { t } = useI18n();

  if (journeys.length <= 1) {
    return journeys[0] ? <LegTable legs={journeys[0].legs} /> : null;
  }

  return (
    <ol className="space-y-3">
      {journeys.map((journey, index) => (
        <li key={`${journey.origin}-${journey.destination}-${index}`} className="border border-white/10">
          <div className="flex items-baseline justify-between gap-2 border-b border-white/10 px-2.5 py-1.5">
            <span className="mono text-[9px] uppercase tracking-[0.14em] text-sunset-300/80">
              {t("quote.journeyN", { n: index + 1 })}
            </span>
            <span className="min-w-0 truncate text-[11.5px] text-slate-200">
              {journey.origin}
              <span className="mx-1 text-slate-600">→</span>
              {journey.destination}
            </span>
            <span className="mono shrink-0 text-[11px] text-slate-400">
              {formatKm(journey.totalDistanceKm)}
            </span>
          </div>
          <div className="px-2.5 pb-1">
            <LegTable legs={journey.legs} />
          </div>
        </li>
      ))}
    </ol>
  );
}
