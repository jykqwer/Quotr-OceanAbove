import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SESSION_COOKIE } from "@/lib/mock/session";
import { findUser } from "@/lib/mock/store";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  const username = jar.get(SESSION_COOKIE)?.value;
  const user = username ? findUser(username) : undefined;

  if (!user) redirect("/login");

  return (
    <AppShell user={{ username: user.username, displayName: user.displayName }}>
      {children}
    </AppShell>
  );
}
