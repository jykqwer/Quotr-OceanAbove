import type { Lang } from "@/lib/types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const km = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUsd(value: number): string {
  return usd.format(value);
}

export function formatKm(value: number): string {
  return `${km.format(value)} km`;
}

export function formatDateTime(iso: string, lang: Lang): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale(lang), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function locale(lang: Lang): string {
  return lang === "zh" ? "zh-CN" : "en-US";
}

/** "2026年10月" / "October 2026" — the calendar header. */
export function formatMonthYear(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { year: "numeric", month: "long" }).format(date);
}

/** "10月28日 周三" / "Wed, Oct 28" — the day written next to a clock time. */
export function formatDayLabel(date: Date, lang: Lang): string {
  const parts = new Intl.DateTimeFormat(locale(lang), {
    month: lang === "zh" ? "numeric" : "short",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  // Composed by hand: zh-CN's own pattern drops the space ("10月28日周三"),
  // and its short month is a bare number, so 月 has to be written here.
  return lang === "zh"
    ? `${pick("month")}月${pick("day")}日 ${pick("weekday")}`
    : `${pick("weekday")}, ${pick("month")} ${pick("day")}`;
}

/** "09:00" — always 24h so a time never needs an AM/PM switch. */
export function formatClock(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Sunday-first column heads for the calendar: ["Sun", …] / ["周日", …]. */
export function weekdayLabels(lang: Lang): string[] {
  const formatter = new Intl.DateTimeFormat(locale(lang), { weekday: "short" });
  // 2024-01-07 was a Sunday; seven consecutive days cover a full week.
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(2024, 0, 7 + index)),
  );
}

