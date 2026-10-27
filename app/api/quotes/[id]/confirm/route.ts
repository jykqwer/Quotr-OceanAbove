import { NextResponse } from "next/server";
import { confirmQuote, syncQuoteInMessages } from "@/lib/mock/store";
import { getSessionUsername } from "@/lib/mock/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const username = await getSessionUsername();
  if (!username) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { conversationId?: string }
    | null;
  const conversationId = body?.conversationId;
  if (!conversationId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { id } = await params;
  const result = confirmQuote(username, conversationId, id);
  if (!result) {
    return NextResponse.json({ error: "quote_unavailable" }, { status: 409 });
  }

  syncQuoteInMessages(conversationId, result.quote);
  return NextResponse.json({ quote: result.quote, ticket: result.ticket });
}
