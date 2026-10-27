"use client";

import { useEffect, useState, type CSSProperties, type RefObject } from "react";

/**
 * Anchors a fixed-position popover to a trigger.
 *
 * `absolute` is not enough: these popovers live inside the booking panel, which
 * scrolls (`overflow-y-auto`), so a panel taller than the space left inside it
 * would be clipped — the calendar's hour and minute columns simply were not
 * reachable. Fixed positioning escapes the clip; this hook keeps it glued to
 * the trigger and flips it above when there is no room below.
 */
export function useAnchoredPanel(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  panelHeight: number,
  minWidth: number,
  maxWidth = Number.POSITIVE_INFINITY,
): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);

  useEffect(() => {
    if (!open) {
      setStyle(undefined);
      return;
    }

    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(
        Math.max(rect.width, minWidth),
        maxWidth,
        Math.max(window.innerWidth - 16, 200),
      );
      const roomBelow = window.innerHeight - rect.bottom;
      const roomAbove = rect.top;
      const dropUp = roomBelow < panelHeight + 12 && roomAbove > roomBelow;
      const top = dropUp
        ? Math.max(rect.top - panelHeight - 6, 8)
        : Math.min(rect.bottom + 6, Math.max(window.innerHeight - panelHeight - 8, 8));
      const left = Math.min(rect.left, window.innerWidth - width - 8);

      setStyle({
        position: "fixed",
        top,
        left: Math.max(left, 8),
        width,
        zIndex: 60,
      });
    };

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [maxWidth, minWidth, open, panelHeight, triggerRef]);

  return style;
}
