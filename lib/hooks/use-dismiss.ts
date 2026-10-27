"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Closes a popover on Escape or on a pointer press outside every element it
 * lives in. Pass both the trigger wrapper and the panel itself: the panel is
 * portalled to `document.body`, so it is not inside the wrapper.
 */
export function useDismiss(
  open: boolean,
  refs: RefObject<HTMLElement | null>[],
  close: () => void,
): void {
  // Callers pass a fresh array literal each render; keep the latest one without
  // re-binding the listeners on every keystroke.
  const latest = useRef(refs);
  latest.current = refs;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (latest.current.some((ref) => ref.current?.contains(target))) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);
}
