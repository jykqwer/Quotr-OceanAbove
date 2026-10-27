"use client";

import { useEffect, useRef, useState } from "react";
import { SendIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/lang-provider";

export function ChatComposer({
  onSend,
  disabled = false,
  showPlaceholder = true,
}: {
  onSend: (text: string) => void | Promise<void>;
  disabled?: boolean;
  /** Once a conversation exists the hint text is noise, so callers can drop it. */
  showPlaceholder?: boolean;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 132)}px`;
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    setValue("");
    void onSend(text);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex items-stretch border border-white/15 bg-abyss-950 focus-within:border-ocean-400"
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={showPlaceholder ? t("chat.placeholder") : undefined}
        aria-label={t("chat.placeholder")}
        className="max-h-32 min-h-[42px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[14px] leading-relaxed text-slate-100 outline-none placeholder:text-slate-600 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        aria-label={t("chat.send")}
        className="flex w-12 shrink-0 items-center justify-center border-l border-white/10 bg-sunset-500 text-abyss-950 transition-colors hover:bg-sunset-400 disabled:bg-transparent disabled:text-slate-600"
      >
        <SendIcon className="h-4 w-4" />
      </button>
    </form>
  );
}
