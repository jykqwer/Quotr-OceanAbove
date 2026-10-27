import type { DomainGraph } from "@/lib/domain/graph";
import type { Itinerary } from "@/lib/domain/itinerary";
import { findCityMentions, resolveCity } from "@/lib/domain/resolve";
import { findRoute, type Route } from "@/lib/domain/route";
import { formatKm, formatUsd } from "@/lib/format";
import type { Lang, Ticket } from "@/lib/types";

export type Reply =
  | { kind: "route"; content: string; route: Route }
  | { kind: "ambiguous"; content: string; candidates: string[] }
  | { kind: "no_service"; content: string }
  | { kind: "tickets"; content: string }
  | { kind: "help"; content: string };

const TICKET_INTENT = /(ticket|booking|order|booked|reservation|票|订单|行程|预订)/i;
const ROUTE_INTENT = /(cheap|cheapest|price|fare|cost|route|flight|how much|最便宜|票价|多少钱|航线|航班)/i;

export function routeSummary(route: Route, lang: Lang): string {
  const zh = lang === "zh";
  const legs = zh ? `${route.legs.length} 段` : `${route.legs.length} leg${route.legs.length > 1 ? "s" : ""}`;
  const transfers = route.transfers.length
    ? zh
      ? `在 ${route.transfers.join("、")} 中转`
      : `transfer at ${route.transfers.join(", ")}`
    : zh
      ? "直飞"
      : "direct";
  return zh
    ? `${route.origin} → ${route.destination} 的最便宜路线：共 ${legs}，${transfers}。总飞行距离 ${formatKm(route.totalDistanceKm)}，票价为 ${formatUsd(route.priceUsd)}。请核对下方行程，确认后我再出票。`
    : `Cheapest route from ${route.origin} to ${route.destination}: ${legs}, ${transfers}. Total distance ${formatKm(route.totalDistanceKm)}, price ${formatUsd(route.priceUsd)}. Review the itinerary below and confirm to book.`;
}

function ticketSummary(tickets: Ticket[], lang: Lang): string {
  const zh = lang === "zh";
  if (tickets.length === 0) {
    return zh
      ? "你还没有预订过机票。告诉我出发城市和目的地，我可以先给你报价。"
      : "You have not booked any tickets yet. Tell me where you want to fly and I can quote a route.";
  }
  const lines = tickets.map((ticket) => {
    const scope =
      ticket.journeys.length > 1
        ? ticket.journeys.map((journey) => `${journey.origin}→${journey.destination}`).join(" / ")
        : `${ticket.origin} → ${ticket.destination}`;
    const heads = ticket.passengers.length;
    const fare =
      heads > 1
        ? `${formatUsd(ticket.priceUsd)} × ${heads} = ${formatUsd(ticket.totalPriceUsd)}`
        : formatUsd(ticket.priceUsd);
    return `• ${scope} · ${formatKm(ticket.totalDistanceKm)} · ${fare} · ${ticket.id}`;
  });
  return zh
    ? `你一共预订了 ${tickets.length} 张机票：\n${lines.join("\n")}`
    : `You have ${tickets.length} ticket${tickets.length > 1 ? "s" : ""}:\n${lines.join("\n")}`;
}

/** Engine-worded summary of a priced itinerary, used when the model's text is rejected. */
export function itinerarySummary(itinerary: Itinerary, lang: Lang): string {
  const zh = lang === "zh";
  const legs = itinerary.journeys.reduce((sum, journey) => sum + journey.legs.length, 0);
  const heads = itinerary.passengers.length;

  const scope =
    itinerary.journeys.length === 1
      ? itinerary.journeys[0].origin === itinerary.journeys[0].destination
        ? itinerary.journeys[0].origin
        : `${itinerary.journeys[0].origin} → ${itinerary.journeys[0].destination}`
      : itinerary.journeys.map((journey) => `${journey.origin} → ${journey.destination}`).join(" / ");

  const legText = zh ? `${legs} 段` : `${legs} leg${legs === 1 ? "" : "s"}`;
  const fare = formatUsd(itinerary.priceUsd);
  const order = formatUsd(itinerary.totalPriceUsd);

  if (zh) {
    return heads > 1
      ? `${scope} 的最便宜方案共 ${legText}，总距离 ${formatKm(itinerary.totalDistanceKm)}。每人 ${fare}，${heads} 位乘客合计 ${order}。请核对下方行程，确认后我再出票。`
      : `${scope} 的最便宜方案共 ${legText}，总距离 ${formatKm(itinerary.totalDistanceKm)}，票价 ${fare}。请核对下方行程，确认后我再出票。`;
  }
  return heads > 1
    ? `Cheapest option for ${scope}: ${legText}, ${formatKm(itinerary.totalDistanceKm)} total. ${fare} per passenger, ${order} for ${heads} passengers. Review the itinerary below and confirm to book.`
    : `Cheapest option for ${scope}: ${legText}, ${formatKm(itinerary.totalDistanceKm)} total, ${fare}. Review the itinerary below and confirm to book.`;
}

