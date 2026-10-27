import { NextResponse } from "next/server";
import { buildMockReply } from "@/lib/mock/agent";
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

  const reply = buildMockReply(text, lang, listTickets(username));
  const quote = reply.route ? createQuoteForRoute(conversation.id, reply.route) : undefined;

  const tools: ToolTrace[] = [];
  if (reply.route) {
    tools.push(
      { name: "resolve_city", ok: true, ms: 6 },
      { name: "find_route", ok: true, ms: 14 },
      { name: "create_booking_quote", ok: true, ms: 11 },
    );
  } else if (quote === undefined && /(ticket|booking|order|booked|票|订单|行程)/i.test(text)) {
    tools.push({ name: "list_tickets", ok: true, ms: 8 });
  } else {
    tools.push({ name: "resolve_city", ok: true, ms: 5 });
  }

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
