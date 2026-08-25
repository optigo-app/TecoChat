"use client";

/**
 * useVersionCheck — Production-grade version detection hook
 *
 * Three strategies:
 *   1. WebSocket push — listens for `internal:app_version_update` on the socket
 *   2. Visibility change — when user returns to tab after 30s, fetch /version.json
 *   3. Fallback polling — every 10 min, fetch /version.json
 *
 * Multi-tab sync via BroadcastChannel (or localStorage fallback).
 *
 * Ported from OldChatReactCode/src/hooks/useVersionCheck.js
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchServerVersion,
  isNewerVersion,
  getStoredVersion,
  setStoredVersion,
  onCrossTabVersionNotification,
  notifyOtherTabs,
  unregisterStaleServiceWorkers,
} from "../utils/versionManager";
import { addAppVersionUpdateHandler } from "../socket";

// ── Config ────────────────────────────────────────────────────────────────────

const POLL_INTERVAL = parseInt(
  process.env.NEXT_PUBLIC_VERSION_POLL_INTERVAL || "600000",
  10
); // default 10 min
const VISIBILITY_MIN_INTERVAL = 30 * 1000; // 30s

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface VersionCheckResult {
  updateAvailable: boolean;
  serverVersion: string | null;
  currentVersion: string | null;
  buildTime: string | null;
  dismissUpdate: () => void;
  applyUpdate: () => void;
  checkNow: () => Promise<void>;
}

export function useVersionCheck(): VersionCheckResult {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [buildTime, setBuildTime] = useState<string | null>(null);

  const currentVersionRef = useRef<string | null>(null);
  const lastVisibilityCheckRef = useRef(Date.now());
  const dismissedVersionRef = useRef<string | null>(null);
  const isCheckingRef = useRef(false);

  // ── Core check function ─────────────────────────────────────────────────────
  const performCheck = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      const info = await fetchServerVersion();
      if (!info) return;

      // On first run, establish the baseline version
      if (!currentVersionRef.current) {
        currentVersionRef.current = info.version;
        setStoredVersion(info.version);
        return;
      }

      // Already dismissed this version
      if (dismissedVersionRef.current === info.version) return;

      if (isNewerVersion(info.version, currentVersionRef.current)) {
        setServerVersion(info.version);
        setBuildTime(info.buildTime || null);
        setUpdateAvailable(true);
        notifyOtherTabs(info);
      }
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  // ── Manual check function ───────────────────────────────────────────────────
  const checkNow = useCallback(async () => {
    isCheckingRef.current = false;
    await performCheck();
  }, [performCheck]);

  // ── Dismiss & apply ─────────────────────────────────────────────────────────
  const dismissUpdate = useCallback(() => {
    if (serverVersion) {
      dismissedVersionRef.current = serverVersion;
    }
    setUpdateAvailable(false);
  }, [serverVersion]);

  const applyUpdate = useCallback(() => {
    window.location.reload();
  }, []);

  // ── Effects ─────────────────────────────────────────────────────────────────

  // 1. Initial mount: unregister stale SWs + fetch baseline + start polling
  useEffect(() => {
    unregisterStaleServiceWorkers();

    const stored = getStoredVersion();
    if (stored) {
      dismissedVersionRef.current = null;
    }

    performCheck();

    const pollTimer = setInterval(performCheck, POLL_INTERVAL);
    return () => clearInterval(pollTimer);
  }, [performCheck]);

  // 2. Visibility change — check when user returns to the tab
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastVisibilityCheckRef.current < VISIBILITY_MIN_INTERVAL) return;
      lastVisibilityCheckRef.current = now;
      performCheck();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [performCheck]);

  // 3. WebSocket push — listen for server-side version update events
  useEffect(() => {
    const handler = (data: { version?: string; buildTime?: string } | null) => {
      if (data?.version) {
        if (!currentVersionRef.current) {
          currentVersionRef.current = data.version;
          setStoredVersion(data.version);
          return;
        }
        if (
          isNewerVersion(data.version, currentVersionRef.current) &&
          dismissedVersionRef.current !== data.version
        ) {
          setServerVersion(data.version);
          setBuildTime(data.buildTime || null);
          setUpdateAvailable(true);
          notifyOtherTabs({ version: data.version, buildTime: data.buildTime || "" });
        }
      } else {
        performCheck();
      }
    };

    const unsubscribe = addAppVersionUpdateHandler(handler);
    return unsubscribe;
  }, [performCheck]);

  // 4. Cross-tab notifications
  useEffect(() => {
    const unsubscribe = onCrossTabVersionNotification((info) => {
      if (!currentVersionRef.current) {
        currentVersionRef.current = info.version;
        return;
      }
      if (
        isNewerVersion(info.version, currentVersionRef.current) &&
        dismissedVersionRef.current !== info.version
      ) {
        setServerVersion(info.version);
        setBuildTime(info.buildTime || null);
        setUpdateAvailable(true);
      }
    });
    return unsubscribe;
  }, []);

  return {
    updateAvailable,
    serverVersion,
    currentVersion: currentVersionRef.current,
    buildTime,
    dismissUpdate,
    applyUpdate,
    checkNow,
  };
}