export type ToolReport = (name: string, ok: boolean, ms: number) => void;

function timed<T>(report: ToolReport | undefined, name: string, run: () => T): T {
  const started = performance.now();
  try {
    const value = run();
    report?.(name, true, Math.round(performance.now() - started));
    return value;
  } catch (cause) {
    report?.(name, false, Math.round(performance.now() - started));
    throw cause;
  }
}

/**
 * Deterministic responder. It only orchestrates domain calls — every number and
 * city it prints comes from the engine, never from the text.
 *
 * This stands in for the LLM until the tool-calling loop lands; the reply shapes
 * and the tool trace already match what the tools will return.
 */
export function buildReply(
  graph: DomainGraph,
  text: string,
  lang: Lang,
  tickets: Ticket[],
  report?: ToolReport,
): Reply {
  const zh = lang === "zh";
  const trimmed = text.trim();

  if (TICKET_INTENT.test(trimmed) && !ROUTE_INTENT.test(trimmed)) {
    return { kind: "tickets", content: ticketSummary(tickets, lang) };
  }

  const mentions = timed(report, "resolve_city", () => findCityMentions(graph, trimmed));

  const ambiguous = mentions.find((mention) => mention.candidates.length > 1);
  if (ambiguous) {
    return {
      kind: "ambiguous",
      content: zh
        ? `“${ambiguous.text}” 对应多个地点，请确认是哪一个：${ambiguous.candidates.join(" / ")}。`
        : `"${ambiguous.text}" matches more than one city. Which one do you mean: ${ambiguous.candidates.join(" / ")}?`,
      candidates: ambiguous.candidates,
    };
  }

  const resolutions = mentions.map((mention) =>
    timed(report, "resolve_city", () => resolveCity(graph, mention.candidates[0])),
  );

  const noService = resolutions.find((resolution) => resolution.status === "no_service");
  if (noService && noService.status === "no_service") {
    return {
      kind: "no_service",
      content: zh
        ? `${noService.city} 目前没有航班服务。距离它最近且在运营的城市是 ${noService.nearest.city}，约 ${formatKm(noService.nearest.distanceKm)}。需要我改查 ${noService.nearest.city} 出发或到达的航班吗？`
        : `${noService.city} currently has no flight service. The nearest city we serve is ${noService.nearest.city}, about ${formatKm(noService.nearest.distanceKm)} away. Shall I look up flights to or from ${noService.nearest.city} instead?`,
    };
  }

  const ambiguousRoute = resolutions.find((resolution) => resolution.status === "ambiguous");
  if (ambiguousRoute && ambiguousRoute.status === "ambiguous") {
    return {
      kind: "ambiguous",
      content: zh
        ? `这个城市名对应多个地点，请确认是哪一个：${ambiguousRoute.candidates.join(" / ")}。`
        : `That name matches more than one city. Which one do you mean: ${ambiguousRoute.candidates.join(" / ")}?`,
      candidates: ambiguousRoute.candidates,
    };
  }

  const found = resolutions.flatMap((resolution) => (resolution.status === "found" ? [resolution.city] : []));
  if (found.length >= 2) {
    const route = timed(report, "find_route", () => findRoute(graph, found[0], found[found.length - 1]));
    if (route) return { kind: "route", content: routeSummary(route, lang), route };
    return {
      kind: "help",
      content: zh
        ? "这两座城市之间目前没有可行的航线组合。"
        : "There is no valid connection between those two cities right now.",
    };
  }

  if (found.length === 1) {
    const city = graph.cities.get(found[0]);
    return {
      kind: "help",
      content: zh
        ? `已找到 ${found[0]}${city?.isHub ? "（枢纽）" : ""}。请再告诉我另一座城市，例如「${found[0]} 到 London 最便宜」。`
        : `Found ${found[0]}${city?.isHub ? " (hub)" : ""}. Tell me the other city too, e.g. "${found[0]} to London cheapest".`,
    };
  }

  // Nothing matched: report a no-service query typed exactly, so R8 still works.
  const direct = timed(report, "resolve_city", () => resolveCity(graph, trimmed));
  if (direct.status === "no_service") {
    return {
      kind: "no_service",
      content: zh
        ? `${direct.city} 目前没有航班服务。最近的在运营城市是 ${direct.nearest.city}，约 ${formatKm(direct.nearest.distanceKm)}。`
        : `${direct.city} currently has no flight service. The nearest served city is ${direct.nearest.city}, about ${formatKm(direct.nearest.distanceKm)} away.`,
    };
  }

  return {
    kind: "help",
    content: zh
      ? "我可以帮你查询最便宜路线、解释行程与票价，或列出你已预订的机票。试试：「Chengdu 到 Split 怎么走最便宜？」「我订过哪些机票？」。"
      : 'I can find the cheapest route, explain an itinerary and fare, or list your tickets. Try "Chengdu to Split cheapest" or "what have I booked".',
  };
}
