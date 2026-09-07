// Ported from OldChatReactCode/src/utils/notificationTemplates.js
// Matches old code behavior exactly, with added logging for debugging.

import { showBrowserNotification } from "./notifications";

const NOTIFICATION_ICON = "/icons/brand/tecoChat_logo.png";

const capitalizeWords = (str?: string): string =>
  str
    ? str
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "";

interface NotificationTemplateOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
}

type TemplateFn = (data: any, user?: any) => NotificationTemplateOptions;

export const NOTIFICATION_TEMPLATES: Record<string, TemplateFn> = {
  NEW_MESSAGE: (data) => {
    const sender = capitalizeWords(
      data?.senderName || data?.CustomerName || "New Message"
    );
    const conversationName =
      data?.conversationName || data?.ConversationName || "";
    const isGroup = data?.isGroup === 1 || data?.IsGroup === 1;
    const title =
      isGroup && conversationName && conversationName !== sender
        ? `${capitalizeWords(conversationName)} • ${sender}`
        : sender;

    return {
      title,
      body: data?.message || data?.Message || "You have a new message.",
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: `msg-${data?.conversationId || data?.ConversationId}`,
    };
  },

  MESSAGE_REACTION: (data) => {
    let emoji = "👍";
    try {
      const reactions =
        typeof data?.ReactionEmojis === "string"
          ? JSON.parse(data.ReactionEmojis)
          : data?.ReactionEmojis;
      if (Array.isArray(reactions) && reactions.length > 0) {
        emoji = reactions[reactions.length - 1].Reaction || "👍";
      }
    } catch {
      /* ignore */
    }

    return {
      title: `${capitalizeWords(data?.senderName || "User")} reacted to your message`,
      body: `${emoji} ${data?.messagePreview || "Reacted to your message"}`,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
    };
  },

  CONVERSATION_ASSIGNED: (data) => ({
    title: `Conversation Assigned`,
    body: `A conversation with ${capitalizeWords(
      data?.CustomerName || "a customer"
    )} has been assigned to you.`,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
  }),

  SESSION_LOGOUT: () => ({
    title: `Session Logged Out`,
    body: `Your account was logged in from another device.`,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
  }),

  // Group notification templates (commented out in old code — kept as no-ops)
  // GROUP_CREATED, GROUP_UPDATED, MEMBER_ADDED, MEMBER_REMOVED,
  // MEMBER_PROMOTED, MEMBER_DEMOTED, PERMISSION_CHANGED, YOU_WERE_REMOVED
  // are intentionally omitted to match old behavior.
};

// Deduplicate notifications that fire from multiple handlers for the same event.
// This is the ONLY dedup layer (matches old code — no second dedup in
// showBrowserNotification).
const recentNotifications = new Map<string, number>();
const NOTIFICATION_DEDUPE_MS = 3000;

// ── Per-conversation coalescing for rapid messages ─────────────────────────
// When a user sends many messages in rapid succession (10-20/sec), instead
// of firing a notification for each one, we coalesce them into a single
// notification per conversation within COALESCE_WINDOW_MS. The browser
// replaces the previous notification (same `tag`), and the body updates to
// show the count. Matches WhatsApp Web behavior.
interface CoalesceState {
  count: number;
  lastShownAt: number;
}
const conversationCoalesce = new Map<string, CoalesceState>();
const COALESCE_WINDOW_MS = 3000;

const getNotificationKey = (templateId: string, data: any): string => {
  const conversationId =
    data?.conversationId ?? data?.ConversationId ?? "";
  const messageId =
    data?.MessageId ?? data?.messageId ?? data?.Id ?? data?.id ?? "";
  const eventType = data?.eventType ?? "";
  const memberId =
    data?.memberId ?? data?.removedMemberId ?? data?.newMemberId ?? "";
  const changedPermissionName = data?.changedPermission?.name ?? "";
  return `${templateId}|${conversationId}|${messageId}|${eventType}|${memberId}|${changedPermissionName}`;
};

export const notify = (data: any, templateId: string, user?: any): void => {
  const templateFn = NOTIFICATION_TEMPLATES[templateId];
  if (!templateFn) {
    console.warn(`[NOTIFY] Template "${templateId}" not found`);
    return;
  }

  // Extract isOpenConversation from data (passed by caller)
  const isOpenConversation = Boolean(data?.isOpenConversation);

  // Dedup check — prevent the same event from firing twice
  const key = getNotificationKey(templateId, data);
  const now = Date.now();
  const lastShown = recentNotifications.get(key);
  if (lastShown && now - lastShown < NOTIFICATION_DEDUPE_MS) {
    return;
  }
  recentNotifications.set(key, now);

  // Cleanup old entries (lightweight — just prune on every call)
  if (recentNotifications.size > 50) {
    for (const [k, ts] of recentNotifications) {
      if (now - ts > NOTIFICATION_DEDUPE_MS * 2) {
        recentNotifications.delete(k);
      }
    }
  }

  // Cleanup stale coalesce entries
  if (conversationCoalesce.size > 50) {
    for (const [k, s] of conversationCoalesce) {
      if (now - s.lastShownAt > COALESCE_WINDOW_MS * 2) {
        conversationCoalesce.delete(k);
      }
    }
  }

  const notificationOptions = templateFn(data, user);

  let typeGroup = "OTHER";
  if (templateId === "NEW_MESSAGE") typeGroup = "MESSAGE";
  if (templateId === "MESSAGE_REACTION") typeGroup = "REACTION";
  if (templateId === "CONVERSATION_ASSIGNED") typeGroup = "ASSIGNMENT";
  if (templateId === "SESSION_LOGOUT") typeGroup = "AUTH";
  if (
    templateId.startsWith("GROUP_") ||
    templateId.startsWith("MEMBER_") ||
    templateId.startsWith("PERMISSION_") ||
    templateId === "YOU_WERE_REMOVED"
  ) {
    typeGroup = "GROUP";
  }

  // ── Coalesce rapid NEW_MESSAGE notifications per conversation ──────────
  // Within COALESCE_WINDOW_MS, additional messages from the same conversation
  // replace the existing notification (same `tag`) with an updated body
  // showing the count, instead of stacking separate notifications.
  if (templateId === "NEW_MESSAGE") {
    const convId = data?.conversationId ?? data?.ConversationId;
    if (convId != null && convId !== "") {
      const coalesceKey = String(convId);
      const state = conversationCoalesce.get(coalesceKey);
      if (state && now - state.lastShownAt < COALESCE_WINDOW_MS) {
        // Within window — increment count and replace the notification
        state.count += 1;
        state.lastShownAt = now;
        const count = state.count;
        const body =
          count > 1
            ? `${count} new messages`
            : notificationOptions.body;
        showBrowserNotification({
          ...notificationOptions,
          body,
          isOpenConversation,
          data: {
            ...data,
            type: templateId,
            group: typeGroup,
            coalescedCount: count,
          },
        });
        return;
      }
      // Outside window (or first message) — start a fresh coalesce entry
      conversationCoalesce.set(coalesceKey, { count: 1, lastShownAt: now });
    }
  }

  showBrowserNotification({
    ...notificationOptions,
    isOpenConversation,
    data: {
      ...data,
      type: templateId,
      group: typeGroup,
    },
  });
};
