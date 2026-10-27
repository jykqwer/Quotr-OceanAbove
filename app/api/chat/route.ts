import { NextResponse } from "next/server";
import { buildReply } from "@/lib/agent/reply";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db/app";
import { getGraph } from "@/lib/domain";
import { verifyRoute } from "@/lib/domain/verify";
import { appendMessage, createConversation, createQuote, getConversation, getQuote, listTickets } from "@/lib/store";
import type { Lang, ToolTrace } from "@/lib/types";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { conversationId?: string; text?: string; lang?: Lang }
    | null;

  const text = body?.text?.trim() ?? "";
  if (!text) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const lang: Lang = body?.lang === "zh" ? "zh" : "en";
  const db = getDb();
  const conversation =
    (body?.conversationId && getConversation(db, user.id, body.conversationId)) ||
    createConversation(db, user.id, text.slice(0, 48));

  const userMessage = appendMessage(db, conversation.id, { role: "user", content: text });

  const tools: ToolTrace[] = [];
  const report = (name: string, ok: boolean, ms: number) => tools.push({ name, ok, ms });

  const graph = getGraph();
  const reply = buildReply(graph, text, lang, listTickets(db, user.id), report);

  const route = reply.kind === "route" ? reply.route : null;
  if (route) {
    const started = performance.now();
    verifyRoute(graph, route);
    report("verify_route", true, Math.round(performance.now() - started));
  }

  let quoteId: string | undefined;
  if (route) {
    const started = performance.now();
    const quote = createQuote(db, { userId: user.id, conversationId: conversation.id, route });
    quoteId = quote.id;
    report("create_booking_quote", true, Math.round(performance.now() - started));
  }

  const assistantMessage = appendMessage(db, conversation.id, {
    role: "assistant",
    content: reply.content,
    quoteId,
    tools,
  });

  return NextResponse.json({
    conversation: getConversation(db, user.id, conversation.id),
    userMessage,
    assistantMessage: { ...assistantMessage, quote: quoteId ? getQuote(db, quoteId) ?? undefined : undefined },
    passenger: user.displayName,
  });
}
