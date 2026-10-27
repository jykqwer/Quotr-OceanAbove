"use client";

import { WaveMark } from "@/components/icons";
import { useI18n } from "@/lib/i18n/lang-provider";

export function LoginHero() {
  const { t } = useI18n();

  return (
    <section className="hidden lg:block">
      <div className="flex items-center gap-3">
        <WaveMark className="h-9 w-9" />
        <div>
          <p className="text-[15px] font-semibold uppercase tracking-[0.24em] text-slate-100">
            {t("brand.name")}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.26em] text-slate-600">
            {t("brand.tagline")}
          </p>
        </div>
      </div>

      <h1 className="mt-14 text-balance text-[34px] font-medium leading-[1.15] tracking-tight text-slate-100">
        {t("login.heroTitle")}
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
        {t("login.heroSubtitle")}
      </p>
    </section>
  );
}
