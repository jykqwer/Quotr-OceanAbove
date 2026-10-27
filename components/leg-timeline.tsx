"use client";

import { useI18n } from "@/lib/i18n/lang-provider";
import { formatKm } from "@/lib/format";
import type { Leg } from "@/lib/types";

export function LegTable({ legs }: { legs: Leg[] }) {
  const { t } = useI18n();

  return (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">{t("quote.route")}</caption>
      <thead>
        <tr className="border-b border-white/10">
          <th scope="col" className="col-head w-6 py-1.5 text-left">
            #
          </th>
          <th scope="col" className="col-head py-1.5 text-left">
            {t("pass.segment")}
          </th>
          <th scope="col" className="col-head w-[106px] py-1.5 text-right">
            {t("quote.totalDistance")}
          </th>
        </tr>
      </thead>
      <tbody>
        {legs.map((leg, index) => {
          const isLast = index === legs.length - 1;
          return (
            <tr key={`${leg.seq}-${leg.from}-${leg.to}`} className="border-b border-white/5 last:border-0">
              <td className="mono py-2 align-top text-[13px] text-slate-600">{leg.seq}</td>
              <td className="py-2 pr-3 align-top">
                <div className="text-[14.5px] leading-snug">
                  <span className="text-slate-100">{leg.from}</span>
                  <span className="mx-1.5 text-slate-600">→</span>
                  <span className="text-slate-100">{leg.to}</span>
                </div>
                {!isLast && (
                  <div className="mono mt-0.5 text-[11px] uppercase tracking-[0.12em] text-ocean-300/70">
                    {t("quote.transferAt", { city: leg.to })}
                  </div>
                )}
              </td>
              <td className="mono whitespace-nowrap py-2 text-right align-top text-[14px] text-slate-300">
                {formatKm(leg.distanceKm)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
