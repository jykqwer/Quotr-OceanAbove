import { NextResponse } from "next/server";
import { createConversation, listConversations } from "@/lib/mock/store";
import { getSessionUsername } from "@/lib/mock/session";

export async function GET() {
  const username = await getSessionUsername();
  if (!username) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({ conversations: listConversations(username) });
}

export async function POST(request: Request) {
  const username = await getSessionUsername();
  if (!username) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { title?: string } | null;
  const conversation = createConversation(username, body?.title?.trim() || "New conversation");
  return NextResponse.json({ conversation }, { status: 201 });
}
