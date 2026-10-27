import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadNetwork } from "@/lib/db/locations";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ network: loadNetwork() });
}
