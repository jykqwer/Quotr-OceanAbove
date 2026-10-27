import { NextResponse } from "next/server";
import { buildReply } from "@/lib/agent/reply";
import { getGraph } from "@/lib/domain";
import { verifyRoute } from "@/lib/domain/verify";
import {
  appendMessage,
  createConversation,
  createQuoteForRoute,
  findUser,
  getConversation,
  listTickets,
} from "@/lib/mock/store";
import { getSessionUsername } from "@/lib/mock/session";
import type { Lang, Message, ToolTrace } from "@/lib/types";

export async function POST(request: Request) {
  const username = await getSessionUsername();
  if (!username) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { conversationId?: string; text?: string; lang?: Lang }
    | null;

  const text = body?.text?.trim() ?? "";
  if (!text) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const lang: Lang = body?.lang === "zh" ? "zh" : "en";
  const conversation =
    (body?.conversationId && getConversation(username, body.conversationId)) ||
    createConversation(username, text.slice(0, 48));

  const userMessage: Message = appendMessage(conversation.id, {
    conversationId: conversation.id,
    role: "user",
    content: text,
  });

  const tools: ToolTrace[] = [];
  const graph = getGraph();
  const report = (name: string, ok: boolean, ms: number) => tools.push({ name, ok, ms });

  const reply = buildReply(graph, text, lang, listTickets(username), report);

  const route = reply.kind === "route" ? reply.route : null;
  if (route) {
    const started = performance.now();
    verifyRoute(graph, route);
    report("verify_route", true, Math.round(performance.now() - started));
  }

  const quote = route
    ? (() => {
        const started = performance.now();
        const value = createQuoteForRoute(conversation.id, route);
        report("create_booking_quote", true, Math.round(performance.now() - started));
        return value;
      })()
    : undefined;

  const assistantMessage: Message = appendMessage(conversation.id, {
    conversationId: conversation.id,
    role: "assistant",
    content: reply.content,
    quote,
    tools,
  });

  return NextResponse.json({
    conversation: getConversation(username, conversation.id),
    userMessage,
    assistantMessage,
    passenger: findUser(username)?.displayName ?? username,
  });
}
