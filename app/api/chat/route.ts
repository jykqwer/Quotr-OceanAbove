import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent/loop";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db/app";
import { getGraph } from "@/lib/domain";
import {
  appendMessage,
  createConversation,
  createQuote,
  getConversation,
  getQuote,
  listMessages,
  listTickets,
} from "@/lib/store";
import type { Lang, Message, ToolTrace } from "@/lib/types";

const encoder = new TextEncoder();

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { conversationId?: string; text?: string; lang?: Lang; stream?: boolean }
    | null;

  const text = body?.text?.trim() ?? "";
  if (!text) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const lang: Lang = body?.lang === "zh" ? "zh" : "en";
  const db = getDb();
  const conversation =
    (body?.conversationId && getConversation(db, user.id, body.conversationId)) ||
    createConversation(db, user.id, text.slice(0, 48));

  const userMessage = appendMessage(db, conversation.id, { role: "user", content: text });

  // Prior turns give the model context; the user's own words stay untrusted input.
  const history = (listMessages(db, user.id, conversation.id) ?? [])
    .filter((message) => message.id !== userMessage.id)
    .map((message) => ({ role: message.role, content: message.content }));

  const run = (hooks: { onStep?: (trace: ToolTrace) => void; onDelta?: (chunk: string) => void }) =>
    runAgent({
      graph: getGraph(),
      db,
      userId: user.id,
      conversationId: conversation.id,
      text,
      lang,
      tickets: listTickets(db, user.id),
      history,
      createQuote: (route) =>
        createQuote(db, { userId: user.id, conversationId: conversation.id, route }),
      ...hooks,
    });

  const finalize = (out: Awaited<ReturnType<typeof runAgent>>) => {
    const assistantMessage = appendMessage(db, conversation.id, {
      role: "assistant",
      content: out.content,
      quoteId: out.quote?.id,
      tools: out.tools,
    });
    return {
      conversation: getConversation(db, user.id, conversation.id)!,
      userMessage,
      assistantMessage: withQuote(assistantMessage, out.quote?.id),
      passenger: user.displayName,
    };
  };

  if (!body?.stream) {
    return NextResponse.json(finalize(await run({})));
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send("user", userMessage);
        const out = await run({
          onStep: (trace) => send("step", trace),
          onDelta: (chunk) => send("delta", { text: chunk }),
        });
        send("done", finalize(out));
      } catch {
        send("error", { code: "chat_failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function withQuote(message: Message, quoteId?: string) {
  if (!quoteId) return message;
  const quote = getQuote(getDb(), quoteId);
  return quote ? { ...message, quote } : message;
}
