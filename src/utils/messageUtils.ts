import { formatDateTime } from "./dateUtils";

/**
 * Map numeric MessageType from API to string types used in UI.
 * 1 = text, 2 = image, 3 = video, 4 = document, 5 = file
 */
export const mapTypeCodeToMessageType = (code: unknown): string => {
  const normalized = (() => {
    if (typeof code === "string") {
      const trimmed = code.trim();
      if (/^\d+$/.test(trimmed)) {
        const parsed = parseInt(trimmed, 10);
        return Number.isFinite(parsed) ? parsed : code;
      }
      return trimmed;
    }
    return code;
  })();

  switch (normalized) {
    case 1: return "text";
    case 2: return "image";
    case 3: return "video";
    case 4: return "document";
    case 5: return "file";
    default:
      return typeof normalized === "string" ? normalized : "text";
  }
};

interface AuthLike {
  id?: string;
  userId?: string;
}

interface RawMessage {
  [key: string]: unknown;
  Id?: string | number;
  MessageId?: string | number;
  ConversationId?: string | number;
  Message?: string;
  Message1?: string;
  SenderId?: string | number;
  Sender?: string;
  Direction?: number;
  MessageType?: unknown;
  LastMessageType?: unknown;
  Status?: unknown;
  status?: unknown;
  MessageStatus?: unknown;
  SystemMsg?: unknown;
  system_msg?: unknown;
  DateTime?: string;
  SentAt?: string;
  Date?: string;
  Time?: string;
  FirstName?: string;
  LastName?: string;
  RecieverName?: string;
  ReceiverName?: string;
  SenderName?: string;
  SenderInfo?: string;
  SenderEmail?: string;
  IsDeletedForEveryone?: unknown;
  isDeletedForEveryone?: unknown;
  ContextType?: unknown;
  ContextId?: string | number | null;
  ReplyTo?: unknown;
  ReplyContextMsg?: string | null;
  ReplyToMessage?: string;
  ReplyToAttachmentId?: unknown;
  ReplyToSenderName?: string | null;
  ForwardedFrom?: string;
  ReactionEmojis?: string;
  Reactions?: string;
  Attachments?: unknown;
  SenderProfilePicture?: string;
  avatar?: string;
  IsEdited?: unknown;
  LastMessage?: string;
  LastMessageDate?: string;
  LastUpdatedDate?: string;
  LastMessageSender?: string;
}

/**
 * Normalize messages from the API into a consistent ChatMessage shape.
 * Ported from old app's conversationUtils.js → normalizeServerMessages.
 * @param conversationId - The conversation these messages belong to.
 *   The API may not include ConversationId on each message, so we set it
 *   explicitly here to ensure cache keys and queries work correctly.
 */
