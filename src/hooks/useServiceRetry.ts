"use client";

// ─── useServiceRetry ────────────────────────────────────────────────────────
// Phased retry strategy for service-down detection:
//
//  1. SILENT phase: When SERVICE_DOWN fires, silently retry 3 times (2s apart).
//     If any succeeds, don't show the maintenance page at all.
//     If all 3 fail → show maintenance page, enter AUTO-1 phase.
//
//  2. AUTO-1 phase: Auto-retry every 1 minute, 3 times.
//     If any succeeds, hide the page.
//     If all 3 fail → advance to AUTO-5 phase.
//
//  3. AUTO-5 phase: Auto-retry every 5 minutes, 3 times.
//     If any succeeds, hide the page.
//     If all 3 fail → STOPPED phase.
//
//  4. STOPPED: Stop auto-trying. User must click "Try Again Now" manually.
//     This triggers the MANUAL phase: 5 rapid retries (1s apart).
//     If all 5 fail → back to AUTO-1 phase.

import { useCallback, useEffect, useRef, useState } from "react";

export type RetryPhase = "silent" | "auto-1" | "auto-5" | "stopped" | "manual";

export interface ServiceRetryState {
  /** Whether the maintenance page should be visible */
  showMaintenancePage: boolean;
  /** Current retry phase */
  phase: RetryPhase;
  /** Attempt number within the current phase (1-based) */
  attempt: number;
  /** Max attempts in the current phase */
  maxAttempts: number;
  /** Seconds until next auto-retry (for countdown display) */
  countdown: number;
  /** Total seconds for the current countdown interval */
  countdownMax: number;
  /** Whether a retry check is in progress right now */
  checking: boolean;
}

interface UseServiceRetryOptions {
  /** Called when the server is confirmed back up */
  onServiceUp?: () => void;
}

// Phase configuration: maxAttempts, interval between attempts (seconds), next phase on exhaustion
const PHASE_CONFIG: Record<
  RetryPhase,
  { maxAttempts: number; intervalSec: number; nextPhase: RetryPhase }
> = {
  silent: { maxAttempts: 3, intervalSec: 2, nextPhase: "auto-1" },
  "auto-1": { maxAttempts: 3, intervalSec: 60, nextPhase: "auto-5" },
  "auto-5": { maxAttempts: 3, intervalSec: 300, nextPhase: "stopped" },
  stopped: { maxAttempts: 0, intervalSec: 0, nextPhase: "stopped" },
  manual: { maxAttempts: 5, intervalSec: 1, nextPhase: "auto-1" },
};

// No dedicated health endpoint is available. Retry completion is driven by
// the existing real API/socket SERVICE_UP event.

