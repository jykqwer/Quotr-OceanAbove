import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db/app";
import { createConversation, searchConversations } from "@/lib/store";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit"));

  const page = searchConversations(getDb(), user.id, {
    search: url.searchParams.get("q") ?? "",
    cursor: url.searchParams.get("cursor"),
    limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
  });

  return NextResponse.json(page);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { title?: string } | null;
  const conversation = createConversation(getDb(), user.id, body?.title?.trim() || "New conversation");
  return NextResponse.json({ conversation }, { status: 201 });
}
