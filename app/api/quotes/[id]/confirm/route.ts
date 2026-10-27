import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db/app";
import { confirmQuote } from "@/lib/store";

/**
 * Step 2 of booking: exchange a nonce for a ticket. Without a valid, unused,
 * unexpired nonce bound to this user, quote and snapshot, this always fails —
 * there is no other code path that inserts into `tickets`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { nonce?: string } | null;
  const nonce = body?.nonce ?? "";
  if (!nonce) return NextResponse.json({ error: "nonce_required" }, { status: 400 });

  const { id } = await params;
  const result = confirmQuote(getDb(), { userId: user.id, quoteId: id, nonce });
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 409;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json({ quote: result.quote, ticket: result.ticket });
}
