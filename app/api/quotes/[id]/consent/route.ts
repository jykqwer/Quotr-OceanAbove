import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db/app";
import { getQuoteHash, consentToQuote } from "@/lib/store";

/**
 * Step 1 of booking: the UI declares which quote snapshot it rendered and gets a
 * single-use nonce back. Nothing is issued here.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { snapshotHash?: string } | null;
  const snapshotHash = body?.snapshotHash ?? "";
  if (!snapshotHash) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { id } = await params;
  const db = getDb();
  const result = consentToQuote(db, { userId: user.id, quoteId: id, snapshotHash });
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : result.reason === "snapshot_mismatch" ? 409 : 409;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json({
    nonce: result.nonce,
    expiresAt: result.expiresAt,
    snapshotHash: getQuoteHash(db, id),
  });
}
