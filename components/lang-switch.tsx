"use client";

import { useI18n } from "@/lib/i18n/lang-provider";
import type { Lang } from "@/lib/types";

const OPTIONS: { value: Lang; label: string }[] = [
  { value: "zh", label: "中" },
  { value: "en", label: "EN" },
];

export function LangSwitch() {
  const { lang, setLang } = useI18n();

  return (
    <div
      className="flex items-center rounded-full border border-white/10 bg-white/[0.04] p-0.5"
      role="group"
      aria-label="Language"
    >
      {OPTIONS.map((option) => {
        const active = option.value === lang;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setLang(option.value)}
            aria-pressed={active}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition ${
              active
                ? "bg-ocean-500/20 text-ocean-200 ring-1 ring-inset ring-ocean-400/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
