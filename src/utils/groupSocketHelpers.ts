// Group socket helpers — ported from OldChatReactCode/src/utils/groupSocketHelpers.js
// Provides utilities for group member resolution, read-receipt formatting,
// permission checks, notification formatting, and socket payload building.

import { fetchGroupDetails } from "../API/Groups/FetchGroupDetails";
import type { AuthData } from "../contexts/LoginData";

/**
 * Get all member IDs for a group.
 */
export const getGroupMemberIds = async (
  conversationId: number | string,
  auth: AuthData
): Promise<number[]> => {
  try {
    const groupData = await fetchGroupDetails(conversationId, auth);
    if (groupData && groupData.members) {
      return groupData.members.map((m: { UserId: number }) => m.UserId);
    }
    return [];
  } catch (error) {
    console.error("Error fetching group members:", error);
    return [];
  }
};

export interface GroupReadReceiptInfo {
  icon: string;
  count: number;
  text: string;
  color?: string;
}

/**
 * Format group read receipt display.
 */
export const formatGroupReadReceipt = (
  message: { ReadBy?: unknown[] | null },
  groupMembers: unknown[]
): GroupReadReceiptInfo => {
  if (!message.ReadBy) return { icon: "✓", count: 0, text: "Sent" };

  const readCount = Array.isArray(message.ReadBy) ? message.ReadBy.length : 0;
  const totalMembers = groupMembers.length - 1; // Exclude sender

  if (readCount === 0) return { icon: "✓", count: 0, text: "Sent" };
  if (readCount === totalMembers)
    return { icon: "✓✓", count: readCount, text: "Read by all", color: "#53bdeb" };

  return {
    icon: "✓✓",
    count: readCount,
    text: `Read by ${readCount}`,
    color: "#53bdeb",
  };
};

export interface GroupPermissions {
  sendMessages?: number;
  editGroupInfo?: number;
  addMembers?: number;
  [key: string]: number | undefined;
}

/**
 * Check if current user can send messages in group.
 */
export const canSendMessageInGroup = (
  groupPermissions: GroupPermissions | null | undefined,
  isAdmin: boolean
): boolean => {
  if (isAdmin) return true;
  return groupPermissions?.sendMessages === 1;
};

/**
 * Check if current user can edit group info.
 */
export const canEditGroupInfo = (
  groupPermissions: GroupPermissions | null | undefined,
  isAdmin: boolean
): boolean => {
  if (isAdmin) return true;
  return groupPermissions?.editGroupInfo === 1;
};

/**
 * Check if current user can add members.
 */
export const canAddMembers = (
  groupPermissions: GroupPermissions | null | undefined,
  isAdmin: boolean
): boolean => {
  if (isAdmin) return true;
  return groupPermissions?.addMembers === 1;
};

interface GroupEventData {
  createdBy?: { name?: string };
  updatedBy?: { name?: string };
  addedBy?: { name?: string };
  removedBy?: { name?: string };
  changedBy?: { name?: string };
  changes?: { groupName?: string; groupDesc?: string; groupProfile?: string };
  newMembers?: { name?: string }[];
  removedMember?: { name?: string };
  targetMember?: { name?: string };
  reason?: string;
}

/**
 * Format group notification message.
 */
export const formatGroupNotification = (
  eventType: string,
  data: GroupEventData
): string => {
  switch (eventType) {
    case "group_created":
      return `${data.createdBy?.name || "Someone"} created the group`;

    case "group_updated":
      if (data.changes?.groupName)
        return `${data.updatedBy?.name || "Someone"} changed the group name`;
      if (data.changes?.groupDesc)
        return `${data.updatedBy?.name || "Someone"} changed the group description`;
      if (data.changes?.groupProfile)
        return `${data.updatedBy?.name || "Someone"} changed the group photo`;
      return `${data.updatedBy?.name || "Someone"} updated the group`;

    case "member_added": {
      const addedNames =
        data.newMembers?.map((m) => m.name).join(", ") || "Someone";
      return `${data.addedBy?.name || "Someone"} added ${addedNames}`;
    }

    case "member_removed":
      if (data.reason === "left")
        return `${data.removedMember?.name || "Someone"} left the group`;
      return `${data.removedBy?.name || "Someone"} removed ${
        data.removedMember?.name || "someone"
      }`;

    case "member_promoted":
      return `${data.changedBy?.name || "Someone"} promoted ${
        data.targetMember?.name || "someone"
      } to admin`;

    case "member_demoted":
      return `${data.changedBy?.name || "Someone"} removed ${
        data.targetMember?.name || "someone"
      } as admin`;

    case "permission_changed":
      return `${data.changedBy?.name || "Someone"} changed group permissions`;

    default:
      return "Group updated";
  }
};

/**
 * Get notification priority (1=highest, 5=lowest).
 */
export const getNotificationPriority = (eventType: string): number => {
  const priorities: Record<string, number> = {
    member_removed: 1,
    group_deleted: 1,
    member_added: 2,
    member_promoted: 2,
    member_demoted: 3,
    permission_changed: 3,
    group_updated: 4,
    group_created: 4,
  };
  return priorities[eventType] || 5;
};

