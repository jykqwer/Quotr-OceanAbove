import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db/app";
import { getConversation, listMessages } from "@/lib/store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const conversation = getConversation(db, user.id, id);
  const messages = listMessages(db, user.id, id);
  if (!conversation || !messages) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ conversation, messages });
}
