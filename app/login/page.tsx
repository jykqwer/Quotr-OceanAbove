import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { LoginHero } from "@/components/login-hero";
import { SESSION_COOKIE } from "@/lib/mock/session";
import { findUser } from "@/lib/mock/store";

export default async function LoginPage() {
  const jar = await cookies();
  const username = jar.get(SESSION_COOKIE)?.value;
  if (username && findUser(username)) redirect("/chat");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1200px] items-center px-5 py-10 sm:px-8">
      <div className="grid w-full items-center gap-10 lg:grid-cols-[1.1fr_minmax(0,440px)] lg:gap-16">
        <LoginHero />
        <div className="flex justify-center lg:justify-end">
          <AuthForm />
        </div>
      </div>
    </div>
  );
}
