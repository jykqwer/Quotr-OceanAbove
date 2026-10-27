"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

/**
 * Anchors a popover to a trigger and returns the fixed-position style to apply.
 *
 * Two things make this more than a subtraction:
 * - `absolute` is not enough. These popovers are opened from inside the booking
 *   panel, which scrolls (`overflow-y-auto`), so an absolute panel taller than
 *   the space left in it gets clipped — the calendar's hour and minute columns
 *   were unreachable — and it also inflates that container's scroll height.
 *   Render the panel through a portal and position it `fixed`.
 * - The trigger keeps moving after the first paint: the map settles into its
 *   aspect box, fonts load, the panel scrolls. A single measurement therefore
 *   left the panel ~200px below the field (it "flashed, then dropped"). Place in
 *   a layout effect (before the first paint), then follow scroll, resize, the
 *   trigger's own size, and — for ~20 frames — any layout shift above it.
 */
export function useAnchoredPanel(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  panelHeight: number,
  minWidth: number,
  maxWidth = Number.POSITIVE_INFINITY,
): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(undefined);
      return;
    }

    let last: CSSProperties | undefined;

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
      const left = Math.max(Math.min(rect.left, window.innerWidth - width - 8), 8);

      const next: CSSProperties = { position: "fixed", top, left, width, zIndex: 60 };
      const unchanged =
        last && last.top === next.top && last.left === next.left && last.width === next.width;
      if (unchanged) return;
      last = next;
      setStyle(next);
    };

    place();

    const follow = () => place();
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);

    const trigger = triggerRef.current;
    const observer =
      trigger && typeof ResizeObserver !== "undefined" ? new ResizeObserver(follow) : null;
    if (trigger && observer) observer.observe(trigger);

    // Layout above the trigger can shift without any scroll or resize event
    // (the map settling into its aspect box, a font swap, the thread growing).
    // Follow the trigger for about a second: every frame while the tab is
    // visible, plus two timeouts so it still corrects in a throttled tab.
    let frame = 0;
    let ticks = 0;
    const watch = () => {
      place();
      ticks += 1;
      if (ticks < 60) frame = requestAnimationFrame(watch);
    };
    frame = requestAnimationFrame(watch);
    const late = [setTimeout(place, 300), setTimeout(place, 900)];

    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
      observer?.disconnect();
      cancelAnimationFrame(frame);
      for (const id of late) clearTimeout(id);
    };
  }, [maxWidth, minWidth, open, panelHeight, triggerRef]);

  return style;
}
