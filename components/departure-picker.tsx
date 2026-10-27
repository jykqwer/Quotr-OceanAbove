"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ClockIcon } from "@/components/icons";
import { formatClock, formatDayLabel, formatMonthYear, weekdayLabels } from "@/lib/format";
import { useAnchoredPanel } from "@/lib/hooks/use-anchored-panel";
import { useDismiss } from "@/lib/hooks/use-dismiss";
import { useI18n } from "@/lib/i18n/lang-provider";

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);

/** `datetime-local` needs a local "YYYY-MM-DDTHH:mm" value. */
export function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocal(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return new Date();
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
}

/**
 * A departure picker drawn from our own tokens. The native
 * `input[type=datetime-local]` popup is rendered by the operating system — it
 * arrives in blue-grey Chrome chrome and cannot be themed, so the one control
 * that decides *when* you fly looked like it belonged to another product.
 */
export function DeparturePicker({
  id,
  label,
  value,
  min,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  /** Earliest selectable moment, as a local `datetime-local` string. */
  min?: string;
  onChange: (value: string) => void;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(parseLocal(value)));
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, [rootRef, panelRef], close);
  const panelStyle = useAnchoredPanel(open, rootRef, 240, 336, 336);

  const selected = useMemo(() => parseLocal(value), [value]);
  const floor = useMemo(() => (min ? parseLocal(min) : null), [min]);
  const weekdays = useMemo(() => weekdayLabels(lang), [lang]);
  const days = useMemo(() => monthGrid(month), [month]);

  const commit = useCallback(
    (next: Date) => {
      onChange(toLocalInput(next));
    },
    [onChange],
  );

  const pickDay = useCallback(
    (day: number) => {
      const next = new Date(
        month.getFullYear(),
        month.getMonth(),
        day,
        selected.getHours(),
        selected.getMinutes(),
      );
      if (floor && next.getTime() < floor.getTime()) {
        next.setHours(floor.getHours(), floor.getMinutes(), 0, 0);
      }
      commit(next);
      close();
    },
    [close, commit, floor, month, selected],
  );

  const pickHour = useCallback(
    (hour: number) => {
      commit(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), hour, selected.getMinutes()));
    },
    [commit, selected],
  );

  const pickMinute = useCallback(
    (minute: number) => {
      commit(
        new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), selected.getHours(), minute),
      );
      close();
    },
    [close, commit, selected],
  );

  const isDisabled = useCallback(
    (day: number) => {
      if (!floor) return false;
      const candidate = new Date(month.getFullYear(), month.getMonth(), day, 23, 59);
      return candidate.getTime() < floor.getTime();
    },
    [floor, month],
  );

  const today = new Date();
  const sameDay = (day: number) =>
    today.getFullYear() === month.getFullYear() &&
    today.getMonth() === month.getMonth() &&
    today.getDate() === day;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <label htmlFor={id} className="col-head mb-1 block">
        {label}
      </label>
      <button
        id={id}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        onClick={() => {
          setMonth(startOfMonth(parseLocal(value)));
          setOpen((current) => !current);
        }}
        className={`field flex items-center justify-between gap-2 text-left ${
          open ? "border-sunset-400 ring-2 ring-sunset-500/20" : ""
        }`}
      >
        <span className="mono truncate text-slate-100">
          {formatDayLabel(selected, lang)} · {formatClock(selected.getHours(), selected.getMinutes())}
        </span>
        <ClockIcon className={`h-4 w-4 shrink-0 ${open ? "text-sunset-300" : "text-slate-500"}`} />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            style={panelStyle}
            className="animate-fade overflow-hidden rounded-lg border border-white/15 bg-abyss-950 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)]"
          >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <span className="text-[13px] text-slate-200">{formatMonthYear(month, lang)}</span>
            <span className="flex items-center gap-1">
              <MonthButton label={t("home.previousMonth")} onClick={() => setMonth(addMonths(month, -1))}>
                ‹
              </MonthButton>
              <MonthButton label={t("home.nextMonth")} onClick={() => setMonth(addMonths(month, 1))}>
                ›
              </MonthButton>
            </span>
          </div>

          <div className="flex">
            <div className="min-w-0 flex-1 px-2 pb-2 pt-2">
              <div className="grid grid-cols-7">
                {weekdays.map((day) => (
                  <span
                    key={day}
                    className="mono pb-1 text-center text-[10.5px] uppercase tracking-[0.08em] text-slate-600"
                  >
                    {day}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {days.map((day, index) =>
                  day === null ? (
                    <span key={`pad-${index}`} aria-hidden="true" />
                  ) : (
                    <button
                      key={day}
                      type="button"
                      disabled={isDisabled(day)}
                      aria-pressed={
                        selected.getFullYear() === month.getFullYear() &&
                        selected.getMonth() === month.getMonth() &&
                        selected.getDate() === day
                      }
                      onClick={() => pickDay(day)}
                      className={`mono h-[26px] rounded text-[12.5px] tabular-nums transition-colors disabled:cursor-not-allowed disabled:text-slate-700 ${
                        selected.getFullYear() === month.getFullYear() &&
                        selected.getMonth() === month.getMonth() &&
                        selected.getDate() === day
                          ? "bg-sunset-500 font-medium text-abyss-950"
                          : sameDay(day)
                            ? "border border-sunset-400/40 text-sunset-200 hover:bg-white/[0.06]"
                            : "text-slate-300 hover:bg-white/[0.06]"
                      }`}
                    >
                      {day}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="flex shrink-0 gap-1.5 border-l border-white/10 px-2 pb-2 pt-2">
              <TimeColumn
                label={t("home.hour")}
                values={HOURS}
                selected={selected.getHours()}
                format={(hour) => String(hour).padStart(2, "0")}
                onPick={pickHour}
              />
              <TimeColumn
                label={t("home.minute")}
                values={MINUTES}
                selected={selected.getMinutes()}
                format={(minute) => String(minute).padStart(2, "0")}
                onPick={pickMinute}
              />
            </div>
          </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function MonthButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded border border-white/10 text-[13px] text-slate-400 transition-colors hover:border-sunset-400/50 hover:text-sunset-300"
    >
      {children}
    </button>
  );
}

function TimeColumn({
  label,
  values,
  selected,
  format,
  onPick,
}: {
  label: string;
  values: number[];
  selected: number;
  format: (value: number) => string;
  onPick: (value: number) => void;
}) {
  return (
    <div className="w-[52px] min-w-0">
      <p className="col-head mb-1 text-center">{label}</p>
      <div className="scroll-slim h-[152px] overflow-y-auto rounded border border-white/10">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={value === selected}
            onClick={() => onPick(value)}
            className={`mono block w-full py-1 text-center text-[12.5px] transition-colors ${
              value === selected
                ? "bg-sunset-500/[0.18] text-sunset-100"
                : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
            }`}
          >
            {format(value)}
          </button>
        ))}
      </div>
    </div>
  );
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/** Sunday-first grid, padded with nulls so the weekday columns line up. */
function monthGrid(month: Date): (number | null)[] {
  const firstWeekday = month.getDay();
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= dayCount; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
