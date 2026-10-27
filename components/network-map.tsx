"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** A four-point sparkle centred on the origin: the selected city's halo.
    Sized in map units — at the usual 0.03 scale this blooms from ~4px to ~30px. */
const STAR_RADIUS = 620;
const STAR_WAIST = 84;
const STAR_PATH = `M 0 ${-STAR_RADIUS} Q ${STAR_WAIST} ${-STAR_WAIST} ${STAR_RADIUS} 0 Q ${STAR_WAIST} ${STAR_WAIST} 0 ${STAR_RADIUS} Q ${-STAR_WAIST} ${STAR_WAIST} ${-STAR_RADIUS} 0 Q ${-STAR_WAIST} ${-STAR_WAIST} 0 ${-STAR_RADIUS} Z`;

/** A–C, D–F, … so a 711-city list stays readable. */
const LETTER_BUCKETS = [
  { key: "a-c", label: "A–C", from: 65, to: 67 },
  { key: "d-f", label: "D–F", from: 68, to: 70 },
  { key: "g-i", label: "G–I", from: 71, to: 73 },
  { key: "j-l", label: "J–L", from: 74, to: 76 },
  { key: "m-o", label: "M–O", from: 77, to: 79 },
  { key: "p-r", label: "P–R", from: 80, to: 82 },
  { key: "s-u", label: "S–U", from: 83, to: 85 },
  { key: "v-x", label: "V–X", from: 86, to: 88 },
  { key: "y-z", label: "Y–Z", from: 89, to: 90 },
  { key: "other", label: "#", from: 0, to: 64 },
];

