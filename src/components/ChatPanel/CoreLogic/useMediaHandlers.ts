"use client";

// ─── useMediaHandlers ───────────────────────────────────────────────────────
// Ported from OldChatReactCode/.../CoreLogic/useMediaHandlers.js
// Handles file selection, validation, upload, and media viewer.

import { useCallback } from "react";
import { MSG, type MsgAction } from "./conversationReducer";
import { UI, type UIAction, type MediaFileItem } from "./uiReducer";
import { validateMediaFiles, getMediaDimensions, uploadFiles, buildMediaPayload } from "./uploadHelpers";
import { emitMediaMessage } from "./socketHelpers";
import { sendImageMessage, sendDocumentMessage, sendVideoMessage } from "../../../API/SendMessage/SendMessageApi";
import { showToast } from "../../../utils/toastHelper";
import { addToOutbox } from "../../../db/outboxCache";
import { isTextFile } from "../../../utils/txtUtils";
import type { AuthData } from "../../../contexts/LoginData";
import type { ChatMessage } from "../../../types/message";
import type { ConversationListEntry } from "../../../types/conversation";

interface UseMediaHandlersProps {
  auth: AuthData | null;
  selectedCustomer: ConversationListEntry | null;
  selectedCustomerRef: React.MutableRefObject<ConversationListEntry | null>;
  uiState: { showMedia: boolean; mediaFiles: MediaFileItem[] };
  dispatchUI: React.Dispatch<UIAction>;
  dispatchMsg: React.Dispatch<MsgAction>;
  tempConversationId: string | number | null;
  fetchAndCacheGroupMembers?: (conversationId: string | number) => Promise<{ members: Array<{ UserId?: number; userId?: number; id?: number }> } | null>;
  onCustomerSelect?: ((customer: ConversationListEntry) => void) | null;
  isOffline?: boolean;
}

