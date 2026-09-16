// Ported from OldChatReactCode/src/hooks/confirmConfig.js
// Single source of truth for all ConfirmationDialog props.

export type ConfirmVariant = "primary" | "danger";

export interface ConfirmConfigEntry {
  title: string;
  description: string;
  confirmText: string;
  variant: ConfirmVariant;
  showCancel: boolean;
}

export const CONFIRM_CONFIG: Record<string, ConfirmConfigEntry> = {
  adminCannotLeave: {
    title: "Cannot Leave Group",
    description:
      "You cannot leave the group because you are the only administrator. Please assign another admin before leaving.",
    confirmText: "OK",
    variant: "primary",
    showCancel: false,
  },
  exitGroup: {
    title: "Exit Group?",
    description: "Are you sure you want to exit this group?",
    confirmText: "Exit",
    variant: "danger",
    showCancel: true,
  },
  deleteGroup: {
    title: "Delete Chat?",
    description:
      "Are you sure you want to delete this conversation? This will remove it from your chat list.",
    confirmText: "Delete",
    variant: "danger",
    showCancel: true,
  },
  deleteChat: {
    title: "Delete Chat?",
    description:
      "Are you sure you want to delete this conversation? This will remove it from your chat list.",
    confirmText: "Delete",
    variant: "danger",
    showCancel: true,
  },
  clearChat: {
    title: "Clear Chat?",
    description: "Are you sure you want to clear all messages in this chat?",
    confirmText: "Clear",
    variant: "danger",
    showCancel: true,
  },
  deleteMessage: {
    title: "Delete message?",
    description: "",
    confirmText: "", // handled via actions[]
    variant: "danger",
    showCancel: false, // cancel comes from actions[]
  },
  logout: {
    title: "Log Out?",
    description: "Are you sure you want to log out?",
    confirmText: "Log Out",
    variant: "danger",
    showCancel: true,
  },
  suspiciousLink: {
    title: "This link may be unsafe",
    description: "This link looks suspicious. Please check before opening:/n/n{n}",
    confirmText: "Open Anyway",
    variant: "danger",
    showCancel: true,
  },
};

export const getConfirmProps = (
  actionType: string
): Partial<ConfirmConfigEntry> => {
  return CONFIRM_CONFIG[actionType] ?? {};
};
