// ─── Socket emit helpers ────────────────────────────────────────────────────
// Ported from OldChatReactCode/.../CoreLogic/socketHelpers.js
// Wraps socket emit functions with typed payloads.

import {
  emitInternalMessageSend,
  emitInternalMessageRead,
  emitSendReaction,
  emitRemoveReaction,
  emitInternalTyping,
  emitInternalMessageDelete,
} from "../../../socket";
import type { AuthData } from "../../../contexts/LoginData";
import type { ConversationListEntry } from "../../../types/conversation";

interface AuthLike {
  id?: string;
  userId?: string;
  ufcc?: string;
  SocketId?: string;
  username?: string;
  name?: string;
  firstName?: string;
  FirstName?: string;
  firstname?: string;
  lastName?: string;
  LastName?: string;
  lastname?: string;
  email?: string;
  profilePicture?: string;
  ProfileImageUrl?: string;
  profileImage?: string;
  ProfileImage?: string;
  AvatarUrl?: string;
  token?: string;
}

interface CustomerLike {
  ConversationId?: string | number;
  CustomerId?: string | number;
  UserId?: string | number;
  ReceiverId?: string | number | string[] | number[];
  IsGroup?: 0 | 1;
  name?: string;
  ConversationName?: string;
  UserName?: string;
  MemberName?: string;
  CustomerName?: string;
}

/** Emit a text message via socket. */
export const emitTextMessage = ({
  auth,
  selectedCustomer, 
  messageId,
  message,
  isEdited = 0,
  receiverIds,
  extra = {},
}: {
  auth: AuthLike | null;
  selectedCustomer: CustomerLike | null;
  messageId: string | number;
  message: string;
  isEdited?: 0 | 1;
  receiverIds?: string | number | string[] | number[];
  extra?: Record<string, unknown>;
}): boolean => {
  if (!auth) return false;
  const senderName = auth.username || auth.name;
  const firstName = auth.firstName || auth.FirstName || auth.firstname;
  const lastName = auth.lastName || auth.LastName || auth.lastname;
  const profilePic =
    auth.ProfileImageUrl || auth.profilePicture || auth.profileImage || "";
  // Resolve the receiver's / conversation name from selectedCustomer so the
  // conversation list shows the OTHER person's name, not the login user.
  const receiverName = String(
    selectedCustomer?.ConversationName ||
    selectedCustomer?.name ||
    selectedCustomer?.MemberName ||
    selectedCustomer?.UserName ||
    selectedCustomer?.CustomerName ||
    ""
  ).trim();
  return emitInternalMessageSend({
    Id: auth.SocketId ?? auth.id,
    ReceiverId: receiverIds,
    Type: 1,
    ufcc: auth.ufcc,
    SenderId: auth.id,
    ConversationId: selectedCustomer?.ConversationId,
    ConversationName: receiverName || undefined,
    Message: message,
    MessageId: messageId,
    Status: 1,
    MessageStatus: 1,
    MessageType: "text",
    IsEdited: isEdited,
    Direction: 0,
    IsGroup: selectedCustomer?.IsGroup ?? 0,
    ReplyTo: 0,
    Attachments: null,
    SentAt: new Date().toISOString(),
    // ── Sender info (so recipient sees actual name + avatar, not "member") ──
    SenderName: senderName,
    RecieverName: receiverName || senderName,
    SenderEmail: auth.email,
    FirstName: firstName,
    LastName: lastName,
    SenderProfilePicture: profilePic,
    ProfileImageUrl: auth.ProfileImageUrl || auth.profileImage || auth.AvatarUrl || "",
    ProfileImage: auth.ProfileImage || auth.profileImage || auth.AvatarUrl || "",
    ...extra,
  });
};

/** Emit a media message via socket. */
export const emitMediaMessage = (payload: Record<string, unknown>): boolean => {
  return emitInternalMessageSend(payload);
};

/** Emit a read receipt.
 *  Mirrors the old CRA code: iterates over each recipient ID and emits
 *  a separate socket event per recipient (not a single event with an array).
 *  This is how the backend expects group read receipts — one per member.
 */
export const emitReadReceipt = (
  auth: AuthLike | null,
  receiverId: string | number | string[] | number[],
  status: number,
  isGroup: boolean,
  conversationId: string | number
): boolean => {
  if (!auth) return false;
  const ids = Array.isArray(receiverId) ? receiverId : [receiverId];
  let any = false;
  for (const id of ids) {
    if (!id) continue;
    const ok = emitInternalMessageRead({
      Id: auth.SocketId ?? auth.id,
      ReceiverId: Number(id),
      Status: status,
      MessageStatus: status,
      IsGroup: isGroup ? 1 : 0,
      ConversationId: conversationId,
      ufcc: auth.ufcc,
    });
    if (ok) any = true;
  }
  return any;
};

/** Emit a reaction. */
export const emitReaction = (
  auth: AuthLike | null,
  payload: Record<string, unknown>
): boolean => {
  if (!auth) return false;
  return emitSendReaction({
    Id: auth.SocketId ?? auth.id,
    ufcc: auth.ufcc,
    SenderId: auth.id,
    ...payload,
  });
};

/** Emit a reaction removal. */
export const emitReactionRemove = (
  auth: AuthLike | null,
  payload: Record<string, unknown>
): boolean => {
  if (!auth) return false;
  return emitRemoveReaction({
    Id: auth.SocketId ?? auth.id,
    ufcc: auth.ufcc,
    SenderId: auth.id,
    ...payload,
  });
};

/** Emit typing indicator. */
export const emitTyping = (payload: Record<string, unknown>): boolean => {
  return emitInternalTyping(payload);
};

/** Emit message deletion. */
export const emitDeleteMessage = (payload: Record<string, unknown>): boolean => {
  return emitInternalMessageDelete(payload);
};
