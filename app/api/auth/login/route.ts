import { NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/mock/store";
import { sessionCookie } from "@/lib/mock/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  const username = body?.username?.trim() ?? "";
  const password = body?.password ?? "";

  if (!username || !password) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const user = verifyCredentials(username, password);
  if (!user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const response = NextResponse.json({
    user: { username: user.username, displayName: user.displayName },
  });
  response.cookies.set(sessionCookie(user.username));
  return response;
}
