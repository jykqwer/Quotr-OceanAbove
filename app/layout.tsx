import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { LangProvider } from "@/lib/i18n/lang-provider";
import { normalizeLang } from "@/lib/i18n/dictionary";

export const metadata: Metadata = {
  title: "Ocean Above · Flight booking",
  description:
    "Natural-language flight booking for Ocean Above. Cheapest routes, transparent fares, confirmation before every ticket.",
};

export const viewport: Viewport = {
  themeColor: "#050d16",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const lang = normalizeLang(jar.get("quotr_lang")?.value);

  return (
    <html lang={lang === "zh" ? "zh-CN" : "en"}>
      <body className="min-h-screen font-sans text-slate-100">
        <LangProvider initialLang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
