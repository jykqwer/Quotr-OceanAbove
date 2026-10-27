import { NextResponse } from "next/server";
import { listTickets } from "@/lib/mock/store";
import { getSessionUsername } from "@/lib/mock/session";

export async function GET() {
  const username = await getSessionUsername();
  if (!username) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({ tickets: listTickets(username) });
}
