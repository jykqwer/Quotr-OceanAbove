"use client";

import { useEffect, type RefObject } from "react";

/**
 * Closes a popover on Escape or on a pointer press outside its root.
 * `close` must be stable (wrap it in useCallback) so the listeners are not
 * re-bound on every render.
 */
export function useDismiss(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  close: () => void,
): void {
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
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
  }, [close, open, rootRef]);
}
