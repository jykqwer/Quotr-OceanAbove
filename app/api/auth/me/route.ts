import { NextResponse } from "next/server";
import { findUser } from "@/lib/mock/store";
import { getSessionUsername } from "@/lib/mock/session";

export async function GET() {
  const username = await getSessionUsername();
  if (!username) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const user = findUser(username);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    user: { username: user.username, displayName: user.displayName },
  });
}
