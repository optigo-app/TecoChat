"use client";

import { useEffect, useRef, useState } from "react";
import { useSocketContext } from "../../../contexts/SocketContext";
import { getPendingOutbox, removeFromOutbox, updateOutboxStatus } from "../../../db/outboxCache";
import { sendTextMessage, sendImageMessage, sendDocumentMessage, sendVideoMessage } from "../../../API/SendMessage/SendMessageApi";
import { buildMediaPayload, uploadFiles } from "./uploadHelpers";
import { emitMediaMessage, emitTextMessage } from "./socketHelpers";
import { replyToMessageApi } from "../../../API/SendMessage/replyToMessageApi";
import type { AuthData } from "../../../contexts/LoginData";
import type { ChatMessage } from "../../../types/message";
import type { OutboxMessage } from "../../../db/tecoDb";

export function useOutboxSync(auth: AuthData | null) {
  const { status } = useSocketContext();
  const authRef = useRef(auth);
  const [retryVersion, setRetryVersion] = useState(0);
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  useEffect(() => {
    const requestSync = () => setRetryVersion((version) => version + 1);
    window.addEventListener("OUTBOX_RETRY_REQUESTED", requestSync);
    window.addEventListener("online", requestSync);
    return () => {
      window.removeEventListener("OUTBOX_RETRY_REQUESTED", requestSync);
      window.removeEventListener("online", requestSync);
    };
  }, []);

  useEffect(() => {
    if (status !== "connected" || !auth) return;

    let cancelled = false;
    (async () => {
      try {
        const pending = await getPendingOutbox(authRef.current);
        if (cancelled) return;
        if (pending.length === 0) return;

        for (const entry of pending) {
          if (cancelled) break;
          await updateOutboxStatus(authRef.current, entry.conversationId, entry.messageId, "sending");
          window.dispatchEvent(new CustomEvent("OUTBOX_MESSAGE_RETRYING", {
            detail: { tempId: entry.messageId },
          }));

          try {
            const mediaFiles = entry.mediaFiles || [];
            let resp;
            let uploadedUrls: string[] = [];
            let uploadedFiles: File[] = [];
            // Reply context survives offline queueing — rebuild it from the
            // stored outbox entry for both the API call and the socket emit.
            const mediaReplyTo = String(entry.replyTo ?? "").trim();
            const mediaReplyData = entry.data as ChatMessage | undefined;
            const mediaReplyPayload = mediaReplyTo
              ? {
                  contextId: mediaReplyTo,
                  contextMsg: (mediaReplyData?.ReplyContextMsg as string) || "Media",
                  sender: (mediaReplyData?.SenderInfo as string) || "You",
                  attachmentId:
                    (mediaReplyData?.ReplyToAttachmentId as string | number | null) ?? null,
                }
              : null;
            if (mediaFiles.length > 0 && entry.mediaType) {
              const files = mediaFiles.map((item) =>
                new File([item.blob], item.name, { type: item.type, lastModified: item.lastModified })
              );
              uploadedFiles = files;
              uploadedUrls = await uploadFiles({
                files,
                conversationId: entry.conversationId,
                type: entry.mediaType,
              });
              const attachments = files.map((file, index) => ({
                FileUrl: uploadedUrls[index],
                FileName: file.name,
                MimeType: file.type,
                ...(mediaFiles[index].width && mediaFiles[index].height
                  ? { Width: mediaFiles[index].width, Height: mediaFiles[index].height }
                  : {}),
              }));
              resp = mediaReplyTo
                ? await replyToMessageApi(authRef.current, {
                    conversationId: entry.conversationId,
                    replyToMessageId: mediaReplyTo,
                    ReplyToAttachmentId:
                      (mediaReplyData?.ReplyToAttachmentId as string | number | null) ?? null,
                    message: entry.text,
                    messageType:
                      entry.mediaType === "image" ? 2 : entry.mediaType === "video" ? 3 : 4,
                    receiverId: Array.isArray(entry.receiverId)
                      ? entry.receiverId.map(String)
                      : entry.receiverId ?? undefined,
                    attachments,
                  })
                : await (entry.mediaType === "image"
                    ? sendImageMessage
                    : entry.mediaType === "video"
                    ? sendVideoMessage
                    : sendDocumentMessage)(authRef.current, {
                    senderId: authRef.current?.id,
                    receiverId: Array.isArray(entry.receiverId)
                      ? entry.receiverId.map(String)
                      : entry.receiverId ?? undefined,
                    conversationId: entry.conversationId,
                    caption: entry.text,
                    attachments,
                  });
            } else {
              const replyTo = String(entry.replyTo ?? "").trim();
              const isReply = replyTo.length > 0;
              resp = isReply
                ? await replyToMessageApi(authRef.current, {
                    conversationId: entry.conversationId,
                    replyToMessageId: replyTo,
                    message: entry.text,
                    messageType: 1,
                    mentionUsers: entry.mentionUsers
                      ? JSON.parse(entry.mentionUsers)
                      : null,
                  })
                : await sendTextMessage(authRef.current, {
                    senderId: authRef.current?.id,
                    conversationId: entry.conversationId,
                    message: entry.text,
                    mentionUsers: entry.mentionUsers
                      ? JSON.parse(entry.mentionUsers)
                      : null,
                  } as { senderId?: string | number; conversationId?: string | number | null; message: string; mentionUsers?: Array<{ MentionedUserId: string | number; MentionText: string; MentionType: number }> | null });
            }

            const rd = resp?.Data?.rd?.[0];
            if (rd?.stat === 1 || rd?.stat === "1") {
              let mediaItems;
              if (entry.mediaType && uploadedUrls.length > 0) {
                let serverAttachments: Array<Record<string, unknown>> = [];
                try {
                  const raw = (rd as Record<string, unknown>).Attachments;
                  serverAttachments = raw
                    ? (typeof raw === "string" ? JSON.parse(raw) : raw) || []
                    : [];
                } catch {
                  serverAttachments = [];
                }
                mediaItems = uploadedFiles.map((file, index) => {
                  // Carry Width/Height into mediaItems so bubbles reserve the
                  // correct aspect ratio — fall back to the server-returned
                  // attachment dims if the outbox file record lacks them.
                  const w = Number(mediaFiles[index]?.width ?? serverAttachments[index]?.Width) || null;
                  const h = Number(mediaFiles[index]?.height ?? serverAttachments[index]?.Height) || null;
                  return {
                    url: uploadedUrls[index],
                    filename: file.name,
                    mimeType: file.type,
                    size: file.size,
                    attachmentId: String(serverAttachments[index]?.Id ?? serverAttachments[index]?.id ?? "") || null,
                    ...(w && h ? { width: w, height: h } : {}),
                  };
                });

                // ── Documents: backend returns comma-separated MessageIds
                // (one per document). Emit individual socket messages and
                // individual OUTBOX_MESSAGE_SENT events for each document.
                const sentIds = rd.MessageId
                  ? String(rd.MessageId).split(",").map((id) => id.trim()).filter(Boolean)
                  : [];

                if (entry.mediaType === "document" && sentIds.length > 1 && sentIds.length === uploadedFiles.length) {
                  for (let index = 0; index < sentIds.length; index++) {
                    const messageId = sentIds[index];
                    const singleMediaItem = [mediaItems[index]];
                    const tid = entry.tempIds?.[index] ?? `${entry.messageId}-${index}`;

                    emitMediaMessage(
                      buildMediaPayload({
                        auth: authRef.current,
                        selectedCustomer: {
                          ConversationId: entry.conversationId,
                          ReceiverId: Array.isArray(entry.receiverId)
                            ? entry.receiverId.map(String)
                            : entry.receiverId ?? undefined,
                          ConversationName: entry.conversationName,
                        },
                        sentId: messageId,
                        tempId: tid,
                        type: entry.mediaType,
                        uploadedUrls: [uploadedUrls[index]],
                        mediaItems: singleMediaItem,
                        caption: entry.text,
                        time: entry.time || "",
                        date: entry.date || "",
                        dateTime: entry.dateTime || "",
                        isGroup: entry.isGroup ?? false,
                        memberIds: entry.memberIds ?? [],
                        reply: mediaReplyPayload,
                      })
                    );

                    window.dispatchEvent(new CustomEvent("OUTBOX_MESSAGE_SENT", {
                      detail: {
                        tempId: tid,
                        serverId: messageId,
                        conversationId: entry.conversationId,
                        Message: entry.text,
                        MessageType: entry.mediaType,
                        mediaItems: singleMediaItem,
                        previewUrl: uploadedUrls[index],
                        Time: entry.time,
                        Date: entry.date,
                        DateTime: entry.dateTime,
                        Direction: 1,
                        SenderId: authRef.current?.id,
                      },
                    }));
                  }
                  // Also dispatch a sentinel event to remove the original temp message
                  window.dispatchEvent(new CustomEvent("OUTBOX_MESSAGE_SENT", {
                    detail: {
                      tempId: entry.messageId,
                      serverId: null,
                      conversationId: entry.conversationId,
                    },
                  }));
                } else {
                  // Single message (images, videos, or single document)
                  emitMediaMessage(
                    buildMediaPayload({
                      auth: authRef.current,
                      selectedCustomer: {
                        ConversationId: entry.conversationId,
                        ReceiverId: Array.isArray(entry.receiverId)
                          ? entry.receiverId.map(String)
                          : entry.receiverId ?? undefined,
                        ConversationName: entry.conversationName,
                      },
                      sentId: rd.MessageId,
                      tempId: entry.messageId,
                      type: entry.mediaType,
                      uploadedUrls,
                      mediaItems,
                      caption: entry.text,
                      time: entry.time || "",
                      date: entry.date || "",
                      dateTime: entry.dateTime || "",
                      isGroup: entry.isGroup ?? false,
                      memberIds: entry.memberIds ?? [],
                      reply: mediaReplyPayload,
                    })
                  );
                  window.dispatchEvent(new CustomEvent("OUTBOX_MESSAGE_SENT", {
                    detail: {
                      tempId: entry.messageId,
                      serverId: rd.MessageId,
                      conversationId: entry.conversationId,
                      ...(mediaItems ? {
                        Message: entry.text,
                        MessageType: entry.mediaType,
                        mediaItems,
                        previewUrl: uploadedUrls[0],
                        Time: entry.time,
                        Date: entry.date,
                        DateTime: entry.dateTime,
                        Direction: 1,
                        SenderId: authRef.current?.id,
                      } : {}),
                    },
                  }));
                }
              } else {
                // Text message — emit the socket event so receivers get it in
                // realtime (the media path above does the same). Backend-
                // normalized mentions from the API response take precedence
                // over the stored client-built list.
                const rdMentions = (rd as Record<string, unknown>)?.MentionUsers;
                const mentionUsersJson =
                  typeof rdMentions === "string" && rdMentions.trim()
                    ? rdMentions
                    : entry.mentionUsers || undefined;

                emitTextMessage({
                  auth: authRef.current,
                  selectedCustomer: {
                    ConversationId: entry.conversationId,
                    ReceiverId: Array.isArray(entry.receiverId)
                      ? entry.receiverId.map(String)
                      : entry.receiverId ?? undefined,
                    ConversationName: entry.conversationName,
                    IsGroup: entry.isGroup ? 1 : 0,
                  },
                  messageId: rd.MessageId,
                  message: entry.text,
                  isEdited: 0,
                  receiverIds: entry.memberIds?.length
                    ? entry.memberIds
                    : (entry.receiverId ?? ""),
                  extra: {
                    Status: 1,
                    MessageStatus: 1,
                    MessageType: "text",
                    Time: entry.time || "",
                    Date: entry.date || "",
                    DateTime: entry.dateTime || "",
                    ClientMessageId: entry.messageId,
                    ConversationId: entry.conversationId,
                    ...(mentionUsersJson ? { MentionUsers: mentionUsersJson } : {}),
                    ...(String(entry.replyTo ?? "").trim()
                      ? { ContextType: 2, ContextId: entry.replyTo }
                      : {}),
                  },
                });

                window.dispatchEvent(new CustomEvent("OUTBOX_MESSAGE_SENT", {
                  detail: {
                    tempId: entry.messageId,
                    serverId: rd.MessageId,
                    conversationId: entry.conversationId,
                  },
                }));
              }
              await removeFromOutbox(authRef.current, entry.conversationId, entry.messageId);
            } else {
              await updateOutboxStatus(authRef.current, entry.conversationId, entry.messageId, "failed");
              window.dispatchEvent(new CustomEvent("OUTBOX_MESSAGE_FAILED", {
                detail: { tempId: entry.messageId, conversationId: entry.conversationId },
              }));
            }
          } catch {
            await updateOutboxStatus(authRef.current, entry.conversationId, entry.messageId, "failed");
            window.dispatchEvent(new CustomEvent("OUTBOX_MESSAGE_FAILED", {
              detail: { tempId: entry.messageId, conversationId: entry.conversationId },
            }));
          }
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, auth, retryVersion]);
}
