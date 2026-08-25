"use client";

// ─── useMessageActions ──────────────────────────────────────────────────────
// Ported from OldChatReactCode/.../CoreLogic/useMessageActions.js
// Handles sending, editing, deleting, and replying to messages.

import { useCallback } from "react";
import { sendTextMessage } from "../../../API/SendMessage/SendMessageApi";
import { deleteMessageApi } from "../../../API/SendMessage/DeleteMessageApi";
import { editMessageApi } from "../../../API/SendMessage/EditMessageApi";
import { replyToMessageApi } from "../../../API/SendMessage/replyToMessageApi";
import { starMessageApi } from "../../../API/SendMessage/starMessageApi";
import { MSG, type MsgAction } from "./conversationReducer";
import { UI, type UIAction, type ReplyToMessage } from "./uiReducer";
import { getLocalTime } from "./messageHelpers";
import { emitTextMessage, emitDeleteMessage } from "./socketHelpers";
import { showToast } from "../../../utils/toastHelper";
import type { AuthData } from "../../../context/LoginData";
import type { ChatMessage } from "../../../types/message";
import type { ConversationListEntry } from "../../../types/conversation";
import type { MentionData } from "../input/MentionPlugin";

interface UseMessageActionsProps {
  auth: AuthData | null;
  selectedCustomer: ConversationListEntry | null;
  selectedCustomerRef: React.MutableRefObject<ConversationListEntry | null>;
  uiState: {
    inputValue: string;
    replyToMessage: ReplyToMessage | null;
    storeMessData: { messageId: string };
    mediaFiles: Array<{ file: File }>;
  };
  dispatchUI: React.Dispatch<UIAction>;
  dispatchMsg: React.Dispatch<MsgAction>;
  onCustomerSelect?: ((customer: ConversationListEntry) => void) | null;
  tempConversationId: string | number | null;
  uploadAndSendMedia?: (params: {
    files: File[];
    caption: string;
    type: string;
    tempId: string;
    time: string;
    date: string;
    dateTime: string;
  }) => Promise<void>;
  fetchAndCacheGroupMembers?: (conversationId: string | number) => Promise<{ members: Array<{ UserId?: number; userId?: number; id?: number }> } | null>;
}

