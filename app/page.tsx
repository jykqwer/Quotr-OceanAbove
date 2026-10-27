import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/mock/session";
import { findUser } from "@/lib/mock/store";

export default async function RootPage() {
  const jar = await cookies();
  const username = jar.get(SESSION_COOKIE)?.value;
  const user = username ? findUser(username) : undefined;
  redirect(user ? "/chat" : "/login");
}