export function useServiceRetry({ onServiceUp }: UseServiceRetryOptions = {}) {
  const [state, setState] = useState<ServiceRetryState>({
    showMaintenancePage: false,
    phase: "silent",
    attempt: 0,
    maxAttempts: PHASE_CONFIG.silent.maxAttempts,
    countdown: 0,
    countdownMax: 0,
    checking: false,
  });

  const phaseRef = useRef<RetryPhase>("silent");
  const attemptRef = useRef(0);
  const onServiceUpRef = useRef(onServiceUp);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Token to identify the current run loop. When retryNow/succeed is called,
  // the token is bumped, and the old loop sees the mismatch and exits.
  const loopTokenRef = useRef(0);
  // Track whether the tab is visible — only retry when active tab
  const isVisibleRef = useRef(true);
  const isVisibleStateRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onServiceUpRef.current = onServiceUp;
  }, [onServiceUp]);

  // ── Page Visibility: only retry when the tab is active ────────────────────
  useEffect(() => {
    if (typeof document === "undefined") return;
    isVisibleRef.current = document.visibilityState === "visible";

    const handleVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      isVisibleRef.current = visible;
      // Resume the loop if it was waiting for visibility
      if (visible && isVisibleStateRef.current) {
        isVisibleStateRef.current();
        isVisibleStateRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Wait until the tab is visible. Returns immediately if already visible.
  // Resolves when the tab becomes visible (via visibilitychange listener).
  const waitForVisible = useCallback((): Promise<void> => {
    if (isVisibleRef.current) return Promise.resolve();
    return new Promise<void>((resolve) => {
      isVisibleStateRef.current = resolve;
    });
  }, []);

  const clearTimers = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const updateState = useCallback(() => {
    const phase = phaseRef.current;
    const config = PHASE_CONFIG[phase];
    setState((s) => ({
      ...s,
      phase,
      attempt: attemptRef.current,
      maxAttempts: config.maxAttempts,
      showMaintenancePage: phase !== "silent",
    }));
  }, []);

  const succeed = useCallback(() => {
    loopTokenRef.current++; // invalidate any running loop
    clearTimers();
    phaseRef.current = "silent";
    attemptRef.current = 0;
    setState({
      showMaintenancePage: false,
      phase: "silent",
      attempt: 0,
      maxAttempts: PHASE_CONFIG.silent.maxAttempts,
      countdown: 0,
      countdownMax: 0,
      checking: false,
    });
    onServiceUpRef.current?.();
  }, [clearTimers]);

  // Keep retry phases/countdown visible. The real API/socket handlers dispatch
  // SERVICE_UP after a successful application request.
  const doCheck = useCallback(async (): Promise<boolean> => {
    // There is no safe health endpoint. SERVICE_UP from a real request is the
    // only authoritative success signal.
    return false;
  }, []);

  // Start a visual countdown for the next attempt.
  // Pauses when the tab is hidden, resumes when visible.
  const startCountdown = useCallback(
    (seconds: number) => {
      clearTimers();
      let remaining = seconds;
      let lastTick = Date.now();
      setState((s) => ({ ...s, countdown: remaining, countdownMax: seconds }));

      countdownTimerRef.current = setInterval(() => {
        // Skip countdown when tab is hidden — resume when visible
        if (!isVisibleRef.current) {
          lastTick = Date.now();
          return;
        }
        const now = Date.now();
        const elapsed = Math.floor((now - lastTick) / 1000);
        if (elapsed >= 1) {
          remaining -= elapsed;
          lastTick = now;
          setState((s) => ({ ...s, countdown: remaining }));
          if (remaining <= 0) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
          }
        }
      }, 500); // check more frequently for smooth resume
    },
    [clearTimers]
  );

  // Run the retry loop for the current phase.
  // Uses a token to allow cancellation/restart.
  const runPhase = useCallback(async () => {
    const myToken = ++loopTokenRef.current;

    while (loopTokenRef.current === myToken) {
      const phase = phaseRef.current;
      const config = PHASE_CONFIG[phase];

      if (config.maxAttempts === 0) {
        // Stopped phase — just wait for manual retry
        break;
      }

      // Run attempts for this phase
      for (let i = 0; i < config.maxAttempts && loopTokenRef.current === myToken; i++) {
        attemptRef.current = i + 1;
        updateState();

        // Wait for the interval before each attempt, except:
        // - the first attempt in silent/manual phases (immediate)
        if (i > 0 || phase === "auto-1" || phase === "auto-5") {
          startCountdown(config.intervalSec);
          await new Promise<void>((resolve) => {
            retryTimerRef.current = setTimeout(resolve, config.intervalSec * 1000);
          });
          clearTimers();
          if (loopTokenRef.current !== myToken) return;
        }

        // Pause retry phase progression while the tab is hidden
        await waitForVisible();
        if (loopTokenRef.current !== myToken) return;

        const ok = await doCheck();
        if (loopTokenRef.current !== myToken) return;
        if (ok) {
          succeed();
          return;
        }
      }

      if (loopTokenRef.current !== myToken) return;

      // Exhausted this phase — advance to next
      phaseRef.current = config.nextPhase;
      attemptRef.current = 0;
      updateState();

      if (config.nextPhase === "stopped") {
        break;
      }
    }
  }, [clearTimers, doCheck, succeed, startCountdown, updateState, waitForVisible]);

  // ── Public API ────────────────────────────────────────────────────────────

  /** Called when SERVICE_DOWN event fires — starts silent retries */
  const handleServiceDown = useCallback(() => {
    // If already in a non-silent phase or already running, don't restart
    if (loopTokenRef.current > 0 && phaseRef.current !== "silent") return;
    phaseRef.current = "silent";
    attemptRef.current = 0;
    setState({
      showMaintenancePage: false,
      phase: "silent",
      attempt: 0,
      maxAttempts: PHASE_CONFIG.silent.maxAttempts,
      countdown: 0,
      countdownMax: 0,
      checking: false,
    });
    runPhase();
  }, [runPhase]);

  /** Called when SERVICE_UP event fires — immediately succeed */
  const handleServiceUp = useCallback(() => {
    succeed();
  }, [succeed]);

  /** User clicked "Try Again Now" — restart from manual phase */
  const retryNow = useCallback(() => {
    clearTimers();
    phaseRef.current = "manual";
    attemptRef.current = 0;
    setState((s) => ({
      ...s,
      showMaintenancePage: true,
      phase: "manual",
      attempt: 0,
      maxAttempts: PHASE_CONFIG.manual.maxAttempts,
      countdown: 0,
      countdownMax: 0,
      checking: false,
    }));
    // Start manual phase (5 rapid retries). Bumping the token cancels any
    // previously running loop.
    runPhase();
  }, [clearTimers, runPhase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      loopTokenRef.current++;
      clearTimers();
      if (isVisibleStateRef.current) {
        isVisibleStateRef.current();
        isVisibleStateRef.current = null;
      }
    };
  }, [clearTimers]);

  return {
    ...state,
    handleServiceDown,
    handleServiceUp,
    retryNow,
  };
}
