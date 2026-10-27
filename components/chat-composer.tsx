"use client";

import { useEffect, useRef, useState } from "react";
import { SendIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/lang-provider";

export function ChatComposer({
  onSend,
  disabled = false,
}: {
  onSend: (text: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
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
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 transition focus-within:border-ocean-400/40 focus-within:ring-2 focus-within:ring-ocean-500/20"
    >
      <div className="flex items-end gap-2">
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
          placeholder={t("chat.placeholder")}
          className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2.5 text-[13.5px] leading-relaxed text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled || value.trim().length === 0}
          aria-label={t("chat.send")}
          className="btn-primary h-10 w-10 shrink-0 rounded-xl p-0"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