export const normalizeServerMessages = (
  messagesArray: unknown,
  auth: AuthLike | null,
  conversationId?: string | number | null
): RawMessage[] => {
  if (!Array.isArray(messagesArray)) return [];

  return messagesArray.map((raw) => {
    const msg = raw as RawMessage;
    if (!msg || typeof msg !== "object") return msg;

    // ── Parse attachments ──────────────────────────────────────────────────
    let parsedAttachments: unknown = null;
    if (msg.Attachments) {
      try {
        parsedAttachments = typeof msg.Attachments === "string"
          ? JSON.parse(msg.Attachments)
          : msg.Attachments;
      } catch {
        parsedAttachments = null;
      }
    }

    const attachmentsArray = Array.isArray(parsedAttachments) ? parsedAttachments : [];
    type Attachment = {
      FileUrl?: string; FileURL?: string; url?: string; Url?: string; fileUrl?: string; fileURL?: string;
      MimeType?: string; mimeType?: string; mimetype?: string; fileType?: string;
      FileName?: string; fileName?: string; filename?: string; name?: string;
      Width?: number; ImageWidth?: number; FileWidth?: number; width?: number;
      Height?: number; ImageHeight?: number; FileHeight?: number; height?: number;
      size?: number; attachmentId?: string; AttachmentId?: string; Id?: string; id?: string;
    };
    const firstAttachment = (attachmentsArray as Attachment[])[0] || null;
    const attachmentUrl =
      firstAttachment?.FileUrl || firstAttachment?.FileURL || firstAttachment?.url ||
      firstAttachment?.Url || firstAttachment?.fileUrl || firstAttachment?.fileURL || null;
    const attachmentMime =
      firstAttachment?.MimeType || firstAttachment?.mimeType || firstAttachment?.mimetype ||
      firstAttachment?.fileType || (msg.fileType as string) || "";
    const attachmentName =
      firstAttachment?.FileName || firstAttachment?.fileName || firstAttachment?.filename ||
      (msg.fileName as string) || "";

    const parseDim = (val: unknown): number | null => {
      const n = Number(val);
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const attachmentWidth = parseDim(
      firstAttachment?.Width ?? firstAttachment?.ImageWidth ?? firstAttachment?.FileWidth ?? firstAttachment?.width
    );
    const attachmentHeight = parseDim(
      firstAttachment?.Height ?? firstAttachment?.ImageHeight ?? firstAttachment?.FileHeight ?? firstAttachment?.height
    );

    // ── Build mediaItems from all attachments (matches old conversationUtils.js) ──
    const mediaItems = (attachmentsArray as Attachment[])
      .map((a) => {
        const url =
          a?.FileUrl || a?.FileURL || a?.url || a?.Url || a?.fileUrl || a?.fileURL || null;
        if (!url) return null;
        const mimeType = a?.MimeType || a?.mimeType || a?.mimetype || a?.fileType || "";
        const fileName = a?.FileName || a?.fileName || a?.filename || a?.name || "";
        const width = parseDim(a?.Width ?? a?.ImageWidth ?? a?.FileWidth ?? a?.width);
        const height = parseDim(a?.Height ?? a?.ImageHeight ?? a?.FileHeight ?? a?.height);
        return {
          url,
          mimeType,
          filename: fileName,
          fileName,
          size: a?.size,
          width,
          height,
          attachmentId: a?.attachmentId || a?.AttachmentId || a?.Id || a?.id,
        };
      })
      .filter(Boolean);

    // ── Reply context ──────────────────────────────────────────────────────
    const contextTypeRaw = msg.ContextType;
    const parsedContextType = typeof contextTypeRaw === "string"
      ? parseInt(contextTypeRaw, 10)
      : contextTypeRaw;

    const replyToRaw = msg.ReplyTo;
    const parsedReplyTo = typeof replyToRaw === "string"
      ? parseInt(replyToRaw, 10)
      : replyToRaw;

    const hasReplyLegacy = parsedContextType === 2;
    const hasReplyNew = Number(parsedReplyTo || 0) !== 0;
    const isReplyMessage = hasReplyNew || hasReplyLegacy;
    const hasTextBody = String(msg.Message ?? "").trim().length > 0;
    const forceTextReply = isReplyMessage && hasTextBody;

    // ── Deleted state ──────────────────────────────────────────────────────
    const isDeletedForEveryone =
      msg.IsDeletedForEveryone === 1 || msg.isDeletedForEveryone === 1;

    // ── Resolve message type ───────────────────────────────────────────────
    const resolvedMessageType = (forceTextReply || isDeletedForEveryone)
      ? "text"
      : (() => {
          if (attachmentUrl) {
            if ((attachmentMime || "").startsWith("image/")) return "image";
            if ((attachmentMime || "").startsWith("video/")) return "video";
            return "document";
          }
          return mapTypeCodeToMessageType(msg.MessageType || msg.LastMessageType);
        })();

    // ── Direction (is this my message?) ────────────────────────────────────
    const isMyMessage =
      Number(msg.SenderId || msg.Sender || msg.LastMessageSender) ===
      Number(auth?.id ?? auth?.userId);

    // ── DateTime parsing ───────────────────────────────────────────────────
    const dateTime = msg.DateTime || msg.SentAt || msg.LastMessageDate || msg.LastUpdatedDate;
    let date = msg.Date;
    let time = msg.Time;
    if (!date && dateTime) {
      try {
        const d = new Date(dateTime);
        if (!isNaN(d.getTime())) {
          date = formatDateTime(d, "dateKey");
          time = formatDateTime(d, "time");
        }
      } catch {
        date = undefined;
        time = undefined;
      }
    }

    // ── Sender info ────────────────────────────────────────────────────────
    const senderInfo = (msg.FirstName || msg.LastName)
      ? ((msg.FirstName || "") + " " + (msg.LastName || "")).trim()
      : (msg.RecieverName || msg.ReceiverName || msg.SenderName || msg.SenderInfo || "");
    const trimmedSenderInfo = senderInfo.trim();

    // ── Reply fields ───────────────────────────────────────────────────────
    const hasReply = !!msg.ReplyTo && msg.ReplyTo !== 0;
    const contextType = hasReply
      ? 2
      : (typeof msg.ContextType === "number" ? msg.ContextType : 0);
    const contextId = hasReply
      ? (msg.ReplyTo as string | number)
      : (msg.ContextId || null);
    const replyContextMsg = msg.ReplyContextMsg || msg.ReplyToMessage || null;

    // ── Status mapping ─────────────────────────────────────────────────────
    // Backend MessageStatus: 0 = sent/delivered, 1 = sent, 2 = read
    // Internal Status: 1 = sent, 2 = delivered, 3 = read
    let normalizedStatus = msg.Status ?? msg.status;
    const rawMessageStatus =
      msg.MessageStatus !== undefined ? Number(msg.MessageStatus) : undefined;

    if (typeof rawMessageStatus === "number" && !isNaN(rawMessageStatus)) {
      if (rawMessageStatus === 2) {
        normalizedStatus = 3; // Read (blue ticks)
      } else if (rawMessageStatus === 1 || rawMessageStatus === 0) {
        normalizedStatus = 1; // Sent (gray ticks)
      }
    }

    // ── System message ─────────────────────────────────────────────────────
    const normalizedSystemMsg = msg.SystemMsg !== undefined
      ? (typeof msg.SystemMsg === "string" ? parseInt(msg.SystemMsg, 10) : msg.SystemMsg)
      : (msg.system_msg !== undefined
        ? (typeof msg.system_msg === "string" ? parseInt(msg.system_msg, 10) : msg.system_msg)
        : 0);

    return {
      ...msg,
      Id: msg.Id ? String(msg.Id) : (msg.MessageId ? String(msg.MessageId) : undefined),
      MessageId: msg.MessageId ? String(msg.MessageId) : (msg.Id ? String(msg.Id) : undefined),
      // Ensure ConversationId is always set — the API may not include it
      // on each message, but the cache and merge logic depend on it.
      ConversationId: msg.ConversationId ?? conversationId ?? undefined,
      IsMyMessage: isMyMessage,
      Direction: isMyMessage ? 1 : (typeof msg.Direction === "number" ? (msg.Direction === 1 || msg.Direction === 2 ? 0 : msg.Direction) : 0),
      MessageType: resolvedMessageType,
      Message: msg.Message ?? msg.LastMessage,
      Message1: msg.Message1,
      Status: normalizedStatus,
      SystemMsg: normalizedSystemMsg,
      DateTime: dateTime,
      Date: date,
      Time: time,
      ReactionEmojis: msg.ReactionEmojis ?? msg.Reactions ?? "[]",
      SenderInfo: trimmedSenderInfo || msg.SenderEmail || "",
      FirstName: msg.FirstName || "",
      LastName: msg.LastName || "",
      SenderProfilePicture: msg.SenderProfilePicture || msg.avatar || "",
      ContextType: contextType,
      ContextId: contextId,
      ReplyContextMsg: replyContextMsg,
      ReplyToAttachmentId: (() => {
        const raw = msg.ReplyToAttachmentId;
        if (!raw) return null;
        const str = String(raw).trim();
        if (str.startsWith("[")) {
          try {
            const parsed = JSON.parse(str);
            if (Array.isArray(parsed)) {
              return parsed.filter(Boolean).join(",") || null;
            }
          } catch { /* fall through */ }
        }
        return str || null;
      })(),
      ReplyToSenderName: msg.ReplyToSenderName || null,
      ...(!forceTextReply && attachmentUrl ? { previewUrl: attachmentUrl } : {}),
      ...(!forceTextReply && attachmentName ? { fileName: attachmentName } : {}),
      ...(!forceTextReply && attachmentMime ? { fileType: attachmentMime } : {}),
      ...(!forceTextReply && mediaItems.length ? { mediaItems } : {}),
      ...(!forceTextReply && attachmentWidth && attachmentHeight
        ? { mediaWidth: attachmentWidth, mediaHeight: attachmentHeight }
        : {}),
    };
  });
};

/**
 * Sort messages by DateTime ascending (oldest first).
 */
export const sortMessagesByDate = <T extends { DateTime?: string; SentAt?: string }>(
  messages: T[]
): T[] => {
  // Cache Date parses per object — the comparator would otherwise call
  // `new Date()` O(n log n) times.
  const tsCache = new WeakMap<T, number>();
  const tsOf = (m: T): number => {
    let t = tsCache.get(m);
    if (t === undefined) {
      t = new Date(m.DateTime || m.SentAt || 0).getTime();
      tsCache.set(m, t);
    }
    return t;
  };
  return [...messages].sort((a, b) => tsOf(a) - tsOf(b));
};

/**
 * Merge new server messages with existing messages, deduplicating by Id.
 */
export const mergeMessages = <T extends { Id?: string | number; MessageId?: string | number }>(
  newMsgs: T[],
  existing: T[]
): T[] => {
  const existingIds = new Set(
    existing.map((m) => String(m.Id ?? m.MessageId ?? "")).filter(Boolean)
  );
  const unique = newMsgs.filter((m) => {
    const id = String(m.Id ?? m.MessageId ?? "");
    return id && !existingIds.has(id);
  });
  return [...existing, ...unique];
};
