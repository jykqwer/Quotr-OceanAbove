"use client";

import { WaveMark } from "@/components/icons";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { Network } from "@/lib/types";

export function LoginHero({ stats }: { stats: Network["stats"] }) {
  const { t } = useI18n();

  const rows = [
    { code: "CITIES", value: stats.cities, note: t("map.statCities") },
    { code: "HUBS", value: stats.hubs, note: t("map.statHubs") },
    { code: "HUB ROUTES", value: stats.links, note: t("map.statLinks") },
  ];

  return (
    <section className="hidden lg:block">
      <div className="flex items-center gap-3">
        <WaveMark className="h-9 w-9" />
        <div>
          <p className="text-[14px] font-semibold uppercase tracking-[0.24em] text-slate-100">
            {t("brand.name")}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.26em] text-slate-600">
            {t("brand.tagline")}
          </p>
        </div>
      </div>

      <h1 className="mt-14 max-w-[420px] text-balance text-[32px] font-medium leading-[1.15] tracking-tight text-slate-100">
        {t("login.heroTitle")}
      </h1>
      <p className="mt-4 max-w-[380px] text-[14px] leading-relaxed text-slate-400">
        {t("login.heroSubtitle")}
      </p>

      <table className="mt-12 w-full max-w-[420px] border-collapse text-left">
        <tbody>
          {rows.map((row) => (
            <tr key={row.code} className="border-t border-white/10 last:border-b">
              <th scope="row" className="col-head py-2.5 pr-4 font-medium">
                {row.code}
              </th>
              <td className="mono py-2.5 text-right text-[16px] text-slate-200">{row.value}</td>
              <td className="py-2.5 pl-4 text-right text-[11.5px] text-slate-600">{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
