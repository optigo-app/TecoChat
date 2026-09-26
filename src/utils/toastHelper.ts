// Ported from OldChatReactCode/src/utils/toastHelper.js
// Centralized toast utility wrapping react-hot-toast.

import { toast } from "react-hot-toast";

type ToastType = "success" | "error" | "warning" | "info" | "loading" | "notification";

interface ToastOptions {
  id?: string;
  duration?: number;
  [key: string]: unknown;
}

/**
 * Show a styled toast notification.
 */
export const showToast = (
  message: string,
  type: ToastType = "info",
  options: ToastOptions = {}
) => {
  switch (type) {
    case "success":
      return toast.success(message, options);
    case "error":
      return toast.error(message, options);
    case "loading":
      return toast.loading(message, options);
    case "warning":
      return toast(message, {
        icon: "⚠️",
        style: {
          background: "#fef3c7",
          color: "#92400e",
          border: "1px solid #fde68a",
          borderRadius: "16px",
          padding: "12px 20px",
          fontSize: "14px",
          fontWeight: "500",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          backdropFilter: "blur(8px)",
          maxWidth: "400px",
        },
        ...options,
      });
    case "info":
    default:
      return toast(message, {
        icon: "ℹ️",
        style: {
          background: "#eff6ff",
          color: "#1e40af",
          border: "1px solid #bfdbfe",
          borderRadius: "16px",
          padding: "12px 20px",
          fontSize: "14px",
          fontWeight: "500",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          backdropFilter: "blur(8px)",
          maxWidth: "400px",
        },
        ...options,
      });
  }
};
