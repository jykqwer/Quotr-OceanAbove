import { NextResponse } from "next/server";
import { getConversation, listMessages } from "@/lib/mock/store";
import { getSessionUsername } from "@/lib/mock/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const username = await getSessionUsername();
  if (!username) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const conversation = getConversation(username, id);
  const messages = listMessages(username, id);
  if (!conversation || !messages) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ conversation, messages });
}
