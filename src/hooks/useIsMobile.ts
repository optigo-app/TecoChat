"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// STANDARDIZED BREAKPOINTS
//
// The old CRA app used inconsistent breakpoints (480, 599, 600, 768, 769, 900,
// 992, 1000, 1200, 1440, 1620). This Next.js version uses a single,
// consistent scale. Every component MUST use these values (via the hooks or
// the CSS variables) so the responsive behavior is predictable.
//
// Mobile-first: design for `xs` first, then enhance at larger breakpoints.
// ─────────────────────────────────────────────────────────────────────────────

export const BREAKPOINTS = {
  xs: 0,      // Small phone (portrait)
  sm: 480,    // Large phone
  md: 768,    // Tablet (portrait) / large phone landscape
  lg: 1024,   // Tablet (landscape) / small laptop
  xl: 1440,   // Desktop
  xxl: 1920,  // Large desktop
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

// Keep in sync with --mobile-breakpoint / --tablet-breakpoint in globals.css
export const MOBILE_BREAKPOINT = BREAKPOINTS.md;   // 768
export const TABLET_BREAKPOINT = BREAKPOINTS.lg;    // 1024
export const DESKTOP_BREAKPOINT = BREAKPOINTS.xl;   // 1440

// ─────────────────────────────────────────────────────────────────────────────
// useBreakpoint — returns whether the viewport is at or below a breakpoint
// ─────────────────────────────────────────────────────────────────────────────

const useMediaQueryState = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener?.("change", update);
    return () => mql.removeEventListener?.("change", update);
  }, [query]);

  return matches;
};

/** True when viewport width <= the given breakpoint. */
export const useBreakpointDown = (key: BreakpointKey): boolean =>
  useMediaQueryState(`(max-width: ${BREAKPOINTS[key]}px)`);

/** True when viewport width >= the given breakpoint. */
export const useBreakpointUp = (key: BreakpointKey): boolean =>
  useMediaQueryState(`(min-width: ${BREAKPOINTS[key]}px)`);

// ─────────────────────────────────────────────────────────────────────────────
// useIsMobile / useIsTablet — convenience hooks (back-compat with earlier code)
// ─────────────────────────────────────────────────────────────────────────────

export const useIsMobile = (): boolean => useBreakpointDown("md");   // <= 768
export const useIsTablet = (): boolean => useBreakpointDown("lg");   // <= 1024

// ─────────────────────────────────────────────────────────────────────────────
// useResponsiveLayout — one hook that gives you everything about the current
// viewport. Use this instead of calling multiple useMediaQuery hooks.
// ─────────────────────────────────────────────────────────────────────────────

export interface ResponsiveLayout {
  /** Current viewport width in px (0 during SSR / before mount). */
  width: number;
  /** Current viewport height in px (0 during SSR / before mount). */
  height: number;
  /** Active breakpoint key (the largest breakpoint the viewport exceeds). */
  active: BreakpointKey;
  /** True on phones (<= 768px). */
  isMobile: boolean;
  /** True on tablets (769–1024px). */
  isTablet: boolean;
  /** True on desktops (>= 1025px). */
  isDesktop: boolean;
  /** True on large desktops (>= 1440px). */
  isLargeDesktop: boolean;
  /** True when viewport is in landscape orientation. */
  isLandscape: boolean;
  /** True when viewport is in portrait orientation. */
  isPortrait: boolean;
  /** True when the on-screen keyboard is likely open (height < 60% of width). */
  isKeyboardLikelyOpen: boolean;
}

const getActiveBreakpoint = (w: number): BreakpointKey => {
  if (w >= BREAKPOINTS.xxl) return "xxl";
  if (w >= BREAKPOINTS.xl) return "xl";
  if (w >= BREAKPOINTS.lg) return "lg";
  if (w >= BREAKPOINTS.md) return "md";
  if (w >= BREAKPOINTS.sm) return "sm";
  return "xs";
};

export const useResponsiveLayout = (): ResponsiveLayout => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    // Use ResizeObserver on document.body for more reliable updates than
    // the resize event (handles mobile browser chrome show/hide).
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    window.addEventListener?.("resize", update);
    window.addEventListener?.("orientationchange", update);
    return () => {
      ro.disconnect();
      window.removeEventListener?.("resize", update);
      window.removeEventListener?.("orientationchange", update);
    };
  }, []);

  const { width, height } = size;
  const isLandscape = width > height && width > 0;
  const isPortrait = !isLandscape && width > 0;
  // Heuristic: if height is less than 55% of width on mobile, the keyboard
  // is probably open. This lets us adjust layouts (e.g. hide bottom nav).
  const isKeyboardLikelyOpen =
    width > 0 && height > 0 && width <= MOBILE_BREAKPOINT && height < width * 0.55;

  return {
    width,
    height,
    active: getActiveBreakpoint(width),
    isMobile: width > 0 && width <= MOBILE_BREAKPOINT,
    isTablet: width > MOBILE_BREAKPOINT && width <= TABLET_BREAKPOINT,
    isDesktop: width > TABLET_BREAKPOINT,
    isLargeDesktop: width >= DESKTOP_BREAKPOINT,
    isLandscape,
    isPortrait,
    isKeyboardLikelyOpen,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// useSwipe — lightweight swipe gesture detection for mobile navigation.
// Returns a ref to attach to a DOM element and the last swipe direction.
//
// Usage:
//   const { ref, direction } = useSwipe();
//   useEffect(() => {
//     if (direction === "right") router.back();
//   }, [direction]);
// ─────────────────────────────────────────────────────────────────────────────

export interface SwipeResult {
  ref: React.RefObject<HTMLElement | null>;
  direction: "left" | "right" | "up" | "down" | null;
  distance: number;
}

export const useSwipe = (threshold = 50): SwipeResult => {
  const ref = useRef<HTMLElement | null>(null);
  const [direction, setDirection] = useState<SwipeResult["direction"]>(null);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let startT = 0;

    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = Date.now();
      setDirection(null);
    };

    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      const dt = Date.now() - startT;
      // Only register swipes that are fast enough and travel far enough
      if (dt > 500) return;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (adx < threshold && ady < threshold) return;
      if (adx > ady) {
        setDirection(dx > 0 ? "right" : "left");
        setDistance(adx);
      } else {
        setDirection(dy > 0 ? "down" : "up");
        setDistance(ady);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [threshold]);

  return { ref, direction, distance };
};

// ─────────────────────────────────────────────────────────────────────────────
// useOrientationLock — returns the current orientation and whether it changed.
// Useful for showing "rotate your device" prompts on mobile.
// ─────────────────────────────────────────────────────────────────────────────

export const useOrientation = () => {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      setOrientation(window.innerHeight > window.innerWidth ? "portrait" : "landscape");
    };
    update();
    window.addEventListener?.("resize", update);
    window.addEventListener?.("orientationchange", update);
    return () => {
      window.removeEventListener?.("resize", update);
      window.removeEventListener?.("orientationchange", update);
    };
  }, []);

  return orientation;
};

// ─────────────────────────────────────────────────────────────────────────────
// useDebouncedResize — debounced viewport size for expensive computations.
// ─────────────────────────────────────────────────────────────────────────────

export const useDebouncedResize = (delay = 150) => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setSize({ width: window.innerWidth, height: window.innerHeight });
      }, delay);
    };
    update();
    window.addEventListener?.("resize", update);
    window.addEventListener?.("orientationchange", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener?.("resize", update);
      window.removeEventListener?.("orientationchange", update);
    };
  }, [delay]);

  return size;
};
