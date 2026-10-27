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
    <div className="flex items-center border border-white/10" role="group" aria-label="Language">
      {OPTIONS.map((option) => {
        const active = option.value === lang;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setLang(option.value)}
            aria-pressed={active}
            className={`px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors ${
              active
                ? "bg-ocean-400 text-abyss-950"
                : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-300"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
