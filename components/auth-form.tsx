"use client";

import { ArrowRightIcon, WaveMark } from "@/components/icons";
import { LangSwitch } from "@/components/lang-switch";
import { ApiError, api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/lang-provider";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "signin" | "signup";

export function AuthForm({ demo }: { demo: { username: string; password: string } }) {
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
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[380px]">
      <div className="mb-4 flex items-center justify-between sm:hidden">
        <WaveMark className="h-7 w-7" />
        <LangSwitch />
      </div>

      <div className="border border-white/10 bg-abyss-900">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <span className="col-head">
            {mode === "signin" ? t("auth.signInTitle") : t("auth.signUpTitle")}
          </span>
          <span className="hidden sm:block">
            <LangSwitch />
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-4 py-4">
          <div>
            <label htmlFor="username" className="col-head mb-1.5 block">
              {t("auth.username")}
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              className="field mono"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={t("auth.usernamePlaceholder")}
            />
          </div>

          <div>
            <label htmlFor="password" className="col-head mb-1.5 block">
              {t("auth.password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="field mono"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
            />
          </div>

          {error && (
            <p className="border-l-2 border-rose-400/60 bg-rose-500/[0.06] px-2 py-1.5 text-[11px] text-rose-300">
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
            <ArrowRightIcon className="h-3 w-3" />
          </button>
        </form>

        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-2">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="text-[11px] uppercase tracking-[0.1em] text-slate-500 transition-colors hover:text-ocean-300"
          >
            {mode === "signin" ? t("auth.switchToSignUp") : t("auth.switchToSignIn")}
          </button>
          <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-700">
            {t("auth.demoTitle")}
          </span>
        </div>

        <p className="mono border-t border-white/10 px-4 py-2 text-[10.5px] text-slate-500">
          {demo.username} · {demo.password}
        </p>
      </div>
    </div>
  );
}
