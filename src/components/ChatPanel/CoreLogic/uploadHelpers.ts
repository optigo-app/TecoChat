// ─── Upload helpers ─────────────────────────────────────────────────────────
// Ported from OldChatReactCode/.../CoreLogic/uploadHelpers.js
// File validation, dimension extraction, upload with progress.

import { uploadMediaAPi } from "../../../API/FileUpload/uploadHelpers";
import { generateMediaFolderName } from "../../../utils/globalFunc";

/** Validate media files: max 30 files, max 16MB each, max 100MB total. */
export const validateMediaFiles = (
  files: File[]
): {
  acceptedFiles: File[];
  skippedSize: string[];
  skippedTotal: string[];
  skippedCount: number;
} => {
  const MAX_FILES = 30;
  const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB
  const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB

  const acceptedFiles: File[] = [];
  const skippedSize: string[] = [];
  const skippedTotal: string[] = [];
  let totalSize = 0;

  for (const file of files) {
    if (acceptedFiles.length >= MAX_FILES) {
      skippedTotal.push(file.name);
      continue;
    }
    if (file.size > MAX_FILE_SIZE) {
      skippedSize.push(file.name);
      continue;
    }
    if (totalSize + file.size > MAX_TOTAL_SIZE) {
      skippedTotal.push(file.name);
      continue;
    }
    acceptedFiles.push(file);
    totalSize += file.size;
  }

  return {
    acceptedFiles,
    skippedSize,
    skippedTotal,
    skippedCount: files.length - acceptedFiles.length,
  };
};

/** Get image/video dimensions. */
export const getMediaDimensions = (
  file: File
): Promise<{ width: number; height: number } | null> => {
  return new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.onload = () =>
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    } else if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.onloadedmetadata = () =>
        resolve({ width: video.videoWidth, height: video.videoHeight });
      video.onerror = () => resolve(null);
      video.src = URL.createObjectURL(file);
    } else {
      resolve(null);
    }
  });
};

/**
 * Upload files to the server and return an array of URLs matching the input files.
 * Mirrors the old CoreLogic/uploadHelpers.js uploadFiles function:
 * 1. Generate a folder name based on conversationId + media category
 * 2. Call uploadMediaAPi (compresses images to WebP, then POSTs FormData)
 * 3. Match returned file URLs to input files by filename
 */
export const uploadFiles = async ({
  files,
  conversationId,
  type,
  onProgress,
}: {
  files: File[];
  conversationId: string | number | null | undefined;
  type: string;
  onProgress?: (percent: number) => void;
}): Promise<string[]> => {
  const folderCategory = type === "image" ? "images" : type === "video" ? "videos" : "docs";
  const folderName = generateMediaFolderName(conversationId, folderCategory);

  const uploaded = await uploadMediaAPi({ folderName, files, onProgress });
  const arr = Array.isArray(uploaded) ? uploaded : [];

  const getUrl = (u: any) =>
    u?.url ?? u?.Url ?? u?.fileUrl ?? u?.fileURL ?? u?.FileUrl ?? u?.path ?? null;
  const getName = (u: any) =>
    u?.fileName ?? u?.filename ?? u?.FileName ?? u?.name ?? null;

  return files.map((f, i) => {
    const match = arr.find((u: any) => getName(u)?.toLowerCase() === f.name.toLowerCase());
    return getUrl(match || arr[i]);
  });
};

/** Build a media payload for socket emission. */
export const buildMediaPayload = ({
  auth,
  selectedCustomer,
  sentId,
  tempId,
  type,
  uploadedUrls,
  mediaItems,
  caption,
  time,
  date,
  dateTime,
  isGroup,
  memberIds,
}: {
  auth: { id?: string; userId?: string; ufcc?: string; SocketId?: string; username?: string; firstName?: string; FirstName?: string; firstname?: string; lastName?: string; LastName?: string; lastname?: string; email?: string; ProfileImageUrl?: string; profileImage?: string; profilePicture?: string; ProfileImage?: string; AvatarUrl?: string } | null;
  selectedCustomer: {
    ConversationId?: string | number;
    ReceiverId?: string | number | string[] | number[];
    name?: string;
    ConversationName?: string;
    MemberName?: string;
    UserName?: string;
    CustomerName?: string;
  } | null;
  sentId: string | number;
  tempId?: string;
  type: string;
  uploadedUrls: string[];
  mediaItems: Array<{ url: string; filename: string; mimeType: string; size: number; attachmentId?: string | null }>;
  caption: string;
  time: string;
  date: string;
  dateTime: string;
  isGroup: boolean;
  memberIds: number[];
}): Record<string, unknown> => {
  return {
    ufcc: auth?.ufcc,
    ReceiverId: isGroup
      ? memberIds.length > 0
        ? memberIds
        : [selectedCustomer?.ReceiverId]
      : selectedCustomer?.ReceiverId,
    Id: sentId || tempId,
    MessageId: sentId,
    ...(tempId ? { ClientMessageId: tempId } : {}),
    SenderId: auth?.id,
    Direction: 2,
    Status: 1,
    MessageStatus: 1,
    MessageType: type,
    Message: caption,
    Time: time,
    Date: date,
    DateTime: dateTime,
    mediaItems,
    previewUrl: uploadedUrls[0],
    fileName: mediaItems?.[0]?.filename,
    fileType: mediaItems?.[0]?.mimeType,
    ConversationId: selectedCustomer?.ConversationId,
    // ── Receiver / conversation name (so conversation list shows the OTHER person) ──
    ConversationName: String(
      selectedCustomer?.ConversationName ||
      selectedCustomer?.name ||
      selectedCustomer?.MemberName ||
      selectedCustomer?.UserName ||
      selectedCustomer?.CustomerName ||
      ""
    ).trim() || undefined,
    RecieverName: String(
      selectedCustomer?.ConversationName ||
      selectedCustomer?.name ||
      selectedCustomer?.MemberName ||
      selectedCustomer?.UserName ||
      selectedCustomer?.CustomerName ||
      ""
    ).trim() || (auth?.username || auth?.userId),
    // ── Sender info (always include, not just for groups) ──
    // Without these, recipients see "member" instead of actual sender name/avatar
    SenderName: auth?.username || auth?.userId,
    FirstName: auth?.firstName || auth?.FirstName || auth?.firstname,
    LastName: auth?.lastName || auth?.LastName || auth?.lastname,
    SenderEmail: auth?.email,
    SenderProfilePicture: auth?.ProfileImageUrl || auth?.profilePicture || auth?.profileImage || "",
    ProfileImageUrl: auth?.ProfileImageUrl || auth?.profileImage || auth?.AvatarUrl || "",
    ProfileImage: auth?.ProfileImage || auth?.profileImage || auth?.AvatarUrl || "",
    ...(isGroup && {
      IsGroup: 1,
    }),
  };
};
