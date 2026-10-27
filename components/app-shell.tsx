"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChatIcon, HomeIcon, LogoutIcon, TicketIcon, WaveMark } from "@/components/icons";
import { LangSwitch } from "@/components/lang-switch";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/", labelKey: "nav.home", Icon: HomeIcon },
  { href: "/chat", labelKey: "nav.chat", Icon: ChatIcon },
  { href: "/tickets", labelKey: "nav.tickets", Icon: TicketIcon },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await api.logout().catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-abyss-950">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-3 px-4 sm:gap-6 sm:px-6 2xl:max-w-[1800px]">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <WaveMark className="h-7 w-7" />
            <span className="hidden flex-col leading-none sm:flex">
              <span className="text-[13px] font-semibold uppercase tracking-[0.22em] text-slate-100">
                {t("brand.name")}
              </span>
              <span className="mt-1 text-[9.5px] uppercase tracking-[0.24em] text-slate-600">
                {t("brand.tagline")}
              </span>
            </span>
          </Link>

          <nav className="flex min-w-0 flex-1 items-stretch gap-1 self-stretch">
            {NAV.map(({ href, labelKey, Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-2.5 text-[12px] uppercase tracking-[0.14em] transition-colors sm:px-3.5 ${
                    active
                      ? "border-sunset-500 text-slate-50"
                      : "border-transparent text-slate-500 hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{t(labelKey)}</span>
                  <span className="sr-only sm:hidden">{t(labelKey)}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <LangSwitch />
            <span className="hidden items-center gap-2 border-l border-white/10 pl-3 lg:flex">
              <span className="text-[10.5px] uppercase tracking-[0.16em] text-slate-600">
                {t("nav.signedIn")}
              </span>
              <span className="mono text-[12px] text-slate-300">{user.displayName}</span>
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              title={t("nav.signOut")}
              aria-label={t("nav.signOut")}
              className="flex h-7 w-7 items-center justify-center border border-white/10 text-slate-500 transition-colors hover:border-white/25 hover:text-slate-200"
            >
              <LogoutIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6 sm:py-6 2xl:max-w-[1800px]">{children}</main>
    </div>
  );
}
