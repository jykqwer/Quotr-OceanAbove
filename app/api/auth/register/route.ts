import { NextResponse } from "next/server";
import { registerUser } from "@/lib/mock/store";
import { sessionCookie } from "@/lib/mock/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  const username = body?.username?.trim() ?? "";
  const password = body?.password ?? "";

  if (username.length < 3 || username.length > 32) {
    return NextResponse.json({ error: "bad_username" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "bad_password" }, { status: 400 });
  }

  try {
    const user = registerUser(username, password);
    const response = NextResponse.json({
      user: { username: user.username, displayName: user.displayName },
    });
    response.cookies.set(sessionCookie(user.username));
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "username_taken") {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }
    throw error;
  }
}
