"use client";

/**
 * usePullToRefresh — app-like pull-to-refresh for a scroll container.
 *
 * The app disables native pull-refresh (`overscroll-behavior-y: none` on
 * body, and installed PWAs have no native PTR anyway), so this implements
 * the gesture manually:
 *   - Engages only when the container is scrolled to the very top.
 *   - Pull distance applies 0.45x resistance and caps at MAX_PULL.
 *   - Releasing past THRESHOLD runs onRefresh and pins the spinner until
 *     the promise settles; releasing early snaps back.
 *
 * touchmove must be non-passive so we can preventDefault() the native
 * scroll while the pull indicator is out.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

export const PTR_THRESHOLD = 72; // pull distance needed to trigger refresh
export const PTR_MAX_PULL = 120; // visual cap for the indicator
const RESISTANCE = 0.45;

interface UsePullToRefreshOptions {
  onRefresh: () => void | Promise<unknown>;
  /** e.g. disable while a full-screen overlay is open */
  disabled?: boolean;
}

export function usePullToRefresh(
  ref: RefObject<HTMLElement | null>,
  { onRefresh, disabled = false }: UsePullToRefreshOptions
) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);
  const pullRef = useRef(0);
  const triggeredHapticRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (el.scrollTop <= 0) {
        startYRef.current = e.touches[0].clientY;
        pullingRef.current = true;
        triggeredHapticRef.current = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startYRef.current;

      // User pushed back up or the list started scrolling — cancel.
      if (dy <= 0 || el.scrollTop > 0) {
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPull(0);
        }
        pullingRef.current = false;
        return;
      }

      // Past the first few pixels, take over the gesture.
      if (dy > 8) {
        e.preventDefault();
        const next = Math.min(dy * RESISTANCE, PTR_MAX_PULL);
        pullRef.current = next;
        setPull(next);
        if (next >= PTR_THRESHOLD && !triggeredHapticRef.current) {
          triggeredHapticRef.current = true;
          try {
            navigator.vibrate?.(10);
          } catch {
            /* ignore */
          }
        }
      }
    };

    const onTouchEnd = () => {
      if (!pullingRef.current && !refreshingRef.current) return;
      pullingRef.current = false;

      if (pullRef.current >= PTR_THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        // Keep the indicator docked at threshold height while refreshing.
        pullRef.current = PTR_THRESHOLD;
        setPull(PTR_THRESHOLD);
        Promise.resolve(onRefreshRef.current())
          .catch(() => {})
          .finally(() => {
            refreshingRef.current = false;
            pullRef.current = 0;
            setRefreshing(false);
            setPull(0);
          });
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [ref, disabled]);

  return { pull, refreshing };
}