export function useMediaHandlers({
  auth,
  selectedCustomer,
  selectedCustomerRef,
  uiState,
  dispatchUI,
  dispatchMsg,
  tempConversationId,
  fetchAndCacheGroupMembers,
  onCustomerSelect,
  isOffline = false,
}: UseMediaHandlersProps) {
  const handleAttachClick = useCallback(() => {
    dispatchUI({ type: UI.SET_SHOW_MEDIA, value: !uiState.showMedia });
  }, [uiState.showMedia, dispatchUI]);

  const buildMediaFileItems = useCallback(
    async (files: File[]): Promise<MediaFileItem[]> => {
      // Phase 1: Create preview URLs and basic file items synchronously (fast)
      const items = files.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        type: file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
          ? "video"
          : "file",
        name: file.name,
        size: file.size,
      }));

      // Phase 2: Get dimensions lazily — only for images/videos, and don't block the UI
      // Use requestIdleCallback to defer dimension loading until the browser is idle
      const getDims = (file: File): Promise<{ width: number; height: number } | null> => {
        return new Promise((resolve) => {
          const done = (dim: { width: number; height: number } | null) => {
            if (dim) {
              (file as File & { width?: number; height?: number }).width = dim.width;
              (file as File & { width?: number; height?: number }).height = dim.height;
            }
            resolve(dim);
          };
          if (typeof requestIdleCallback !== "undefined") {
            requestIdleCallback(() => done(getMediaDimensionsSync(file)));
          } else {
            setTimeout(() => done(getMediaDimensionsSync(file)), 0);
          }
        });
      };

      // Lightweight synchronous dimension check (no async Image load)
      function getMediaDimensionsSync(file: File): { width: number; height: number } | null {
        // For images, we can get dimensions from the File object if available
        const withDim = file as File & { width?: number; height?: number };
        if (withDim.width && withDim.height) return { width: withDim.width, height: withDim.height };
        return null;
      }

      // Load dimensions in parallel without blocking the drop handler
      Promise.all(
        files.map(async (file, i) => {
          if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
            const dim = await getMediaDimensions(file);
            if (dim) {
              (items[i] as MediaFileItem & { width?: number; height?: number }).width = dim.width;
              (items[i] as MediaFileItem & { height?: number }).height = dim.height;
            }
          }
        })
      );

      return items as MediaFileItem[];
    },
    []
  );

  const processFiles = useCallback(
    async (files: File[], mode?: "replace" | "add") => {
      if (!files?.length) return;
      const { acceptedFiles, skippedSize, skippedTotal, skippedCount } =
        validateMediaFiles(files);

      if (skippedCount > 0) showToast(`Only 30 files allowed. ${skippedCount} removed.`, "error");
      if (skippedSize.length > 0) showToast(`Files too large: ${skippedSize.slice(0, 2).join(", ")}`, "error");
      if (skippedTotal.length > 0) showToast("Total selection exceeds 100MB.", "error");
      if (!acceptedFiles.length) return;

      // Build media file items — now fast (URLs created sync, dimensions loaded async)
      const newMediaFiles = await buildMediaFileItems(acceptedFiles);

      // If there are already media files and no explicit mode, ask the user
      const existingFiles = uiState.mediaFiles;
      if (existingFiles.length > 0 && !mode) {
        // Dispatch event for ChatPanel to show the replace/add dialog
        window.dispatchEvent(
          new CustomEvent("MEDIA_REPLACE_OR_ADD", {
            detail: {
              newFiles: newMediaFiles,
              existingCount: existingFiles.length,
            },
          })
        );
        return;
      }

      if (mode === "add" && existingFiles.length > 0) {
        const combined = [...existingFiles, ...newMediaFiles];
        dispatchUI({ type: UI.SET_MEDIA_FILES, value: combined });
      } else {
        // Replace (default) — revoke old preview blob URLs before discarding
        existingFiles.forEach((f) => {
          if (f.preview?.startsWith("blob:")) URL.revokeObjectURL(f.preview);
        });
        dispatchUI({ type: UI.SET_MEDIA_FILES, value: newMediaFiles });
      }
      dispatchUI({ type: UI.SET_SHOW_MEDIA, value: false });
    },
    [dispatchUI, uiState.mediaFiles, buildMediaFileItems]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        await processFiles(Array.from(e.target.files));
      }
    },
    [processFiles]
  );

  const handleMediaClick = useCallback(
    (message: ChatMessage, _index: number) => {
      if (!message?.mediaItems?.length) return;
      const items = message.mediaItems.map((item) => ({
        src: item.url,
        type: (item.mimeType?.startsWith("image/")
          ? "image"
          : item.mimeType?.startsWith("video/")
          ? "video"
          : item.mimeType === "application/pdf" ||
            item.filename?.toLowerCase().endsWith(".pdf")
          ? "pdf"
          : isTextFile(item.filename, item.mimeType)
          ? "text"
          : "document") as "image" | "video" | "document" | "pdf" | "text",
        name: item.filename || "Media",
        mimeType: item.mimeType,
        size: item.size,
        attachmentId: (item as any).attachmentId,
      }));

      // ── PDF → open dedicated PDF viewer dialog ──────────────────────────
      // PDFs get their own full-screen viewer with zoom + page navigation,
      // separate from the image/video MediaViewer.
      const clickedItem = items[_index];
      if (clickedItem?.type === "pdf") {
        dispatchUI({ type: UI.SET_PDF_VIEWER, open: true, item: clickedItem });
        return;
      }

      // ── Text files → open dedicated text viewer dialog ──────────────────
      // .txt / .log / .csv / .json / .md etc. get a full-screen text preview
      // instead of downloading directly.
      if (clickedItem?.type === "text") {
        dispatchUI({ type: UI.SET_TXT_VIEWER, open: true, item: clickedItem });
        return;
      }

      dispatchUI({ type: UI.SET_VIEWER, open: true, items, index: _index, message });
    },
    [dispatchUI]
  );

  const handleClosePreview = useCallback(() => {
    dispatchUI({ type: UI.SET_VIEWER, open: false });
  }, [dispatchUI]);

  const handleClosePdfViewer = useCallback(() => {
    dispatchUI({ type: UI.SET_PDF_VIEWER, open: false });
  }, [dispatchUI]);

  const handleCloseTxtViewer = useCallback(() => {
    dispatchUI({ type: UI.SET_TXT_VIEWER, open: false });
  }, [dispatchUI]);

  const handleClearMediaFiles = useCallback(() => {
    // Revoke preview blob URLs before clearing to avoid memory leaks
    uiState.mediaFiles.forEach((f) => {
      if (f.preview?.startsWith("blob:")) URL.revokeObjectURL(f.preview);
    });
    dispatchUI({ type: UI.SET_MEDIA_FILES, value: [] });
    dispatchUI({ type: UI.SET_SHOW_MEDIA, value: false });
  }, [dispatchUI, uiState.mediaFiles]);

  const uploadAndSendMedia = useCallback(
    async ({
      files,
      fileItems,
      caption,
      type,
      tempId,
      tempIds,
      time,
      date,
      dateTime,
    }: {
      files: File[];
      fileItems?: MediaFileItem[];
      caption: string;
      type: string;
      tempId: string;
      tempIds?: string[];
      time: string;
      date: string;
      dateTime: string;
    }) => {
      const safeFiles = files.filter((f) => f instanceof File);
      if (!safeFiles.length) return;

      const customer = selectedCustomerRef.current || selectedCustomer;

      try {
        const isGroup = customer?.IsGroup === 1;
        const groupData = isGroup && fetchAndCacheGroupMembers && customer?.ConversationId
          ? await fetchAndCacheGroupMembers(customer.ConversationId)
          : null;
        const memberIds = (groupData?.members || [])
          .map((m) => Number(m.UserId || m.userId || m.id))
          .filter(Boolean);
        const convId = customer?.ConversationId || tempConversationId;
        const receiverId = (customer as { CustomerId?: string | number })?.CustomerId ||
          (customer as { UserId?: string | number })?.UserId;

        if (isOffline) {
          await addToOutbox(
            auth,
            {
              Id: tempId,
              MessageId: tempId,
              Message: caption,
              ConversationId: convId,
              Direction: 1,
              Status: "pending",
              MessageType: type,
            } as ChatMessage,
            caption,
            null,
            null,
            {
              type,
              receiverId,
              isGroup,
              memberIds,
              time,
              date,
              dateTime,
              conversationName: String(
                customer?.ConversationName || customer?.name || customer?.MemberName || customer?.UserName || ""
              ).trim() || undefined,
              files: safeFiles.map((file, i) => {
                const item = fileItems?.[i];
                return {
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  lastModified: file.lastModified,
                  blob: file,
                  ...(item?.width ? { width: item.width } : {}),
                  ...(item?.height ? { height: item.height } : {}),
                };
              }),
              tempIds,
            }
          );
          // Mark all individual temp messages as pending (not uploading)
          if (tempIds?.length) {
            for (const tid of tempIds) {
              dispatchMsg({ type: MSG.UPSERT, id: tid, msg: { isUploading: false, Status: "pending" } });
            }
          } else {
            dispatchMsg({ type: MSG.UPSERT, id: tempId, msg: { isUploading: false, Status: "pending" } });
          }
          return;
        }

        const uploadedUrls = await uploadFiles({
          files: safeFiles,
          conversationId: convId,
          type,
          onProgress: (percent) => {
            const clamped = Math.max(0, Math.min(99, percent));
            if (tempIds?.length) {
              for (const tid of tempIds) {
                dispatchMsg({ type: MSG.UPSERT, id: tid, msg: { isUploading: true, percent: clamped } });
              }
            } else {
              dispatchMsg({ type: MSG.UPSERT, id: tempId, msg: { isUploading: true, percent: clamped } });
            }
          },
        });

        const attachments = safeFiles.map((f, i) => {
          const item = fileItems?.[i];
          return {
            FileUrl: uploadedUrls[i],
            FileName: f.name,
            MimeType: f.type,
            ...(item?.width && item?.height
              ? { Width: item.width, Height: item.height }
              : {}),
          };
        });
        const mediaItems = safeFiles.map((f, i) => {
          const item = fileItems?.[i];
          return {
            url: uploadedUrls[i],
            filename: f.name,
            mimeType: f.type,
            size: f.size,
            ...(item?.width && item?.height
              ? { width: item.width, height: item.height }
              : {}),
          };
        });

        const sendFn =
          type === "image"
            ? sendImageMessage
            : type === "video"
            ? sendVideoMessage
            : sendDocumentMessage;
        const res = await sendFn(auth, {
          senderId: auth?.id,
          receiverId,
          conversationId: convId,
          caption,
          attachments,
        });

        const rd = res?.Data?.rd?.[0];
        const stat = rd?.stat;
        const statMsg = rd?.stat_msg;

        if (stat === 0) {
          const errorMsg = statMsg ? statMsg.replace(/^"|"$/g, "") : "Failed to send media";
          showToast(errorMsg, "error");
          if (tempIds?.length) {
            for (const tid of tempIds) {
              dispatchMsg({ type: MSG.UPSERT, id: tid, msg: { Status: 4, isUploading: false } });
            }
          } else {
            dispatchMsg({ type: MSG.UPSERT, id: tempId, msg: { Status: 4, isUploading: false } });
          }
          return;
        }

        const sentId = rd?.MessageId;
        const sentConvId = rd?.ConversationId;

        // Enrich mediaItems with server-returned attachment IDs
        const serverAttachments = (() => {
          try {
            const raw = (rd as any)?.Attachments;
            return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
          } catch {
            return [];
          }
        })();
        const enrichedItems = mediaItems.map((item, i) => ({
          ...item,
          attachmentId: serverAttachments[i]?.Id || serverAttachments[i]?.id || null,
        }));

        // ── Documents: backend returns comma-separated MessageIds (one per
        // document). Split into individual messages — each document becomes
        // its own message row, matching the old CRA app behavior.
        const sentIds = sentId ? String(sentId).split(",").map((id) => id.trim()).filter(Boolean) : [];

        if (type === "document" && sentIds.length > 1 && sentIds.length === safeFiles.length) {
          // Update each individual optimistic message with its real server ID
          for (let index = 0; index < sentIds.length; index++) {
            const messageId = sentIds[index];
            const singleMediaItem = [enrichedItems[index]];
            const tid = tempIds?.[index] ?? `${tempId}-${index}`;

            // Emit individual socket message for each document
            emitMediaMessage(
              buildMediaPayload({
                auth,
                selectedCustomer: customer as { ConversationId?: string | number; ReceiverId?: string | number | string[] | number[] } | null,
                sentId: messageId,
                tempId: tid,
                type,
                uploadedUrls: [uploadedUrls[index]],
                mediaItems: singleMediaItem,
                caption,
                time,
                date,
                dateTime,
                isGroup,
                memberIds,
              })
            );

            // Update the individual optimistic message with the real server ID
            dispatchMsg({
              type: MSG.UPSERT,
              id: tid,
              msg: {
                Id: messageId,
                MessageId: messageId,
                ClientMessageId: tid,
                Direction: 1,
                Status: 1,
                MessageType: type,
                Message: caption,
                previewUrl: uploadedUrls[index],
                mediaItems: singleMediaItem,
                isUploading: false,
                percent: 100,
                Time: time,
                Date: date,
                DateTime: dateTime,
                ConversationId: convId,
                SenderId: auth?.id,
              } as Partial<ChatMessage>,
            });
          }
        } else if (sentId) {
          // Images, videos, or single document — one message with all attachments
          emitMediaMessage(
            buildMediaPayload({
              auth,
              selectedCustomer: customer as { ConversationId?: string | number; ReceiverId?: string | number | string[] | number[] } | null,
              sentId,
              tempId,
              type,
              uploadedUrls,
              mediaItems: enrichedItems,
              caption,
              time,
              date,
              dateTime,
              isGroup,
              memberIds,
            })
          );
          dispatchMsg({
            type: MSG.UPSERT,
            id: tempId,
            msg: {
              Id: sentId,
              MessageId: sentId,
              previewUrl: uploadedUrls[0],
              mediaItems: enrichedItems,
              isUploading: false,
              percent: 100,
              Status: 1,
            },
          });
        } else {
          showToast("Failed to send media", "error");
          if (tempIds?.length) {
            for (const tid of tempIds) {
              dispatchMsg({ type: MSG.UPSERT, id: tid, msg: { Status: 4, isUploading: false } });
            }
          } else {
            dispatchMsg({ type: MSG.UPSERT, id: tempId, msg: { Status: 4, isUploading: false } });
          }
        }

        // Handle new conversation creation
        if ((rd as any)?.IsNewConversation && sentConvId && onCustomerSelect) {
          onCustomerSelect({ ...customer, ConversationId: sentConvId } as ConversationListEntry);
          window.dispatchEvent(
            new CustomEvent("UPDATE_CONVERSATION_ITEM", {
              detail: { ...customer, ConversationId: sentConvId, Message: caption, MessageType: type, DateTime: dateTime },
            })
          );
        }
      } catch (err) {
        console.error("uploadAndSendMedia error:", err);
        showToast("Failed to send media", "error");
        if (tempIds?.length) {
          for (const tid of tempIds) {
            dispatchMsg({ type: MSG.UPSERT, id: tid, msg: { Status: 4, isUploading: false } });
          }
        } else {
          dispatchMsg({ type: MSG.UPSERT, id: tempId, msg: { Status: 4, isUploading: false } });
        }
      }
    },
    [auth, selectedCustomerRef, selectedCustomer, tempConversationId, dispatchMsg, fetchAndCacheGroupMembers, onCustomerSelect, isOffline]
  );

  return {
    handleAttachClick,
    processFiles,
    handleFileChange,
    handleMediaClick,
    handleClosePreview,
    handleClosePdfViewer,
    handleCloseTxtViewer,
    handleClearMediaFiles,
    uploadAndSendMedia,
  };
}