function bucketOf(name: string): string {
  const code = name.charCodeAt(0);
  const bucket = LETTER_BUCKETS.find(
    (entry) => entry.key !== "other" && code >= entry.from && code <= entry.to,
  );
  return bucket?.key ?? "other";
}

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
  // A pinned city and an active route both want the whole map. The route wins
  // while it is live; clicking a city takes the map back until the route changes.
  const [routeYieldedFor, setRouteYieldedFor] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState<"cities" | "hubs" | null>(null);
  const [bucket, setBucket] = useState("all");
  const closeTimer = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // The list is a wide panel under a small trigger, so leaving the trigger must
  // not close it: the pointer travels across a gap to reach it. It closes when
  // the pointer leaves the panel, on Escape, or on a click outside.
  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openList = useCallback(
    (kind: "cities" | "hubs") => {
      cancelClose();
      setListOpen(kind);
      setBucket("all");
    },
    [cancelClose],
  );

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setListOpen(null);
    }, 220);
  }, [cancelClose]);

  useEffect(() => {
    if (!listOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (listRef.current?.contains(event.target as Node)) return;
      setListOpen(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setListOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, [listOpen]);

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

  const highlightKey = useMemo(
    () => (highlight ?? []).map((leg) => `${leg.from}|${leg.to}`).join(">"),
    [highlight],
  );

  const toggle = useCallback(
    (name: string) => {
      const next = selected === name ? null : name;
      setSelected(next);
      setRouteYieldedFor(next ? highlightKey : null);
    },
    [highlightKey, selected],
  );

  const selectCity = useCallback(
    (name: string) => {
      setSelected(name);
      setRouteYieldedFor(name ? highlightKey : null);
    },
    [highlightKey],
  );

  // A hover-only route vanishes on mouse-out, so its yield must not outlive it.
  useEffect(() => {
    if (!highlightKey) setRouteYieldedFor(null);
  }, [highlightKey]);

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

  // An active route borrows the map: the pinned city steps aside until the user
  // clicks a city again, so the two highlights never compete for the same pixels.
  const routeActive = highlightPoints.length > 1 && routeYieldedFor !== highlightKey;
  const activeCity = routeActive ? null : selected;

  const selectedCity = useMemo(
    () => (index && activeCity ? index.byName.get(activeCity) : undefined),
    [activeCity, index],
  );

  // Hubs light up the cities they serve; a city lights up the hubs it flies to.
  const related = useMemo(() => {
    if (!index || !selectedCity) return null;
    const names = selectedCity.isHub
      ? (index.clients.get(selectedCity.name) ?? []).map((city) => city.name)
      : selectedCity.hubs;
    return new Set(names);
  }, [index, selectedCity]);

  const cityNames = useMemo(
    () =>
      [...(network?.cities ?? [])]
        .map((city) => city.name)
        .sort((a, b) => a.localeCompare(b)),
    [network],
  );
  const hubNames = useMemo(
    () =>
      [...(network?.cities ?? [])]
        .filter((city) => city.isHub)
        .map((city) => city.name)
        .sort((a, b) => a.localeCompare(b)),
    [network],
  );

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

  const focus = hovered ?? activeCity;
  const focusCity = focus ? index.byName.get(focus) : undefined;
  const focusPoint = focusCity ? toPercent(focusCity.x, focusCity.y) : null;
  const listNames = listOpen === "hubs" ? hubNames : cityNames;
  const visibleNames =
    bucket === "all" ? listNames : listNames.filter((name) => bucketOf(name) === bucket);

  return (
    <section className="flex h-full min-h-0 flex-col rounded-lg border border-white/10 bg-abyss-900">
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
        <span className="col-head">{t("map.title")}</span>
        {/* Moving from the count into the list crosses a gap where neither is
            hovered, so closing is deferred and cancelled on re-entry. */}
        <div className="relative flex items-center">
        <span className="mono flex items-center gap-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="text-slate-300">{network.stats.cities}</span>
            <button
              type="button"
              onMouseEnter={() => openList("cities")}
              onClick={() => {
                setListOpen((current) => (current === "cities" ? null : "cities"));
                setBucket("all");
              }}
              aria-expanded={listOpen === "cities"}
              className="uppercase tracking-[0.08em] text-slate-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-sunset-300"
            >
              {t("map.statCities")}
            </button>
          </span>
          <span className="text-slate-700">·</span>
          <span className="flex items-center gap-1">
            <span className="text-slate-300">{network.stats.hubs}</span>
            <button
              type="button"
              onMouseEnter={() => openList("hubs")}
              onClick={() => {
                setListOpen((current) => (current === "hubs" ? null : "hubs"));
                setBucket("all");
              }}
              aria-expanded={listOpen === "hubs"}
              className="uppercase tracking-[0.08em] text-slate-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-sunset-300"
            >
              {t("map.statHubs")}
            </button>
          </span>
        </span>

        {listOpen && (
          <div
            ref={listRef}
            className="absolute right-0 top-full z-30 w-[min(92vw,340px)] border border-white/15 bg-abyss-950 shadow-pass"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >            <div className="flex items-center justify-between border-b border-white/10 px-2.5 py-1.5">
              <span className="col-head">
                {listOpen === "hubs" ? t("map.hubList") : t("map.cityList")}
              </span>
              <span className="mono text-[9.5px] text-slate-600">{visibleNames.length}</span>
            </div>

            <div className="flex flex-wrap items-center gap-1 border-b border-white/10 px-2 py-1.5">
              <span className="sr-only">{t("map.filterLabel")}</span>
              <button
                type="button"
                onClick={() => setBucket("all")}
                aria-pressed={bucket === "all"}
                className={`mono rounded px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.08em] transition-colors ${
                  bucket === "all" ? "bg-ocean-400 text-abyss-950" : "text-slate-500 hover:text-slate-200"
                }`}
              >
                {t("map.listAll")}
              </button>
              {LETTER_BUCKETS.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setBucket(entry.key)}
                  aria-pressed={bucket === entry.key}
                  className={`mono rounded px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.08em] transition-colors ${
                    bucket === entry.key
                      ? "bg-ocean-400 text-abyss-950"
                      : "text-slate-500 hover:text-slate-200"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <div className="scroll-slim max-h-[220px] overflow-y-auto px-2 py-1.5">
              {visibleNames.length === 0 ? (
                <p className="py-2 text-center text-[10.5px] text-slate-600">{t("map.listEmpty")}</p>
              ) : (
                <ul className="mono grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10.5px]">
                  {visibleNames.map((name) => {
                    const isActive = activeCity === name;
                    const isHub = index.byName.get(name)?.isHub ?? false;
                    return (
                      <li key={name}>
                        <button
                          type="button"
                          onClick={() => {
                            selectCity(name);
                            setListOpen(null);
                          }}
                          aria-pressed={isActive}
                          title={`${name}${isHub ? ` · ${t("map.hub")}` : ""}`}
                          className={`flex w-full items-center gap-1.5 truncate rounded px-1 py-0.5 text-left transition-colors ${
                            isActive
                              ? "bg-sunset-500/15 text-sunset-200"
                              : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`h-1 w-1 shrink-0 ${isHub ? "bg-lamp-300" : "rounded-full bg-lamp-400/70"}`}
                          />
                          <span className="truncate">{name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
        </div>
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
          aria-label={`${t("map.title")}: ${network.stats.cities} ${t("map.statCities")}, ${network.stats.hubs} ${t("map.statHubs")}`}
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
              const active = activeCity !== null && (link.a === activeCity || link.b === activeCity);
              return (
                <path
                  key={`${link.a}|${link.b}`}
                  d={arcPath(a, b, 0.16)}
                  className={active ? "animate-flow stroke-sunset-400" : "stroke-ocean-400"}
                  strokeWidth={active ? 16 : 8}
                  strokeOpacity={active ? 0.95 : activeCity ? 0.07 : 0.32}
                  strokeDasharray={active ? "80 120" : undefined}
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
              const isFocus = city.name === focus;
              const isSelected = city.name === activeCity;
              return (
                <circle
                  key={city.name}
                  cx={cx}
                  cy={cy}
                  r={isFocus || isSelected ? 54 : 30}
                  className={
                    isSelected || isFocus
                      ? "fill-sunset-400"
                      : isRelated
                        ? "fill-lamp-300"
                        : "fill-lamp-400"
                  }
                  fillOpacity={related ? (isRelated || isFocus ? 0.95 : 0.12) : isFocus ? 1 : 0.5}
                />
              );
            })}
          </g>

          {selectedCity && (
            <g fill="none" pointerEvents="none" transform={`translate(${toSvg(selectedCity.x, selectedCity.y).join(" ")})`}>
              <circle r={560} className="animate-ripple stroke-sunset-300" strokeWidth={34} />
              <path d={STAR_PATH} className="animate-star fill-sunset-300" fillOpacity={0.6} />
            </g>
          )}

          {selectedCity && (
            <g fill="none">
              {selectedCity.isHub
                ? (index.clients.get(selectedCity.name) ?? []).map((city) => (
                    <path
                      key={`hub-${city.name}`}
                      d={arcPath(selectedCity, city, 0.1)}
                      className="animate-flow stroke-sunset-400"
                      strokeWidth={5}
                      strokeOpacity={0.4}
                      strokeDasharray="100 100"
                      strokeLinecap="round"
                    />
                  ))
                : selectedCity.hubs.map((hubName) => {
                    const hub = index.byName.get(hubName);
                    if (!hub) return null;
                    return (
                      <path
                        key={`city-hub-${hubName}`}
                        d={arcPath(selectedCity, hub, 0.1)}
                        className="animate-flow stroke-sunset-400"
                        strokeWidth={7}
                        strokeOpacity={0.75}
                        strokeDasharray="100 100"
                        strokeLinecap="round"
                      />
                    );
                  })}
            </g>
          )}

          <g>
            {network.cities.map((city) => {
              if (!city.isHub) return null;
              const [cx, cy] = toSvg(city.x, city.y);
              const isSelected = city.name === activeCity;
              const isFocus = city.name === focus;
              const size = isSelected || isFocus ? 148 : 92;
              return (
                <rect
                  key={city.name}
                  x={cx - size / 2}
                  y={cy - size / 2}
                  width={size}
                  height={size}
                  className={isSelected || isFocus ? "fill-sunset-500" : "fill-lamp-300"}
                />
              );
            })}
          </g>

          {routeActive && (
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
              {/* A comet with a tail runs from each leg's origin to its
                  destination, so the shape shows which way the trip goes. */}
              {highlightPoints.slice(0, -1).map((point, i) => (
                <path
                  key={`hl-flow-${i}`}
                  d={arcPath(point, highlightPoints[i + 1], 0.16)}
                  className="animate-flow stroke-cream-100"
                  strokeWidth={22}
                  strokeOpacity={0.95}
                  strokeDasharray="600 120 360 120"
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
              if (city.isHub) return null;
              const [cx, cy] = toSvg(city.x, city.y);
              return (
                <circle
                  key={`hit-${city.name}`}
                  cx={cx}
                  cy={cy}
                  r={150}
                  fill="transparent"
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`${city.name}, ${t("map.city")}, ${t("map.directHubs", { count: city.hubs.length })}`}
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
              {focusCity.isHub
                ? `${t("map.hubRoutes", { count: index.degree.get(focusCity.name) ?? 0 })} · ${t("map.directCities", { count: index.clients.get(focusCity.name)?.length ?? 0 })}`
                : `${t("map.directHubs", { count: focusCity.hubs.length })} · ${focusCity.hubs.join(" · ")}`}
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
                onClick={() => {
                  setSelected(null);
                  setRouteYieldedFor(null);
                }}
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
    </section>
  );
}
