import { NextResponse } from "next/server";
import { itinerarySummary } from "@/lib/agent/reply";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db/app";
import { getGraph } from "@/lib/domain";
import { ItineraryError, MAX_JOURNEYS, buildItinerary, type JourneyRequest } from "@/lib/domain/itinerary";
import {
  appendMessage,
  createConversation,
  createQuote,
  getConversation,
  getQuote,
} from "@/lib/store";
import type { Lang, ToolTrace } from "@/lib/types";

/**
 * Structured booking (the home form). Same domain path as the agent, but no
 * model in the loop: the city pairs and traveller names come from real form
 * fields, so there is nothing to interpret.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | {
        conversationId?: string;
        journeys?: JourneyRequest[];
        passengers?: string[];
        departAt?: string;
        lang?: Lang;
      }
    | null;

  const journeys = (body?.journeys ?? [])
    .filter((item) => item && typeof item.origin === "string" && typeof item.destination === "string")
    .slice(0, MAX_JOURNEYS);
  if (journeys.length === 0) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const lang: Lang = body?.lang === "zh" ? "zh" : "en";
  const db = getDb();

  let itinerary;
  try {
    itinerary = buildItinerary(getGraph(), {
      journeys,
      passengers: body?.passengers?.length ? body.passengers : [user.displayName],
      departAt: body?.departAt,
    });
  } catch (cause) {
    const reason = cause instanceof ItineraryError ? cause.code : "itinerary_failed";
    const status = reason === "no_route" ? 422 : 400;
    return NextResponse.json({ error: reason }, { status });
  }

  const title = itinerary.journeys
    .map((journey) => `${journey.origin} → ${journey.destination}`)
    .join(" · ")
    .slice(0, 60);
  const conversation =
    (body?.conversationId && getConversation(db, user.id, body.conversationId)) ||
    createConversation(db, user.id, title);

  const userMessage = appendMessage(db, conversation.id, {
    role: "user",
    content: title + (itinerary.passengers.length > 1 ? ` · ${itinerary.passengers.join(", ")}` : ""),
  });

  const tools: ToolTrace[] = [
    { name: "find_itinerary", ok: true, ms: 0 },
    { name: "create_booking_quote", ok: true, ms: 0 },
  ];
  const quote = createQuote(db, { userId: user.id, conversationId: conversation.id, itinerary });
  const assistantMessage = appendMessage(db, conversation.id, {
    role: "assistant",
    content: itinerarySummary(itinerary, lang),
    quoteId: quote.id,
    tools,
  });

  return NextResponse.json({
    conversation: getConversation(db, user.id, conversation.id)!,
    userMessage,
    assistantMessage: { ...assistantMessage, quote: getQuote(db, quote.id) ?? undefined },
    passenger: user.displayName,
  });
}
