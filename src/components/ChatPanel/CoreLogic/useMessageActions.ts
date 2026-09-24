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
import { UI, type UIAction, type ReplyToMessage, type MediaFileItem } from "./uiReducer";
import { getLocalTime } from "./messageHelpers";
import { emitTextMessage, emitDeleteMessage } from "./socketHelpers";
import { showToast } from "../../../utils/toastHelper";
import { updateMessageEdit, updateMessageStar, deleteMessage, deleteMessageRow } from "../../../db/messageCache";
import { addToOutbox, removeFromOutbox, updateOutboxStatus } from "../../../db/outboxCache";
import { playSound } from "../../../utils/sound";
import type { AuthData } from "../../../contexts/LoginData";
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
    mediaFiles: MediaFileItem[];
  };
  dispatchUI: React.Dispatch<UIAction>;
  dispatchMsg: React.Dispatch<MsgAction>;
  onCustomerSelect?: ((customer: ConversationListEntry) => void) | null;
  tempConversationId: string | number | null;
  uploadAndSendMedia?: (params: {
    files: File[];
    fileItems: MediaFileItem[];
    caption: string;
    type: string;
    tempId: string;
    tempIds?: string[];
    time: string;
    date: string;
    dateTime: string;
  }) => Promise<void>;
  fetchAndCacheGroupMembers?: (conversationId: string | number) => Promise<{ members: Array<{ UserId?: number; userId?: number; id?: number }> } | null>;
  isOffline?: boolean;
  messagesRef?: React.MutableRefObject<ChatMessage[]>;
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
  isOffline = false,
  messagesRef,
}: UseMessageActionsProps) {
  const handleSendMessage = useCallback(
    async (
      scrollToBottom?: (() => void) | null,
      messageOverride: string | null = null,
      mentions?: MentionData[] | null,
      overrideMediaFiles?: MediaFileItem[]
    ) => {
      const customer = selectedCustomerRef.current || selectedCustomer;
      const caption = (messageOverride !== null ? messageOverride : uiState.inputValue).trim();
      const mediaList = overrideMediaFiles || uiState.mediaFiles;
      if (!caption && !mediaList?.length) return;

      const { time, date, dateTime } = getLocalTime();

      // If media files are queued, delegate to uploadAndSendMedia
      if (mediaList?.length && uploadAndSendMedia) {
        const selected = [...mediaList];
        dispatchUI({ type: UI.SET_INPUT, value: "" });
        dispatchUI({ type: UI.SET_SHOW_MEDIA, value: false });
        dispatchUI({ type: UI.SET_MEDIA_FILES, value: [] });

        const byType: Record<string, MediaFileItem[]> = {
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
          byType[t].push(media);
        }

        for (const [type, list] of Object.entries(byType).filter(([, l]) => l.length > 0)) {
          const files = list.map((item) => item.file);
          const batchTs = Date.now();

          // ── Documents: create individual optimistic messages (one per file)
          // because the backend returns individual MessageIds for each document.
          // Images/videos stay grouped in one message with all attachments.
          if (type === "document" && list.length > 1) {
            const tempIds: string[] = [];
            for (let i = 0; i < list.length; i++) {
              const file = list[i].file;
              const perFileTempId = `${batchTs}-${type}-${i}`;
              tempIds.push(perFileTempId);
              const tempMediaItem = {
                url: URL.createObjectURL(file),
                filename: file.name,
                mimeType: file.type,
                size: file.size,
              };
              dispatchMsg({
                type: MSG.UPSERT,
                id: perFileTempId,
                msg: {
                  Id: perFileTempId,
                  ClientMessageId: perFileTempId,
                  Direction: 1,
                  Status: "pending",
                  MessageType: type,
                  previewUrl: URL.createObjectURL(file),
                  Message: caption,
                  isUploading: true,
                  percent: 0,
                  Time: time,
                  Date: date,
                  DateTime: dateTime,
                  mediaItems: [tempMediaItem],
                  ConversationId: customer?.ConversationId || tempConversationId,
                } as Partial<ChatMessage>,
              });
            }
            if (scrollToBottom) scrollToBottom();
            const batchTempId = `${batchTs}-${type}-batch`;
            await uploadAndSendMedia({ files, fileItems: list, caption, type, tempId: batchTempId, tempIds, time, date, dateTime });
          } else {
            // ── Images/videos or single document: one optimistic message
            const tempId = `${batchTs}-${type}-batch`;
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
                ClientMessageId: tempId,
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
            await uploadAndSendMedia({ files, fileItems: list, caption, type, tempId, time, date, dateTime });
          }
        }
        // Play send sound once after all media batches are uploaded successfully
        playSound("send");
        if (scrollToBottom) scrollToBottom();
        return;
      }

      const replySnapshot = uiState.replyToMessage;
      const rawReplyToMessageId = uiState.storeMessData?.messageId;
      const replyToMessageId = String(rawReplyToMessageId ?? "").trim() || null;
      const replyTarget = replySnapshot && replyToMessageId ? replySnapshot : null;
      const replyTargetId = replyTarget ? replyToMessageId : null;
      const hasReply = replyTarget !== null;
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
          ClientMessageId: tempId,
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
          ...(hasReply
            ? {
                ContextType: 2,
                ContextId: replyTargetId,
                ReplyContextMsg: replyTarget.text || "Media",
                SenderInfo: replyTarget.sender || "",
              }
            : {}),
        } as Partial<ChatMessage>,
      });

      const convIdForOutbox = customer?.ConversationId || tempConversationId;
      const optimisticMsg: ChatMessage = {
        Id: tempId,
        MessageId: tempId,
        Message: caption,
        Time: time,
        Date: date,
        DateTime: dateTime,
        Direction: 1,
        Status: isOffline ? 4 : "pending",
        MessageType: "text",
        ConversationId: convIdForOutbox,
        SenderId: auth?.id,
      } as ChatMessage;
      addToOutbox(auth, optimisticMsg, caption, replyToMessageId, mentionUsersJson).catch(() => {});

      dispatchUI({ type: UI.SET_INPUT, value: "" });
      dispatchUI({ type: UI.SET_REPLY, value: null });
      dispatchMsg({ type: MSG.SET_STORE_MESS, value: { messageId: "" } });
      if (scrollToBottom) scrollToBottom();

      if (isOffline) {
        return;
      }

      try {
        const resp = hasReply
          ? await replyToMessageApi(auth, {
              conversationId: replyTarget.ConversationId || customer?.ConversationId || "",
              replyToMessageId: replyTarget.Id || replyTargetId!,
              ReplyToAttachmentId: replyTarget.ReplyToAttachmentId,
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
          if (convIdForOutbox) {
            updateOutboxStatus(auth, convIdForOutbox, tempId, "failed").catch(() => {});
          }
          if (scrollToBottom) scrollToBottom();
          return;
        }

        const sentId = rd?.MessageId;
        const convId = rd?.ConversationId || customer?.ConversationId;

        // Play send sound only after the API confirms success
        playSound("send");

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

          const replyExtra = hasReply
            ? {
                ContextType: 2,
                ContextId: replyTarget.Id,
                ReplyContextMsg: replyTarget.text || "Media",
                SenderInfo: replyOriginalSenderName,
                Sender: replyOriginalSenderName,
                ReplyToAttachmentId: replyTarget.ReplyToAttachmentId || null,
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
              ClientMessageId: tempId,
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
          if (convIdForOutbox) {
            removeFromOutbox(auth, convIdForOutbox, tempId).catch(() => {});
          }
        } else {
          console.error("Failed to send message");
          dispatchMsg({ type: MSG.UPSERT, id: tempId, msg: { Status: 4 } });
          if (convIdForOutbox) {
            updateOutboxStatus(auth, convIdForOutbox, tempId, "failed").catch(() => {});
          }
        }

        if (rd?.IsNewConversation && convId && onCustomerSelect) {
          onCustomerSelect({ ...customer, ConversationId: convId } as ConversationListEntry);
        }
      } catch (err) {
        console.error("sendTextMessage error:", err);
        dispatchMsg({ type: MSG.UPSERT, id: tempId, msg: { Status: 4 } });
        if (convIdForOutbox) {
          updateOutboxStatus(auth, convIdForOutbox, tempId, "failed").catch(() => {});
        }
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
      isOffline,
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
    dispatchMsg({ type: MSG.SET_STORE_MESS, value: { messageId: "" } });
  }, [dispatchMsg, dispatchUI]);

  const retryFailedMessage = useCallback(
    async (message: ChatMessage) => {
      const conversationId = message.ConversationId;
      const messageId = message.MessageId ?? message.Id;
      if (conversationId == null || messageId == null) return;

      const wasQueued = await updateOutboxStatus(auth, conversationId, messageId, "pending");
      if (!wasQueued) {
        const isMedia = ["image", "video", "document"].includes(message.MessageType || "");
        if (isMedia) {
          showToast("This media is no longer available. Please attach it again.", "error");
          return;
        }
        await addToOutbox(
          auth,
          message,
          String(message.Message ?? ""),
          message.ContextType === 2 ? message.ContextId : null,
          typeof message.MentionUsers === "string" ? message.MentionUsers : null
        );
      }
      dispatchMsg({ type: MSG.UPSERT, id: String(messageId), msg: { Status: "pending" } });
      window.dispatchEvent(new CustomEvent("OUTBOX_RETRY_REQUESTED"));
    },
    [auth, dispatchMsg]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string | number, mode: number) => {
      if (!messageId) return;
      const customer = selectedCustomerRef.current || selectedCustomer;
      try {
        const response = await deleteMessageApi(auth, messageId, mode, customer?.ConversationId);
        const deletedInfo = response?.Data?.rd?.[0] || response?.rd?.[0];
        if (deletedInfo?.stat != 0) {
          const deletedMsg = (messagesRef?.current ?? []).find(
            (m) => String(m.MessageId ?? m.Id ?? "") === String(messageId)
          );
          const notifyListUpdate = (detail: Record<string, unknown>) => {
            if (!customer?.ConversationId) return;
            window.dispatchEvent(
              new CustomEvent("UPDATE_CONVERSATION_ITEM", {
                detail: {
                  ConversationId: customer.ConversationId,
                  isMessageDeletion: true,
                  DeletedMessageId: messageId,
                  isStatusChange: true,
                  ...detail,
                },
              })
            );
          };
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
            // Write-through to IDB — mark as deleted-for-everyone so the
            // "This message was deleted" placeholder survives cache reloads.
            if (customer?.ConversationId) {
              deleteMessage(auth, customer.ConversationId, messageId, deletedInfo).catch(() => {});
            }
            // Update own conversation-list preview in realtime — the socket
            // emit only reaches other users, so the list must be told locally.
            notifyListUpdate({
              MessageId: messageId,
              Message:
                deletedMsg?.Direction === 1
                  ? (deletedInfo.Message1 || "You deleted this message.")
                  : (deletedInfo.Message || "This message was deleted."),
              MessageType: "text",
              IsDeletedForEveryone: 1,
              DateTime: deletedInfo.DeletedAt || new Date().toISOString(),
              SenderId: deletedMsg?.SenderId ?? auth?.id,
            });
          } else {
            dispatchMsg({ type: MSG.DELETE_ME, messageId });
            // Write-through to IDB — remove the row entirely so the deleted
            // message doesn't reappear when the conversation loads from cache.
            if (customer?.ConversationId) {
              deleteMessageRow(auth, customer.ConversationId, messageId).catch(() => {});
            }
            // Delete-for-me removes the row — roll the list preview back to
            // the previous last message (or clear it when none remain).
            const remaining = (messagesRef?.current ?? []).filter(
              (m) => String(m.MessageId ?? m.Id ?? "") !== String(messageId)
            );
            const newLast = remaining[remaining.length - 1];
            notifyListUpdate({
              MessageId: newLast?.MessageId ?? newLast?.Id ?? "",
              Message: newLast?.Message ?? "",
              MessageType: newLast?.MessageType ?? "text",
              IsDeletedForEveryone: newLast?.IsDeletedForEveryone ?? 0,
              DateTime: newLast?.DateTime ?? newLast?.Date ?? "",
              MessageStatus: newLast?.Status,
              SenderId: newLast?.SenderId ?? auth?.id,
            });
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
    [auth, selectedCustomerRef, selectedCustomer, dispatchMsg, fetchAndCacheGroupMembers, messagesRef]
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

          const convId = selectedCustomerRef?.current?.ConversationId ?? selectedCustomer?.ConversationId;
          if (convId) {
            updateMessageEdit(auth, convId, messageId, editedMessage.Message, {
              Time: time, Date: date, ...(mentionUsersJson ? { MentionUsers: mentionUsersJson } : {}),
            }).catch(() => {});
          }

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
      const convId = selectedCustomerRef?.current?.ConversationId ?? selectedCustomer?.ConversationId;
      if (convId) {
        updateMessageStar(auth, convId, messageId, nextStar).catch(() => {});
      }

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
          dispatchMsg({ type: MSG.STAR, messageId, isStar: currentlyStarred ? 1 : 0 });
          if (convId) updateMessageStar(auth, convId, messageId, currentlyStarred ? 1 : 0).catch(() => {});
          showToast(response?.Message || "Failed to update star", "error");
        }
      } catch (err) {
        console.error("handleStarMessage error:", err);
        dispatchMsg({ type: MSG.STAR, messageId, isStar: currentlyStarred ? 1 : 0 });
        showToast("Error updating star", "error");
      }
    },
    [auth, dispatchMsg, selectedCustomer, selectedCustomerRef]
  );

  return {
    handleSendMessage,
    handleEditMessage,
    handleDeleteMessage,
    handleStarMessage,
    handleReply,
    handleCancelReply,
    retryFailedMessage,
  };
}
