// Ported from OldChatReactCode/src/utils/notifications.js
// Fix: document.hasFocus() is unreliable for detecting when another browser
// window is on top. We track window focus/blur + visibilitychange events
// instead, which is accurate across browsers.

import { showToast } from "./toastHelper";
import { playNotificationSound } from "./sound";

const NOTIFICATION_ICON = "/icons/brand/tecoChat_logo.png";

interface BrowserNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  tag?: string;
  isOpenConversation?: boolean; // if true, the user is already viewing this chat
}

// ── Window focus tracker ───────────────────────────────────────────────────
// document.hasFocus() is unreliable — it can return true even when another
// browser window (Edge, another Chrome window) is on top of this one.
// We track focus/blur events on window + visibilitychange on document
// to get an accurate "is this window actually visible to the user" state.
let windowFocused = true; // assume focused on load
let windowVisible = true; // assume visible on load

if (typeof window !== "undefined") {
  // Track focus/blur — fires when window gains/loses focus to another app/window
  window.addEventListener("focus", () => { windowFocused = true; });
  window.addEventListener("blur", () => { windowFocused = false; });

  // Track visibility — fires when user switches tabs
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      windowVisible = document.visibilityState === "visible";
    });
  }

  // Initialize from current state
  if (typeof document !== "undefined") {
    windowFocused = document.hasFocus();
    windowVisible = document.visibilityState === "visible";
  }
}

/**
 * Check if the window is actually active (focused AND visible).
 * Uses event-based tracking which is more reliable than document.hasFocus().
 */
const isWindowActive = (): boolean => {
  if (typeof window === "undefined") return true;
  // Must be both visible (tab is active) AND focused (window has focus)
  return windowFocused && windowVisible;
};

/**
 * Show a browser notification or fallback to in-app toast.
 * Uses event-based focus tracking (more reliable than document.hasFocus()).
 */
export const showBrowserNotification = async ({
  title,
  body,
  icon = NOTIFICATION_ICON,
  badge = NOTIFICATION_ICON,
  data,
  tag,
  isOpenConversation = false,
}: BrowserNotificationOptions): Promise<void> => {
  const active = isWindowActive();
  console.log("[NOTIFY] showBrowserNotification:", { title, body, tag, windowFocused, windowVisible, active, isOpenConversation, permission: typeof Notification !== "undefined" ? Notification.permission : "N/A" });

  // If not in browser or Notification API not supported, fall back to toast
  if (typeof window === "undefined" || !("Notification" in window)) {
    console.log("[NOTIFY] Notification API not supported, playing sound + toast");
    // Only play sound if the conversation is NOT open (user isn't already reading it)
    if (!isOpenConversation) playNotificationSound();
    if (!active) showToast(body, "info", { title, data });
    return;
  }

  // If permission not granted, play sound but don't show notification
  if (Notification.permission !== "granted") {
    console.log("[NOTIFY] Permission not granted, playing sound only");
    if (!isOpenConversation) playNotificationSound();
    return;
  }

  const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body,
    icon,
    badge,
    data: data as any,
    tag: tag || `msg-${(data as any)?.conversationId || (data as any)?.ConversationId}`,
    requireInteraction: false,
    renotify: true,
    // App plays its own synthesized sound — silence the OS default to avoid double audio
    silent: true,
  };

  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    options.vibrate = [200, 100, 200];
  }

  // Track whether we already played the sound in this call to avoid double-play
  let soundPlayed = false;
  const playSoundIfNeeded = () => {
    if (!isOpenConversation && !soundPlayed) {
      playNotificationSound();
      soundPlayed = true;
    }
  };

  // WhatsApp Web behavior: Only show browser notifications if window is not active
  if (!active) {
    console.log("[NOTIFY] Window NOT active — showing notification + sound");
    playSoundIfNeeded();

    try {
      // Use Service Worker if available
      if (
        "serviceWorker" in navigator &&
        navigator.serviceWorker.controller &&
        typeof ServiceWorkerRegistration !== "undefined" &&
        "showNotification" in ServiceWorkerRegistration.prototype
      ) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && typeof reg.showNotification === "function") {
          console.log("[NOTIFY] Showing via Service Worker");
          reg.showNotification(title, options);
          return;
        }
      }

      // Fallback to standard Browser Notification
      if (typeof Notification === "function") {
        console.log("[NOTIFY] Showing via Notification API");
        const notification = new Notification(title, options);
        notification.onclick = (e) => {
          e.preventDefault();
          window.focus();
          const conversationId =
            (data as any)?.conversationId || (data as any)?.ConversationId;
          if (conversationId) {
            window.dispatchEvent(
              new CustomEvent("SELECT_CONVERSATION", {
                detail: { conversationId },
              })
            );
          }
          notification.close();
        };
      } else {
        console.log("[NOTIFY] Notification constructor not available, showing toast");
        showToast(body, "info", { title, data });
      }
    } catch (error) {
      console.warn("[NOTIFY] Browser notification failed, falling back to toast:", error);
      // Don't replay sound here — already played above if needed
      showToast(body, "info", { title, data });
    }
  } else {
    // Window is active — only play sound if user is NOT already viewing this chat
    if (!isOpenConversation) {
      console.log("[NOTIFY] Window active but chat not open — playing sound only");
      playSoundIfNeeded();
    } else {
      console.log("[NOTIFY] Window active AND chat open — no sound (user is reading it)");
    }
  }
};
