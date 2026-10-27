"use client";

import { ArrowRightIcon, WaveMark } from "@/components/icons";
import { LangSwitch } from "@/components/lang-switch";
import { ApiError, api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/lang-provider";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "signin" | "signup";
type Field = "username" | "password" | "displayName";
/** Errors are stored as keys so switching language re-renders them translated. */
type ErrorKey =
  | "auth.errUsername"
  | "auth.errPassword"
  | "auth.errDisplayName"
  | "auth.errTaken"
  | "auth.errInvalid"
  | "auth.errGeneric";

/** Sign-up only: 8–16 letters or digits. Login accepts whatever was stored. */
const ACCOUNT_NAME = /^[A-Za-z0-9]{8,16}$/;
const ACCOUNT_PASSWORD = /^[A-Za-z0-9]{8,16}$/;
/** Any script, spaces, hyphens, one character — the cap only stops overflow. */
const DISPLAY_NAME_MAX = 48;

export function AuthForm({ demo }: { demo: { username: string; password: string } }) {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ fields: Partial<Record<Field, ErrorKey>>; form: ErrorKey | null }>({
    fields: {},
    form: null,
  });

  function describeError(cause: unknown): { field?: Field; key: ErrorKey } {
    if (cause instanceof ApiError) {
      switch (cause.code) {
        case "invalid_credentials":
          return { key: "auth.errInvalid" };
        case "username_taken":
          return { field: "username", key: "auth.errTaken" };
        case "bad_username":
          return { field: "username", key: "auth.errUsername" };
        case "bad_password":
          return { field: "password", key: "auth.errPassword" };
        case "bad_display_name":
          return { field: "displayName", key: "auth.errDisplayName" };
        default:
          return { key: "auth.errGeneric" };
      }
    }
    return { key: "auth.errGeneric" };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({ fields: {}, form: null });

    const name = username.trim();
    const fullName = displayName.trim();
    if (mode === "signup") {
      const fields: Partial<Record<Field, ErrorKey>> = {};
      if (!ACCOUNT_NAME.test(name)) fields.username = "auth.errUsername";
      if (!ACCOUNT_PASSWORD.test(password)) fields.password = "auth.errPassword";
      if (fullName.length === 0) fields.displayName = "auth.errDisplayName";
      if (Object.keys(fields).length > 0) {
        setErrors({ fields, form: null });
        return;
      }
    }
    if (name.length === 0 || password.length === 0) {
      setErrors({ fields: {}, form: "auth.errInvalid" });
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        await api.login(name, password);
      } else {
        await api.register(name, password, fullName);
      }
      router.replace("/");
      router.refresh();
    } catch (cause) {
      const { field, key } = describeError(cause);
      setErrors(field ? { fields: { [field]: key }, form: null } : { fields: {}, form: key });
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
              aria-invalid={errors.fields.username ? true : undefined}
              aria-describedby={
                errors.fields.username
                  ? "username-error"
                  : mode === "signup"
                    ? "username-rules"
                    : undefined
              }
            />
            {errors.fields.username ? (
              <p id="username-error" className="mt-1 text-[12.5px] leading-relaxed text-rose-300">
                {t(errors.fields.username)}
              </p>
            ) : (
              mode === "signup" && (
                <p id="username-rules" className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
                  {t("auth.usernameRules")}
                </p>
              )
            )}
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
              aria-invalid={errors.fields.password ? true : undefined}
              aria-describedby={
                errors.fields.password
                  ? "password-error"
                  : mode === "signup"
                    ? "password-rules"
                    : undefined
              }
            />
            {errors.fields.password ? (
              <p id="password-error" className="mt-1 text-[12.5px] leading-relaxed text-rose-300">
                {t(errors.fields.password)}
              </p>
            ) : (
              mode === "signup" && (
                <p id="password-rules" className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
                  {t("auth.passwordRules")}
                </p>
              )
            )}
          </div>

          {mode === "signup" && (
            <div>
              <label htmlFor="displayName" className="col-head mb-1.5 block">
                {t("auth.displayName")}
              </label>
              <input
                id="displayName"
                name="displayName"
                autoComplete="name"
                maxLength={DISPLAY_NAME_MAX}
                className="field"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                aria-invalid={errors.fields.displayName ? true : undefined}
                aria-describedby={errors.fields.displayName ? "displayName-error" : undefined}
              />
              {errors.fields.displayName && (
                <p id="displayName-error" className="mt-1 text-[12.5px] leading-relaxed text-rose-300">
                  {t(errors.fields.displayName)}
                </p>
              )}
            </div>
          )}

          {errors.form && (
            <p className="border-l-2 border-rose-400/60 bg-rose-500/[0.06] px-2 py-1.5 text-[13px] text-rose-300">
              {t(errors.form)}
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

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-2">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setErrors({ fields: {}, form: null });
            }}
            className="text-[13px] uppercase tracking-[0.1em] text-slate-500 transition-colors hover:text-ocean-300"
          >
            {mode === "signin" ? t("auth.switchToSignUp") : t("auth.switchToSignIn")}
          </button>
        </div>

        <p className="border-t border-white/10 px-4 py-2 text-right text-[13.5px] text-slate-500">
          {t("auth.demoLine", { username: demo.username, password: demo.password })}
        </p>
      </div>
    </div>
  );
}
