"use client";

import { useCallback, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { Leg, Network, NetworkCity } from "@/lib/types";

const SPAN_X = 20000;
const SPAN_Y = 10000;
const PAD = 520;
const VIEW_W = SPAN_X + PAD * 2;
const VIEW_H = SPAN_Y + PAD * 2;

interface Point {
  x: number;
  y: number;
}

function toSvg(x: number, y: number): [number, number] {
  return [x + SPAN_X / 2, SPAN_Y / 2 - y];
}

function toPercent(x: number, y: number): { left: number; top: number } {
  const [svgX, svgY] = toSvg(x, y);
  return { left: ((svgX + PAD) / VIEW_W) * 100, top: ((svgY + PAD) / VIEW_H) * 100 };
}

/** Quadratic arc between two cities, always bowing toward the top of the chart. */
function arcPath(a: Point, b: Point, bow = 0.16): string {
  const [x1, y1] = toSvg(a.x, a.y);
  const [x2, y2] = toSvg(b.x, b.y);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  let nx = -dy / length;
  let ny = dx / length;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const cx = (x1 + x2) / 2 + nx * length * bow;
  const cy = (y1 + y2) / 2 + ny * length * bow;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

const GRID_X = [-7500, -5000, -2500, 0, 2500, 5000, 7500];
const GRID_Y = [-3750, -1250, 1250, 3750];

export function NetworkMap({
  network,
  highlight = null,
}: {
  network: Network | null;
  highlight?: Leg[] | null;
}) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const index = useMemo(() => {
    if (!network) return null;
    const byName = new Map(network.cities.map((city) => [city.name, city]));
    const clients = new Map<string, NetworkCity[]>();
    const degree = new Map<string, number>();
    for (const city of network.cities) {
      if (city.isHub) continue;
      for (const hub of city.hubs) {
        const list = clients.get(hub) ?? [];
        list.push(city);
        clients.set(hub, list);
      }
    }
    for (const link of network.links) {
      degree.set(link.a, (degree.get(link.a) ?? 0) + 1);
      degree.set(link.b, (degree.get(link.b) ?? 0) + 1);
    }
    return { byName, clients, degree };
  }, [network]);

  const toggle = useCallback((name: string) => {
    setSelected((current) => (current === name ? null : name));
  }, []);

  const highlightPoints = useMemo(() => {
    if (!index || !highlight || highlight.length === 0) return [] as NetworkCity[];
    const points: NetworkCity[] = [];
    for (const leg of highlight) {
      const from = index.byName.get(leg.from);
      if (from) points.push(from);
    }
    const last = index.byName.get(highlight[highlight.length - 1].to);
    if (last) points.push(last);
    return points;
  }, [highlight, index]);

  if (!network || !index) {
    return (
      <section className="flex h-full flex-col rounded-lg border border-white/10 bg-abyss-900">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <span className="col-head">{t("map.title")}</span>
        </div>
        <div className="grid flex-1 place-items-center">
          <span className="text-[11px] text-slate-600">{t("common.loading")}</span>
        </div>
      </section>
    );
  }

  const selectedCity = selected ? index.byName.get(selected) : undefined;
  const focus = hovered ?? selected;
  const focusCity = focus ? index.byName.get(focus) : undefined;
  const related = selected ? new Set((index.clients.get(selected) ?? []).map((city) => city.name)) : null;
  const focusPoint = focusCity ? toPercent(focusCity.x, focusCity.y) : null;

  return (
    <section className="flex h-full min-h-0 flex-col rounded-lg border border-white/10 bg-abyss-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
        <span className="col-head">{t("map.title")}</span>
        <span className="mono flex items-center gap-2 text-[10px] text-slate-500">
          <span className="text-slate-300">{network.stats.cities}</span>
          {t("map.statCities")}
          <span className="text-slate-700">·</span>
          <span className="text-slate-300">{network.stats.hubs}</span>
          {t("map.statHubs")}
          <span className="text-slate-700">·</span>
          <span className="text-slate-300">{network.stats.links}</span>
          {t("map.statLinks")}
        </span>
      </div>

      <div className="relative grid min-h-0 flex-1 place-items-center overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_120%,rgba(255,122,69,0.10),transparent_62%)]"
        />
        <svg
          viewBox={`${-PAD} ${-PAD} ${VIEW_W} ${VIEW_H}`}
          className="relative block h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${t("map.title")}: ${network.stats.cities} ${t("map.statCities")}, ${network.stats.hubs} ${t("map.statHubs")}, ${network.stats.links} ${t("map.statLinks")}`}
          onClick={() => setSelected(null)}
        >
          <g className="stroke-lamp-300" strokeOpacity="0.045" strokeWidth="14">
            {GRID_X.map((x) => {
              const [sx] = toSvg(x, 0);
              return <line key={`gx-${x}`} x1={sx} y1={-PAD} x2={sx} y2={VIEW_H - PAD} />;
            })}
            {GRID_Y.map((y) => {
              const [, sy] = toSvg(0, y);
              return <line key={`gy-${y}`} x1={-PAD} y1={sy} x2={VIEW_W - PAD} y2={sy} />;
            })}
          </g>

          <g fill="none">
            {network.links.map((link) => {
              const a = index.byName.get(link.a);
              const b = index.byName.get(link.b);
              if (!a || !b) return null;
              const active = selected !== null && (link.a === selected || link.b === selected);
              return (
                <path
                  key={`${link.a}|${link.b}`}
                  d={arcPath(a, b, 0.16)}
                  className={active ? "animate-flow stroke-sunset-400" : "stroke-ocean-400"}
                  strokeWidth={active ? 16 : 8}
                  strokeOpacity={active ? 0.95 : selected ? 0.07 : 0.32}
                  strokeDasharray={active ? "10 16" : undefined}
                  strokeLinecap="round"
                />
              );
            })}
          </g>

          <g>
            {network.cities.map((city) => {
              if (city.isHub) return null;
              const [cx, cy] = toSvg(city.x, city.y);
              const isRelated = related?.has(city.name) ?? false;
              return (
                <circle
                  key={city.name}
                  cx={cx}
                  cy={cy}
                  r={30}
                  className={isRelated ? "fill-lamp-300" : "fill-lamp-400"}
                  fillOpacity={related ? (isRelated ? 0.95 : 0.12) : 0.5}
                />
              );
            })}
          </g>

          {selectedCity && (
            <g fill="none">
              {(index.clients.get(selectedCity.name) ?? []).map((city) => (
                <path
                  key={`hub-${city.name}`}
                  d={arcPath(selectedCity, city, 0.1)}
                  className="stroke-sunset-400"
                  strokeWidth={5}
                  strokeOpacity={0.4}
                  strokeDasharray="6 10"
                  strokeLinecap="round"
                />
              ))}
            </g>
          )}

          <g>
            {network.cities.map((city) => {
              if (!city.isHub) return null;
              const [cx, cy] = toSvg(city.x, city.y);
              const isSelected = city.name === selected;
              return (
                <rect
                  key={city.name}
                  x={cx - (isSelected ? 74 : 46)}
                  y={cy - (isSelected ? 74 : 46)}
                  width={isSelected ? 148 : 92}
                  height={isSelected ? 148 : 92}
                  className={isSelected ? "fill-sunset-500" : "fill-lamp-300"}
                />
              );
            })}
          </g>

          {highlightPoints.length > 1 && (
            <g fill="none" pointerEvents="none">
              {highlightPoints.slice(0, -1).map((point, i) => (
                <path
                  key={`hl-glow-${i}`}
                  d={arcPath(point, highlightPoints[i + 1], 0.16)}
                  className="stroke-sunset-500"
                  strokeWidth={30}
                  strokeOpacity={0.22}
                  strokeLinecap="round"
                />
              ))}
              {highlightPoints.slice(0, -1).map((point, i) => (
                <path
                  key={`hl-${i}`}
                  d={arcPath(point, highlightPoints[i + 1], 0.16)}
                  className="stroke-sand"
                  strokeWidth={11}
                  strokeOpacity={0.95}
                  strokeLinecap="round"
                />
              ))}
              {highlightPoints.map((point, i) => {
                const [cx, cy] = toSvg(point.x, point.y);
                const isEnd = i === 0 || i === highlightPoints.length - 1;
                return (
                  <circle
                    key={`hl-dot-${point.name}-${i}`}
                    cx={cx}
                    cy={cy}
                    r={isEnd ? 52 : 34}
                    className={isEnd ? "fill-sand" : "fill-cream-100"}
                    fillOpacity={isEnd ? 1 : 0.9}
                  />
                );
              })}
            </g>
          )}

          <g>
            {network.cities.map((city) => {
              if (!city.isHub) return null;
              const [cx, cy] = toSvg(city.x, city.y);
              return (
                <circle
                  key={`hit-${city.name}`}
                  cx={cx}
                  cy={cy}
                  r={380}
                  fill="transparent"
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`${city.name}, ${t("map.hub")}, ${t("map.hubRoutes", { count: index.degree.get(city.name) ?? 0 })}`}
                  onMouseEnter={() => setHovered(city.name)}
                  onMouseLeave={() => setHovered((current) => (current === city.name ? null : current))}
                  onFocus={() => setHovered(city.name)}
                  onBlur={() => setHovered((current) => (current === city.name ? null : current))}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(city.name);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggle(city.name);
                    }
                  }}
                />
              );
            })}
          </g>
        </svg>

        {focusCity && focusPoint && (
          <div
            className={`pointer-events-none absolute z-10 hidden whitespace-nowrap rounded border border-white/20 bg-abyss-950/95 px-2 py-1.5 sm:block ${
              focusPoint.top < 26 ? "translate-y-[10px]" : "-translate-y-[calc(100%+12px)]"
            } ${focusPoint.left > 55 ? "mr-2" : "ml-2"}`}
            style={
              focusPoint.left > 55
                ? { right: `${100 - focusPoint.left}%`, top: `${focusPoint.top}%` }
                : { left: `${focusPoint.left}%`, top: `${focusPoint.top}%` }
            }
          >
            <p className="text-[11.5px] text-slate-100">{focusCity.name}</p>
            <p className="mono text-[9.5px] text-slate-500">
              {t("map.hubRoutes", { count: index.degree.get(focusCity.name) ?? 0 })} ·{" "}
              {t("map.directCities", { count: index.clients.get(focusCity.name)?.length ?? 0 })}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/10 px-4 py-2">
        <span className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.14em] text-slate-500">
          <span aria-hidden="true" className="h-1.5 w-1.5 bg-lamp-300" />
          {t("map.legendHub")}
        </span>
        <span className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.14em] text-slate-500">
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-lamp-400/70" />
          {t("map.legendCity")}
        </span>
        <span className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.14em] text-slate-500">
          <span aria-hidden="true" className="h-px w-4 bg-ocean-400/70" />
          {t("map.legendLink")}
        </span>

        <span className="ml-auto flex items-center gap-2 text-[10.5px] text-slate-500">
          {selectedCity ? (
            <>
              <span className="text-slate-200">{selectedCity.name}</span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded border border-white/15 px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.12em] text-slate-400 hover:bg-white/[0.05]"
              >
                {t("map.clear")}
              </button>
            </>
          ) : highlightPoints.length > 1 ? (
            <span className="text-sand">{t("map.showingRoute")}</span>
          ) : (
            t("map.hint")
          )}
        </span>
      </div>

      <p className="border-t border-white/10 px-4 py-1.5 text-[10px] text-slate-600">{t("map.note")}</p>
    </section>
  );
}