export function useMessageActions({
  auth,
  selectedCustomer,
  selectedCustomerRef,
  uiState,
  dispatchUI,
  dispatchMsg,
  onCustomerSelect,
  tempConversationId,
  uploadAndSendMedia,
  fetchAndCacheGroupMembers,
}: UseMessageActionsProps) {
  const handleSendMessage = useCallback(
    async (
      scrollToBottom?: (() => void) | null,
      messageOverride: string | null = null,
      mentions?: MentionData[] | null
    ) => {
      const customer = selectedCustomerRef.current || selectedCustomer;
      const caption = (messageOverride !== null ? messageOverride : uiState.inputValue).trim();
      if (!caption && !uiState.mediaFiles?.length) return;

      const { time, date, dateTime } = getLocalTime();

      // If media files are queued, delegate to uploadAndSendMedia
      if (uiState.mediaFiles?.length && uploadAndSendMedia) {
        const selected = [...uiState.mediaFiles];
        dispatchUI({ type: UI.SET_INPUT, value: "" });
        dispatchUI({ type: UI.SET_SHOW_MEDIA, value: false });
        dispatchUI({ type: UI.SET_MEDIA_FILES, value: [] });

        const byType: Record<string, Array<{ file: File }>> = {
          image: [],
          video: [],
          document: [],
        };
        for (const media of selected) {
          const file = media.file || (media as unknown as File);
          if (!(file instanceof File)) continue;
          const t = file.type.startsWith("image/")
            ? "image"
            : file.type.startsWith("video/")
            ? "video"
            : "document";
          byType[t].push({ file });
        }

        for (const [type, list] of Object.entries(byType).filter(([, l]) => l.length > 0)) {
          const tempId = `${Date.now()}-${type}-batch`;
          const files = list.map(({ file }) => file);
          const tempMediaItems = list.map(({ file }) => ({
            url: URL.createObjectURL(file),
            filename: file.name,
            mimeType: file.type,
            size: file.size,
          }));
          dispatchMsg({
            type: MSG.UPSERT,
            id: tempId,
            msg: {
              Id: tempId,
              Direction: 1,
              Status: "pending",
              MessageType: type,
              previewUrl: URL.createObjectURL(files[0]),
              Message: caption,
              isUploading: true,
              percent: 0,
              Time: time,
              Date: date,
              DateTime: dateTime,
              mediaItems: tempMediaItems,
              ConversationId: customer?.ConversationId || tempConversationId,
            } as Partial<ChatMessage>,
          });
          if (scrollToBottom) scrollToBottom();
          await uploadAndSendMedia({ files, caption, type, tempId, time, date, dateTime });
        }
        if (scrollToBottom) scrollToBottom();
        return;
      }

      const replySnapshot = uiState.replyToMessage;
      const replyToMessageId = uiState.storeMessData?.messageId;
      const tempId = `${Date.now()}-${Math.random()}`;

      // Serialize mentions for local optimistic message
      const mentionUsersJson = mentions && mentions.length > 0
        ? JSON.stringify(mentions.map((m) => ({
            MentionedUserId: String(m.userId) === "all" ? "" : m.userId,
            MentionText: m.mentionText,
            MentionType: String(m.userId) === "all" ? 2 : 1,
          })))
        : undefined;

      dispatchMsg({
        type: MSG.UPSERT,
        id: tempId,
        msg: {
          Id: tempId,
          Message: caption,
          Time: time,
          Date: date,
          DateTime: dateTime,
          Direction: 1,
          Status: "pending",
          MessageType: "text",
          ConversationId: customer?.ConversationId || tempConversationId,
          SenderId: auth?.id,
          ...(mentionUsersJson ? { MentionUsers: mentionUsersJson, Mentions: mentionUsersJson } : {}),
          ...(replySnapshot && replyToMessageId
            ? {
                ContextType: 2,
                ContextId: replyToMessageId,
                ReplyContextMsg: replySnapshot.text || "Media",
                SenderInfo: replySnapshot.sender || "",
              }
            : {}),
        } as Partial<ChatMessage>,
      });

      dispatchUI({ type: UI.SET_INPUT, value: "" });
      dispatchUI({ type: UI.SET_REPLY, value: null });
      if (scrollToBottom) scrollToBottom();

      try {
        const isReply = !!(replySnapshot && replyToMessageId);
        const resp = isReply
          ? await replyToMessageApi(auth, {
              conversationId: replySnapshot.ConversationId || customer?.ConversationId || "",
              replyToMessageId: replySnapshot.Id || replyToMessageId,
              ReplyToAttachmentId: replySnapshot.ReplyToAttachmentId,
              message: caption,
              messageType: 1,
            })
          : await sendTextMessage(auth, {
              senderId: auth?.id,
              receiverId:
                (customer as { CustomerId?: string | number })?.CustomerId ||
                (customer as { UserId?: string | number })?.UserId,
              conversationId: customer?.ConversationId ?? null,
              message: caption,
              mentionUsers: mentions && mentions.length > 0
                ? mentions.map((m) => ({
                    MentionedUserId: String(m.userId) === "all" ? "" : m.userId,
                    MentionText: m.mentionText,
                    MentionType: String(m.userId) === "all" ? 2 : 1,
                  }))
                : null,
            } as { senderId?: string | number; receiverId?: string | number | string[]; conversationId?: string | number | null; message: string; mentionUsers?: Array<{ MentionedUserId: string | number; MentionText: string; MentionType: number }> | null });

        const rd = resp?.Data?.rd?.[0];
        const stat = rd?.stat;
        const statMsg = rd?.stat_msg;

        if (stat === 0) {
          const errorMsg = statMsg
            ? statMsg.replace(/^"|"$/g, "")
            : "Failed to send message";
          console.error(errorMsg);
          dispatchMsg({ type: MSG.UPSERT, id: tempId, msg: { Status: 4 } });
          if (scrollToBottom) scrollToBottom();
          return;
        }

        const sentId = rd?.MessageId;
        const convId = rd?.ConversationId || customer?.ConversationId;

        if (sentId) {
          // For groups, fetch member IDs so the socket payload includes all recipients
          const isGroup = customer?.IsGroup === 1;
          let receiverIds: string | number | string[] | number[] =
            (customer as { ReceiverId?: string | number })?.ReceiverId ||
            (customer as { UserId?: string | number })?.UserId ||
            (customer as { SenderId?: string | number })?.SenderId || "";
          if (isGroup && fetchAndCacheGroupMembers && customer?.ConversationId) {
            try {
              const groupData = await fetchAndCacheGroupMembers(customer.ConversationId);
              const memberIds = (groupData?.members || [])
                .map((m) => Number(m.UserId || m.userId || m.id))
                .filter(Boolean);
              if (memberIds.length > 0) receiverIds = memberIds;
            } catch {
              // fallback to single ReceiverId
            }
          }

          // Build reply context fields so receiver can render the reply preview
          const replyOriginalSenderName =
            replySnapshot?.sender === "You"
              ? (auth?.username || auth?.userId || "You")
              : (replySnapshot?.sender || (customer as { name?: string })?.name || "Customer");

          const replyExtra = isReply && replySnapshot
            ? {
                ContextType: 2,
                ContextId: replySnapshot.Id,
                ReplyContextMsg: replySnapshot.text || "Media",
                SenderInfo: replyOriginalSenderName,
                Sender: replyOriginalSenderName,
                ReplyToAttachmentId: replySnapshot.ReplyToAttachmentId || null,
              }
            : {};

          emitTextMessage({
            auth,
            selectedCustomer: customer as { ConversationId?: string | number; ReceiverId?: string | number | string[] | number[]; IsGroup?: 0 | 1; name?: string; ConversationName?: string; MemberName?: string; UserName?: string; CustomerName?: string } | null,
            messageId: sentId,
            message: caption,
            isEdited: 0,
            receiverIds,
            extra: {
              Status: 1,
              MessageStatus: 1,
              MessageType: "text",
              Time: time,
              Date: date,
              DateTime: dateTime,
              ConversationId: convId || tempConversationId,
              ...(mentionUsersJson ? { MentionUsers: mentionUsersJson } : {}),
              ...replyExtra,
            },
          });
          dispatchMsg({
            type: MSG.UPSERT,
            id: tempId,
            msg: {
              Id: sentId,
              MessageId: sentId,
              Status: 1,
              SenderId: auth?.id,
              Direction: 1,
              ...(mentionUsersJson ? { MentionUsers: mentionUsersJson, Mentions: mentionUsersJson } : {}),
            },
          });
        } else {
          console.error("Failed to send message");
          dispatchMsg({ type: MSG.UPSERT, id: tempId, msg: { Status: 4 } });
        }

        if (rd?.IsNewConversation && convId && onCustomerSelect) {
          onCustomerSelect({ ...customer, ConversationId: convId } as ConversationListEntry);
        }
      } catch (err) {
        console.error("sendTextMessage error:", err);
        dispatchMsg({ type: MSG.UPSERT, id: tempId, msg: { Status: 4 } });
      }

      if (scrollToBottom) scrollToBottom();
    },
    [
      auth,
      selectedCustomerRef,
      selectedCustomer,
      uiState.inputValue,
      uiState.replyToMessage,
      uiState.storeMessData,
      uiState.mediaFiles,
      tempConversationId,
      onCustomerSelect,
      uploadAndSendMedia,
      dispatchUI,
      dispatchMsg,
    ]
  );

  const handleReply = useCallback(
    (message: ChatMessage) => {
      dispatchMsg({
        type: MSG.SET_STORE_MESS,
        value: { messageId: String(message?.MessageId ?? "") },
      });
      const replyText = message?.Message?.trim() || "Media";
      const currentCustomer = selectedCustomerRef.current || selectedCustomer;
      const originalSenderName: string =
        message?.Direction === 1
          ? "You"
          : (message?.SenderInfo as string) ||
            (message?.FirstName
              ? `${message.FirstName} ${message.LastName || ""}`.trim()
              : (currentCustomer?.DisplayName as string) || "Customer");

      dispatchUI({
        type: UI.SET_REPLY,
        value: {
          Id: message?.MessageId || message?.Id,
          ConversationId: message?.ConversationId || currentCustomer?.ConversationId,
          sender: originalSenderName,
          text: replyText,
          MessageType: message?.MessageType,
          ReplyToAttachmentId: (message as any).ReplyToAttachmentId || null,
          mediaUrl:
            (message as any).previewUrl ||
            (message as any).mediaItems?.[0]?.url ||
            (message as any).mediaItems?.[0]?.src ||
            undefined,
        } as ReplyToMessage,
      });
    },
    [selectedCustomerRef, selectedCustomer, dispatchMsg, dispatchUI]
  );

  const handleCancelReply = useCallback(() => {
    dispatchUI({ type: UI.SET_REPLY, value: null });
  }, [dispatchUI]);

  const handleDeleteMessage = useCallback(
    async (messageId: string | number, mode: number) => {
      if (!messageId) return;
      const customer = selectedCustomerRef.current || selectedCustomer;
      try {
        const response = await deleteMessageApi(auth, messageId, mode, customer?.ConversationId);
        const deletedInfo = response?.Data?.rd?.[0] || response?.rd?.[0];
        if (deletedInfo?.stat != 0) {
          if (Number(mode) === 2) {
            dispatchMsg({ type: MSG.DELETE_ALL, messageId, deletedInfo });
            const isGroup = customer?.IsGroup === 1;
            let memberIds: number[] = [];
            if (isGroup && fetchAndCacheGroupMembers && customer?.ConversationId) {
              try {
                const groupData = await fetchAndCacheGroupMembers(customer.ConversationId);
                memberIds = (groupData?.members || [])
                  .map((m) => Number(m.UserId || m.userId || m.id))
                  .filter(Boolean);
              } catch {
                // fallback below
              }
            }
            emitDeleteMessage({
              ufcc: auth?.ufcc,
              UserId: auth?.id,
              SenderId: auth?.id,
              ReceiverId: isGroup
                ? (memberIds.length ? memberIds : [customer?.ReceiverId].filter(Boolean))
                : customer?.ReceiverId,
              ConversationId: customer?.ConversationId,
              MessageId: messageId,
              Message: deletedInfo.Message || "This message was deleted.",
              Message1: deletedInfo.Message1 || "You deleted this message.",
              MessageType: 1,
              IsDeletedForEveryone: 1,
              DateTime: deletedInfo.DeletedAt || new Date().toISOString(),
              DeletedAt: deletedInfo.DeletedAt || new Date().toISOString(),
            });
          } else {
            dispatchMsg({ type: MSG.DELETE_ME, messageId });
          }
          showToast("Message deleted successfully", "success");
        } else {
          showToast(response?.Message || "Failed to delete message", "error");
        }
      } catch (err) {
        console.error("handleDeleteMessage error:", err);
        showToast("Error deleting message", "error");
      }
    },
    [auth, selectedCustomerRef, selectedCustomer, dispatchMsg, fetchAndCacheGroupMembers]
  );

  const handleEditMessage = useCallback(
    async (
      messageId: string | number,
      newMessage: string,
      mentions?: MentionData[] | null
    ) => {
      if (!messageId || !newMessage?.trim()) return;
      const { time, date, dateTime } = getLocalTime();

      // Serialize mentions for the API (same format as send)
      const mentionUsers = mentions && mentions.length > 0
        ? mentions.map((m) => ({
            MentionedUserId: String(m.userId) === "all" ? "" : m.userId,
            MentionText: m.mentionText,
            MentionType: String(m.userId) === "all" ? 2 : 1,
          }))
        : null;

      // Serialize mentions for local optimistic update
      const mentionUsersJson = mentionUsers
        ? JSON.stringify(mentionUsers)
        : undefined;

      try {
        const response = await editMessageApi(auth, {
          messageId,
          newMessage,
          mentionUsers,
        });
        if (response?.Data?.rd?.[0]?.stat == 1) {
          const editedMessage = response.Data.rd[0];

          // Local update
          dispatchMsg({
            type: MSG.EDIT,
            messageId,
            newMessage: editedMessage.Message,
            time,
            date,
            ...(mentionUsersJson ? { MentionUsers: mentionUsersJson } : {}),
          });

          // Emit socket event so other participants see the edit in real-time
          const customer = selectedCustomerRef?.current || selectedCustomer;
          const isGroup = (customer as { IsGroup?: number })?.IsGroup === 1;
          let receiverIds: string | number | string[] | number[] =
            (customer as { ReceiverId?: string | number | string[] | number[] })?.ReceiverId ||
            (customer as { UserId?: string | number })?.UserId ||
            "";
          if (isGroup && fetchAndCacheGroupMembers && customer?.ConversationId) {
            try {
              const groupData = await fetchAndCacheGroupMembers(customer.ConversationId);
              const memberIds = (groupData?.members || [])
                .map((m) => Number(m.UserId || m.userId || m.id))
                .filter(Boolean);
              if (memberIds.length > 0) receiverIds = memberIds;
            } catch {
              // fallback to single ReceiverId
            }
          }

          emitTextMessage({
            auth,
            selectedCustomer: customer as {
              ConversationId?: string | number;
              ReceiverId?: string | number | string[] | number[];
              IsGroup?: 0 | 1;
              name?: string;
              ConversationName?: string;
              MemberName?: string;
              UserName?: string;
              CustomerName?: string;
            } | null,
            messageId,
            message: editedMessage.Message,
            isEdited: 1,
            receiverIds,
            extra: {
              Time: time,
              Date: date,
              DateTime: dateTime,
              ConversationId: customer?.ConversationId,
              ...(mentionUsersJson ? { MentionUsers: mentionUsersJson } : {}),
            },
          });

          showToast("Message edited successfully", "success");
        } else {
          showToast(response?.Message || "Failed to edit message", "error");
        }
      } catch (err) {
        console.error("handleEditMessage error:", err);
        showToast("Error editing message", "error");
      }
    },
    [auth, dispatchMsg, selectedCustomer, selectedCustomerRef, fetchAndCacheGroupMembers]
  );

  const handleStarMessage = useCallback(
    async (message: ChatMessage) => {
      const messageId = message?.MessageId ?? message?.Id;
      if (!messageId || !auth) return;

      const currentlyStarred = message?.IsStar === 1;
      const nextStar: 0 | 1 = currentlyStarred ? 0 : 1;

      // Optimistic update
      dispatchMsg({ type: MSG.STAR, messageId, isStar: nextStar });

      try {
        const response = await starMessageApi(auth, { messageId, isStar: nextStar });
        const rd = response?.Data?.rd?.[0] || response?.rd?.[0];
        if (rd?.stat == 1 || rd?.stat == 0) {
          // Confirm with the value the server returned (if any), else keep optimistic
          const serverStar: 0 | 1 | undefined =
            typeof rd.IsStar === "number" ? (rd.IsStar as 0 | 1) : undefined;
          if (serverStar != null && serverStar !== nextStar) {
            dispatchMsg({ type: MSG.STAR, messageId, isStar: serverStar });
          }
          showToast(nextStar === 1 ? "Message starred" : "Star removed", "success");
        } else {
          // Revert on failure
          dispatchMsg({ type: MSG.STAR, messageId, isStar: currentlyStarred ? 1 : 0 });
          showToast(response?.Message || "Failed to update star", "error");
        }
      } catch (err) {
        console.error("handleStarMessage error:", err);
        dispatchMsg({ type: MSG.STAR, messageId, isStar: currentlyStarred ? 1 : 0 });
        showToast("Error updating star", "error");
      }
    },
    [auth, dispatchMsg]
  );

  return {
    handleSendMessage,
    handleEditMessage,
    handleDeleteMessage,
    handleStarMessage,
    handleReply,
    handleCancelReply,
  };
}