interface GroupedNotification {
  type: string;
  conversationId: number | string;
  timestamp: number;
  notifications: unknown[];
}

/**
 * Group notifications by time window (5 seconds).
 */
export const groupNotifications = (
  notifications: Array<Record<string, unknown> & { type: string; conversationId: number | string; timestamp: number }>
): GroupedNotification[] => {
  if (!notifications || notifications.length === 0) return [];

  const grouped: GroupedNotification[] = [];
  const timeWindow = 5000;

  notifications.forEach((notification) => {
    const lastGroup = grouped[grouped.length - 1];
    if (
      lastGroup &&
      lastGroup.type === notification.type &&
      lastGroup.conversationId === notification.conversationId &&
      notification.timestamp - lastGroup.timestamp < timeWindow
    ) {
      lastGroup.notifications.push(notification);
    } else {
      grouped.push({
        type: notification.type,
        conversationId: notification.conversationId,
        timestamp: notification.timestamp,
        notifications: [notification],
      });
    }
  });

  return grouped;
};

interface BuildGroupMessageParams {
  auth: AuthData;
  conversationId: number | string;
  receiverIds: number[];
  message: string | { Message?: string; message?: string; MessageId?: string | number; Id?: string | number; id?: string | number; IsEdited?: number; SentAt?: string } | null;
  messageType?: number;
  replyTo?: number;
  attachments?: unknown;
  direction?: number;
  messageId?: string | number | null;
  isEdited?: number;
  dateTime?: string;
}

/**
 * Build group message payload for socket.
 */
export const buildGroupMessagePayload = (params: BuildGroupMessageParams) => {
  const {
    auth,
    conversationId,
    receiverIds,
    message,
    messageType = 1,
    replyTo = 0,
    attachments = null,
    direction = 1,
    messageId = null,
    isEdited = 0,
    dateTime,
  } = params;

  const messageObj = typeof message === "string" ? null : message;
  const messageText =
    typeof message === "string"
      ? message
      : messageObj?.Message || messageObj?.message || "";
  const finalMessageId =
    messageId || messageObj?.MessageId || messageObj?.Id || messageObj?.id || null;
  const finalIsEdited = isEdited || messageObj?.IsEdited || 0;

  return {
    ufcc: auth?.ufcc,
    SenderId: auth?.id || auth?.userId,
    ReceiverId: receiverIds,
    ConversationId: conversationId,
    Message: messageText,
    MessageType: messageType,
    Direction: direction,
    IsGroup: 1,
    SenderName: auth?.username || (auth as { name?: string }).name,
    RecieverName: auth?.username || (auth as { name?: string }).name,
    SenderEmail: (auth as { email?: string }).email,
    FirstName: (auth as { firstName?: string }).firstName,
    LastName: (auth as { lastName?: string }).lastName,
    SenderProfilePicture:
      (auth as { ProfileImageUrl?: string }).ProfileImageUrl ||
      (auth as { profilePicture?: string }).profilePicture ||
      (auth as { profileImage?: string }).profileImage ||
      "",
    ProfileImageUrl:
      (auth as { ProfileImageUrl?: string }).ProfileImageUrl ||
      (auth as { profileImage?: string }).profileImage ||
      (auth as { AvatarUrl?: string }).AvatarUrl ||
      "",
    ProfileImage:
      (auth as { ProfileImage?: string }).ProfileImage ||
      (auth as { profileImage?: string }).profileImage ||
      (auth as { AvatarUrl?: string }).AvatarUrl ||
      "",
    ReplyTo: replyTo,
    IsEdited: finalIsEdited,
    MessageId: finalMessageId,
    Attachments: attachments,
    SentAt: (message as { SentAt?: string } | null)?.SentAt || new Date().toISOString(),
    DateTime: dateTime ?? new Date().toISOString(),
  };
};

interface BuildGroupReactionParams {
  auth: AuthData;
  conversationId: number | string;
  receiverIds: number[];
  messageId: string | number;
  emoji: string;
  unified: string;
  direction?: number;
}

/**
 * Build group reaction payload for socket.
 */
export const buildGroupReactionPayload = (params: BuildGroupReactionParams) => {
  const { auth, conversationId, receiverIds, messageId, emoji, unified, direction = 0 } = params;
  return {
    ufcc: auth?.ufcc,
    SenderId: auth?.id || auth?.userId,
    ReceiverId: receiverIds,
    ConversationId: conversationId,
    MessageId: messageId,
    IsGroup: 1,
    ReactionEmojis: JSON.stringify([
      {
        Reaction: emoji,
        Unified: unified,
        Direction: direction,
        UserId: auth?.id || auth?.userId,
        UserName: auth?.username || (auth as { name?: string }).name,
        FirstName: (auth as { firstName?: string }).firstName,
        LastName: (auth as { lastName?: string }).lastName,
        ReactedAt: new Date().toISOString(),
      },
    ]),
  };
};
