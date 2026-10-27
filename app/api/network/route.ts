import { NextResponse } from "next/server";
import { loadNetwork } from "@/lib/db/locations";
import { getSessionUsername } from "@/lib/mock/session";

export async function GET() {
  const username = await getSessionUsername();
  if (!username) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({ network: loadNetwork() });
}
