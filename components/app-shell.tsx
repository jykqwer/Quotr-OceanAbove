"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChatIcon, ListIcon, LogoutIcon, TicketIcon, WaveMark } from "@/components/icons";
import { LangSwitch } from "@/components/lang-switch";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/lang-provider";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/chat", labelKey: "nav.chat", Icon: ChatIcon },
  { href: "/tickets", labelKey: "nav.tickets", Icon: TicketIcon },
  { href: "/conversations", labelKey: "nav.conversations", Icon: ListIcon },
] as const;

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
    <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-5 sm:px-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
        <Link href="/chat" className="flex items-center gap-2.5">
          <WaveMark />
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-wide text-slate-50">
              {t("brand.name")}
            </span>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-500">
              {t("brand.tagline")}
            </span>
          </span>
        </Link>

        <nav className="order-3 flex w-full min-w-0 gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1 sm:order-none sm:ml-4 sm:w-auto">
          {NAV.map(({ href, labelKey, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                title={t(labelKey)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition sm:flex-none sm:px-3.5 ${
                  active
                    ? "bg-ocean-500/15 text-ocean-200 ring-1 ring-inset ring-ocean-400/30"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                }`}
              >
                <Icon className="h-[15px] w-[15px] shrink-0" />
                <span className="hidden whitespace-nowrap sm:inline">{t(labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LangSwitch />
          <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5 sm:flex">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-ocean-500/15 text-[10px] font-semibold uppercase text-ocean-200">
              {user.displayName.slice(0, 2)}
            </span>
            <span className="max-w-28 truncate text-xs text-slate-300">{user.displayName}</span>
          </div>
          <button type="button" onClick={handleSignOut} className="btn-quiet" title={t("nav.signOut")}>
            <LogoutIcon />
            <span className="hidden sm:inline">{t("nav.signOut")}</span>
          </button>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="pt-5 text-center text-[11px] text-slate-600">{t("footer.note")}</footer>
    </div>
  );
}
