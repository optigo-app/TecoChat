// Ported from OldChatReactCode/src/contexts/NotificationContext.js
// Fixed: duplicate "Notifications enabled!" toast + notification (was firing 3x)
// Fixed: notification not showing due to premature dedup flag
// Added: sound on enable confirmation (like old code)

"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { showToast } from "../utils/toastHelper";
import { playNotificationSound, unlockAudio } from "../utils/sound";

const NOTIFICATION_ICON = "/icons/brand/tecoChat_logo.png";

interface NotificationContextValue {
  enabledOpen: boolean;
  permissionStatus: NotificationPermission | "default";
  showGuide: boolean;
  setEnabledOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowGuide: React.Dispatch<React.SetStateAction<boolean>>;
  requestPermission: () => Promise<void>;
  executeNativeRequest: (fromModal?: boolean) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined
);

export const NotificationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [enabledOpen, setEnabledOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<
    NotificationPermission | "default"
  >(
    (typeof window !== "undefined" && window.Notification?.permission) ||
      "default"
  );

  // Timestamp-based dedup — only block duplicates within 3 seconds.
  // This is more robust than a boolean flag: if the first call fails to
  // show the notification (e.g. permission not yet updated), the second
  // call can still succeed.
  const lastConfirmedAtRef = useRef(0);
  const CONFIRM_DEDUP_MS = 3000;

  // Single source of truth for showing the "Notifications enabled!" confirmation.
  // Dedup by timestamp — only one confirmation per 3-second window.
  const showEnabledConfirmation = () => {
    const now = Date.now();
    if (now - lastConfirmedAtRef.current < CONFIRM_DEDUP_MS) return;
    lastConfirmedAtRef.current = now;

    setEnabledOpen(true);
    setShowGuide(false);
    showToast("Notifications enabled!", "success");

    // Play sound (like old code)
    playNotificationSound();

    try {
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const options: NotificationOptions = {
          body: "You'll receive real-time updates.",
          icon: NOTIFICATION_ICON,
          tag: "notif-enabled",
        };
        // Android Chrome requires showNotification() via the service worker —
        // `new Notification()` throws "Illegal constructor" there.
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready
            .then((reg) => reg.showNotification("Notifications enabled!", options))
            .catch(() => {
              try {
                new Notification("Notifications enabled!", options);
              } catch {
                /* unsupported */
              }
            });
        } else {
          new Notification("Notifications enabled!", options);
        }
      }
    } catch (e) {
      console.warn("Browser does not support desktop notifications:", e);
    }
  };

  // Register the service worker — required for reliable notifications on
  // mobile (Chrome/Android + installed-PWA iOS use SW showNotification).
  // Also relays notificationclick → SELECT_CONVERSATION into the app.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});

    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === "SELECT_CONVERSATION" && e.data.conversationId) {
        window.dispatchEvent(
          new CustomEvent("SELECT_CONVERSATION", {
            detail: { conversationId: e.data.conversationId },
          })
        );
      }
    };
    navigator.serviceWorker.addEventListener("message", onSwMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onSwMessage);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    // Unlock audio on first user interaction (click/touchend/keyup).
    // Browsers block audio playback until the user interacts with the page.
    // Without this, playNotificationSound() silently fails.
    // NOTE: iOS requires click/touchend/keyup — pointerdown does NOT count.
    window.addEventListener("click", unlockAudio, { once: true });
    window.addEventListener("touchend", unlockAudio, { once: true });
    window.addEventListener("keyup", unlockAudio, { once: true });

    setPermissionStatus(Notification.permission);
    if (Notification.permission === "granted") {
      setEnabledOpen(true);
      // Don't show confirmation on page load if already granted — only when
      // the user actively grants permission during this session.
    }

    // Track the PermissionStatus so we can clean up its onchange handler
    let permStatus: PermissionStatus | null = null;

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "notifications" as PermissionName })
        .then((ps) => {
          permStatus = ps;
          ps.onchange = () => {
            setPermissionStatus(
              ps.state as NotificationPermission | "default"
            );

            if (ps.state === "granted") {
              showEnabledConfirmation();
            } else if (ps.state === "denied") {
              setShowGuide(false);
            }
          };
        })
        .catch((err) => {
          console.error("Permission query error:", err);
        });
    }

    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchend", unlockAudio);
      window.removeEventListener("keyup", unlockAudio);
      // Clean up the onchange handler to prevent stale closures on unmount/HMR
      if (permStatus) permStatus.onchange = null;
    };
  }, []);

  const requestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "default") {
      setShowGuide(true);
    } else if (Notification.permission === "denied") {
      setShowGuide(true);
    } else {
      executeNativeRequest();
    }
  };

  const executeNativeRequest = async (fromModal = false) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const status = await Notification.requestPermission();
      setPermissionStatus(status);
      if (!fromModal) setShowGuide(false);

      if (status === "granted") {
        showEnabledConfirmation();
      } else if (status === "denied") {
        if (!fromModal) {
          showToast(
            "Notifications blocked. You can enable them in your browser settings if you wish to see desktop alerts.",
            "warning"
          );
        }
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      setShowGuide(false);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        enabledOpen,
        permissionStatus,
        showGuide,
        setEnabledOpen,
        setShowGuide,
        requestPermission,
        executeNativeRequest,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationManager = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotificationManager must be used within a NotificationProvider"
    );
  }
  return context;
};
