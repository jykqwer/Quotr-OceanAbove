"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, WaveMark } from "@/components/icons";
import { LangSwitch } from "@/components/lang-switch";
import { ApiError, api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/lang-provider";

type Mode = "signin" | "signup";

export function AuthForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function describeError(cause: unknown): string {
    if (cause instanceof ApiError) {
      switch (cause.code) {
        case "invalid_credentials":
          return t("auth.errInvalid");
        case "username_taken":
          return t("auth.errTaken");
        case "bad_username":
          return t("auth.errUsername");
        case "bad_password":
          return t("auth.errPassword");
        default:
          return t("auth.errGeneric");
      }
    }
    return t("auth.errGeneric");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const name = username.trim();
    if (name.length < 3 || name.length > 32) {
      setError(t("auth.errUsername"));
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError(t("auth.errPassword"));
      return;
    }
    if (password.length === 0) {
      setError(t("auth.errInvalid"));
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        await api.login(name, password);
      } else {
        await api.register(name, password);
      }
      router.replace("/chat");
      router.refresh();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <WaveMark className="h-8 w-8" />
          <span className="text-sm font-semibold tracking-wide text-slate-50">
            {t("brand.name")}
          </span>
        </div>
        <LangSwitch />
      </div>

      <div className="card p-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-50">
          {mode === "signin" ? t("auth.signInTitle") : t("auth.signUpTitle")}
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
          {mode === "signin" ? t("auth.subtitle") : t("auth.signUpSubtitle")}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="username" className="label">
              {t("auth.username")}
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              className="field"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={t("auth.usernamePlaceholder")}
            />
          </div>

          <div>
            <label htmlFor="password" className="label">
              {t("auth.password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="field"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy
              ? mode === "signin"
                ? t("auth.signingIn")
                : t("auth.creating")
              : mode === "signin"
                ? t("auth.signIn")
                : t("auth.signUp")}
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="mt-4 w-full text-center text-[12px] text-slate-400 transition hover:text-ocean-200"
        >
          {mode === "signin" ? t("auth.switchToSignUp") : t("auth.switchToSignIn")}
        </button>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
        <span className="mt-0.5 rounded-md bg-sand/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sand">
          {t("auth.demoTitle")}
        </span>
        <p className="font-mono text-[11px] leading-relaxed text-slate-400">{t("auth.demoHint")}</p>
      </div>
    </div>
  );
}
