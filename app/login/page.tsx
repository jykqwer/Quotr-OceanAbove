import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { LoginHero } from "@/components/login-hero";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadNetwork } from "@/lib/db/locations";
import { DEMO } from "@/lib/store/seed";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { stats } = loadNetwork();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1100px] items-center px-5 py-10 sm:px-8">
      <div className="grid w-full items-center gap-10 lg:grid-cols-[1.15fr_minmax(0,380px)] lg:gap-20">
        <LoginHero stats={stats} />
        <div className="flex justify-center lg:justify-end">
          <AuthForm demo={DEMO} />
        </div>
      </div>
    </div>
  );
}
