"use client";

import { CheckIcon, WaveMark } from "@/components/icons";
import { useI18n } from "@/lib/i18n/lang-provider";

export function LoginHero() {
  const { t } = useI18n();
  const features = [t("login.feature1"), t("login.feature2"), t("login.feature3")];

  return (
    <section className="hidden lg:block">
      <div className="flex items-center gap-3">
        <WaveMark className="h-11 w-11" />
        <div>
          <p className="text-base font-semibold tracking-wide text-slate-50">{t("brand.name")}</p>
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
            {t("brand.tagline")}
          </p>
        </div>
      </div>

      <h1 className="mt-12 max-w-lg text-balance text-4xl font-semibold leading-tight tracking-tight text-slate-50">
        {t("login.heroTitle")}
      </h1>
      <p className="mt-4 max-w-md text-[14px] leading-relaxed text-slate-400">
        {t("login.heroSubtitle")}
      </p>

      <ul className="mt-8 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-[13px] text-slate-300">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-ocean-400/30 bg-ocean-500/10">
              <CheckIcon className="h-3 w-3 text-ocean-300" />
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-12 flex items-center gap-6 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-ocean-400" />
          711 cities
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-sand" />
          40 hubs
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
          151 hub routes
        </span>
      </div>
    </section>
  );
}
