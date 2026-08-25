// Ported from OldChatReactCode/src/utils/notifications.js
// Fix: document.hasFocus() is unreliable for detecting when another browser
// window is on top. We track window focus/blur + visibilitychange events
// instead, which is accurate across browsers.

import { showToast } from "./toastHelper";
import { playNotificationSound } from "./sound";

const NOTIFICATION_ICON = "/tecoChat_logo.png";

interface BrowserNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  tag?: string;
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
  windowFocused = document.hasFocus();
  windowVisible = document.visibilityState === "visible";
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
}: BrowserNotificationOptions): Promise<void> => {
  const active = isWindowActive();
  console.log("[NOTIFY] showBrowserNotification:", { title, body, tag, windowFocused, windowVisible, active, permission: typeof Notification !== "undefined" ? Notification.permission : "N/A" });

  // If not in browser or Notification API not supported, fall back to toast
  if (typeof window === "undefined" || !("Notification" in window)) {
    console.log("[NOTIFY] Notification API not supported, playing sound + toast");
    playNotificationSound();
    if (!active) showToast(body, "info", { title, data });
    return;
  }

  // If permission not granted, play sound but don't show notification
  if (Notification.permission !== "granted") {
    console.log("[NOTIFY] Permission not granted, playing sound only");
    playNotificationSound();
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
    silent: false,
  };

  if ("vibrate" in navigator) {
    options.vibrate = [200, 100, 200];
  }

  // WhatsApp Web behavior: Only show browser notifications if window is not active
  if (!active) {
    console.log("[NOTIFY] Window NOT active — showing notification + sound");
    playNotificationSound();

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
      playNotificationSound();
      showToast(body, "info", { title, data });
    }
  } else {
    // Window is active — just play sound (caller already checked shouldNotify)
    console.log("[NOTIFY] Window active — playing sound only");
    playNotificationSound();
  }
};
