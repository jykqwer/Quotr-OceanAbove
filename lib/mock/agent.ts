import { formatKm, formatUsd } from "@/lib/format";
import { AMBIGUOUS, NO_SERVICE, ROUTES, type RouteFixture } from "@/lib/mock/fixtures";
import type { Lang, Ticket } from "@/lib/types";

export interface MockReply {
  content: string;
  route?: RouteFixture;
}

function matchRoute(text: string): RouteFixture | undefined {
  const lower = text.toLowerCase();
  return ROUTES.find((route) => {
    const hasOrigin = lower.includes(route.origin.toLowerCase());
    const hasDestination = lower.includes(route.destination.toLowerCase());
    if (!hasOrigin || !hasDestination) return false;
    return lower.indexOf(route.origin.toLowerCase()) < lower.indexOf(route.destination.toLowerCase());
  });
}

function matchNoService(text: string): string | undefined {
  const lower = text.toLowerCase();
  return Object.keys(NO_SERVICE).find((city) => lower.includes(city.toLowerCase()));
}

function matchAmbiguous(text: string): string[] | undefined {
  const lower = text.toLowerCase();
  const key = Object.keys(AMBIGUOUS).find((name) => lower.includes(name));
  return key ? AMBIGUOUS[key] : undefined;
}

export function buildMockReply(text: string, lang: Lang, tickets: Ticket[]): MockReply {
  const zh = lang === "zh";

  if (/(ticket|booking|order|booked|票|订单|行程)/i.test(text)) {
    if (tickets.length === 0) {
      return {
        content: zh
          ? "你还没有预订过机票。告诉我出发城市和目的地，我可以先给你报价。"
          : "You have not booked any tickets yet. Tell me where you want to fly and I can quote a route.",
      };
    }
    const lines = tickets.map(
      (ticket) =>
        `• ${ticket.origin} → ${ticket.destination} · ${formatKm(ticket.totalDistanceKm)} · ${formatUsd(ticket.priceUsd)} · ${ticket.id}`,
    );
    return {
      content: zh
        ? `你一共预订了 ${tickets.length} 张机票：\n${lines.join("\n")}`
        : `You have ${tickets.length} ticket${tickets.length > 1 ? "s" : ""}:\n${lines.join("\n")}`,
    };
  }

  const noServiceCity = matchNoService(text);
  if (noServiceCity) {
    const { nearest, distanceKm } = NO_SERVICE[noServiceCity];
    return {
      content: zh
        ? `${noServiceCity} 目前没有航班服务。距离它最近且在运营的城市是 ${nearest}，约 ${distanceKm.toFixed(2)} km。需要我改查 ${nearest} 出发或到达的航班吗？`
        : `${noServiceCity} currently has no flight service. The nearest city we serve is ${nearest}, about ${distanceKm.toFixed(2)} km away. Shall I look up flights to or from ${nearest} instead?`,
    };
  }

  const ambiguous = matchAmbiguous(text);
  if (ambiguous) {
    return {
      content: zh
        ? `"${text.trim()}" 对应多个城市，请确认你要去的是哪一个：${ambiguous.join(" / ")}。`
        : `That name matches more than one city. Which one do you mean: ${ambiguous.join(" / ")}?`,
    };
  }

  const route = matchRoute(text);
  if (route) {
    const transferCities = route.legs.slice(0, -1).map((leg) => leg.to);
    const summary = zh
      ? `${route.origin} → ${route.destination} 的最便宜路线：共 ${route.legs.length} 段` +
        (transferCities.length ? `，在 ${transferCities.join("、")} 中转` : "，直飞") +
        `。总飞行距离 ${formatKm(route.totalDistanceKm)}，票价为 ${formatUsd(route.priceUsd)}。请核对下方行程，确认后我再出票。`
      : `Cheapest route from ${route.origin} to ${route.destination}: ${route.legs.length} leg${route.legs.length > 1 ? "s" : ""}` +
        (transferCities.length ? `, transfer at ${transferCities.join(", ")}` : ", direct") +
        `. Total distance ${formatKm(route.totalDistanceKm)}, price ${formatUsd(route.priceUsd)}. Review the itinerary below and confirm to book.`;
    return { content: summary, route };
  }

  return {
    content: zh
      ? "我可以帮你查询最便宜路线、解释行程与票价，或列出你已预订的机票。试试：「成都到 Split 最便宜的航班」「我订过哪些机票」。"
      : 'I can find the cheapest route, explain an itinerary and fare, or list your tickets. Try "cheapest flight from Chengdu to Split" or "what tickets have I booked".',
  };
}
