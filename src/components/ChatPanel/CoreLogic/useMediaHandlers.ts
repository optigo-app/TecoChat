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
import type { AuthData } from "../../../context/LoginData";
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
      return Promise.all(
        files.map(async (file) => {
          const dim = await getMediaDimensions(file);
          if (dim) {
            (file as File & { width?: number; height?: number }).width = dim.width;
            (file as File & { width?: number; height?: number }).height = dim.height;
          }
          return {
            file,
            preview: URL.createObjectURL(file),
            type: file.type.startsWith("image/")
              ? "image"
              : file.type.startsWith("video/")
              ? "video"
              : "file",
            name: file.name,
            size: file.size,
            ...(dim ? { width: dim.width, height: dim.height } : {}),
          };
        })
      );
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
        // Replace (default)
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
    dispatchUI({ type: UI.SET_MEDIA_FILES, value: [] });
    dispatchUI({ type: UI.SET_SHOW_MEDIA, value: false });
  }, [dispatchUI]);

  const uploadAndSendMedia = useCallback(
    async ({
      files,
      caption,
      type,
      tempId,
      time,
      date,
      dateTime,
    }: {
      files: File[];
      caption: string;
      type: string;
      tempId: string;
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
              files: safeFiles.map((file) => {
                const withDimensions = file as File & { width?: number; height?: number };
                return {
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  lastModified: file.lastModified,
                  blob: file,
                  ...(withDimensions.width ? { width: withDimensions.width } : {}),
                  ...(withDimensions.height ? { height: withDimensions.height } : {}),
                };
              }),
            }
          );
          dispatchMsg({ type: MSG.UPSERT, id: tempId, msg: { isUploading: false, Status: "pending" } });
          return;
        }

        const uploadedUrls = await uploadFiles({
          files: safeFiles,
          conversationId: convId,
          type,
          onProgress: (percent) =>
            dispatchMsg({
              type: MSG.UPSERT,
              id: tempId,
              msg: { isUploading: true, percent: Math.max(0, Math.min(99, percent)) },
            }),
        });

        const attachments = safeFiles.map((f, i) => {
          const fWithDim = f as File & { width?: number; height?: number };
          return {
            FileUrl: uploadedUrls[i],
            FileName: f.name,
            MimeType: f.type,
            ...(fWithDim.width && fWithDim.height
              ? { Width: fWithDim.width, Height: fWithDim.height }
              : {}),
          };
        });
        const mediaItems = safeFiles.map((f, i) => {
          const fWithDim = f as File & { width?: number; height?: number };
          return {
            url: uploadedUrls[i],
            filename: f.name,
            mimeType: f.type,
            size: f.size,
            ...(fWithDim.width && fWithDim.height
              ? { width: fWithDim.width, height: fWithDim.height }
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
          dispatchMsg({ type: MSG.UPSERT, id: tempId, msg: { Status: 4, isUploading: false } });
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

        if (sentId) {
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
          dispatchMsg({ type: MSG.UPSERT, id: tempId, msg: { Status: 4, isUploading: false } });
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
        dispatchMsg({ type: MSG.UPSERT, id: tempId, msg: { Status: 4, isUploading: false } });
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
