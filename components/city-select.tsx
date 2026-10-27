"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { useAnchoredPanel } from "@/lib/hooks/use-anchored-panel";
import { useDismiss } from "@/lib/hooks/use-dismiss";
import { useI18n } from "@/lib/i18n/lang-provider";

export interface CityGroups {
  hubs: string[];
  cities: string[];
  unserved: string[];
}

/** Case- and accent-insensitive, so "bogota" finds "Bogotá". */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * One city picker, grouped by how the network treats the city. It is a listbox
 * drawn from our own tokens rather than a native <select>: the platform menu
 * ignores the palette, and was the one control on the page that looked like it
 * came from a different product.
 */
export function CitySelect({
  id,
  label,
  value,
  onChange,
  groups,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  groups: CityGroups;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useDismiss(open, rootRef, close);
  const panelStyle = useAnchoredPanel(open, rootRef, 300, 264);

  const sections = useMemo(() => {
    const needle = fold(query.trim());
    const pick = (names: string[]) =>
      needle ? names.filter((name) => fold(name).includes(needle)) : names;
    return [
      { key: "hubs", label: t("map.statHubs"), names: pick(groups.hubs) },
      { key: "cities", label: t("map.statCities"), names: pick(groups.cities) },
      { key: "unserved", label: t("home.noServiceGroup"), names: pick(groups.unserved) },
    ].filter((section) => section.names.length > 0);
  }, [groups, query, t]);

  const flat = useMemo(() => sections.flatMap((section) => section.names), [sections]);

  const choose = useCallback(
    (name: string) => {
      onChange(name);
      close();
    },
    [close, onChange],
  );

  const openList = useCallback(() => {
    setOpen(true);
    setQuery("");
    const index = flat.findIndex((name) => name === value);
    setActive(index >= 0 ? index : 0);
  }, [flat, value]);

  const move = useCallback(
    (delta: number) => {
      if (flat.length === 0) return;
      setActive((current) => {
        const next = Math.min(Math.max(current + delta, 0), flat.length - 1);
        listRef.current
          ?.querySelector(`[data-index="${next}"]`)
          ?.scrollIntoView({ block: "nearest" });
        return next;
      });
    },
    [flat.length],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!open) openList();
        else move(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "Enter" && open) {
        event.preventDefault();
        const name = flat[active];
        if (name) choose(name);
      } else if (event.key === "Home") {
        event.preventDefault();
        setActive(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setActive(Math.max(flat.length - 1, 0));
      }
    },
    [active, choose, flat, move, open, openList],
  );

  let cursor = -1;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <label htmlFor={id} className="col-head mb-1 block">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-haspopup="listbox"
        aria-label={label}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={`field flex items-center justify-between gap-2 text-left ${
          open ? "border-sunset-400 ring-2 ring-sunset-500/20" : ""
        }`}
      >
        <span className={`truncate ${value ? "text-slate-100" : "text-slate-600"}`}>
          {value || t("home.selectCity")}
        </span>
        <span
          aria-hidden="true"
          className={`shrink-0 text-[11px] text-slate-500 transition-transform ${open ? "rotate-180 text-sunset-300" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          style={panelStyle}
          className="animate-rise overflow-hidden rounded-lg border border-white/15 bg-abyss-950 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)]"
        >
          <div className="border-b border-white/10 p-2">
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={t("home.searchCity")}
              aria-label={t("home.searchCity")}
              aria-controls={`${id}-list`}
              className="field py-1.5 text-[13px]"
            />
          </div>

          <div
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            className="scroll-slim max-h-[182px] overflow-y-auto py-1"
          >
            {sections.length === 0 ? (
              <p className="px-3 py-2 text-[12.5px] text-slate-600">{t("home.noCityMatch")}</p>
            ) : (
              sections.map((section) => (
                <div key={section.key} role="group" aria-label={section.label}>
                  <p className="col-head px-3 py-1.5">{section.label}</p>
                  {section.names.map((name) => {
                    cursor += 1;
                    const index = cursor;
                    const selected = name === value;
                    const highlighted = index === active;
                    return (
                      <button
                        key={name}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        data-index={index}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => choose(name)}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13.5px] transition-colors ${
                          highlighted ? "bg-sunset-500/[0.14] text-sunset-100" : "text-slate-300"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{name}</span>
                        {selected && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-sunset-300" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

