import React from "react";
import { Image, Video, FileText, File } from "lucide-react";
import {
  getCustomerAvatarSeed,
  getCustomerDisplayName,
  getWhatsAppAvatarConfig,
} from "../../utils/globalFunc";
import { formatDateTime } from "../../utils/dateUtils";
import type {
  Conversation,
  ConversationListEntry,
  RawConversation,
  RawSearchResult,
  SearchResultConversation,
} from "../../types/conversation";

// ── Message preview ──────────────────────────────────────────────────────────

interface MessageLike {
  MessageType?: string | number;
  Message?: string;
  SystemMsg?: number;
  IsDeletedForEveryone?: number;
}

export const getMessagePreview = (msg: MessageLike | null | undefined): {
  text: string;
  node: React.ReactNode;
} => {
  if (!msg) return { text: "", node: "" };

  const isDeleted = msg.IsDeletedForEveryone === 1;
  const type = msg.MessageType;
  const rawText = isDeleted
    ? msg.Message || "This message was deleted."
    : type === "text"
    ? msg.Message || ""
    : type === "image"
    ? "Photo"
    : type === "video"
    ? "Video"
    : type === "document"
    ? "Document"
    : type === "file"
    ? "File"
    : msg.SystemMsg === 1
    ? msg.Message || ""
    : "New message";

  const text =
    typeof rawText === "string" ? rawText.replace(/\\n|\n|\r/g, " ").trim() : String(rawText ?? "");

  const showIcon =
    !isDeleted &&
    (type === "image" || type === "video" || type === "document" || type === "file");
  const Icon =
    type === "image"
      ? Image
      : type === "video"
      ? Video
      : type === "document"
      ? FileText
      : type === "file"
      ? File
      : null;

  if (!text) return { text: "", node: "" };

  const node: React.ReactNode =
    showIcon && Icon ? (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Icon size={14} />
        <span>{text}</span>
      </span>
    ) : (
      text
    );

  return { text, node };
};

// ── API response processing ──────────────────────────────────────────────────

const mapTypeCodeToMessageType = (code: number | undefined): string => {
  switch (Number(code)) {
    case 1:
      return "text";
    case 2:
      return "image";
    case 3:
      return "video";
    case 4:
      return "document";
    case 5:
      return "file";
    default:
      return "text";
  }
};

export const processApiResponse = (apiData: RawConversation[] | null | undefined): Conversation[] => {
  if (!apiData || !Array.isArray(apiData)) return [];

  return apiData.map((conversation) => {
    // Strip the "message" field (used by PreLoadConversation to embed
    // messages — not needed on the conversation object itself).
    const { message: _preloadedMessages, ...convWithoutMessages } = conversation;
    const rawLastMessage = convWithoutMessages.LastMessage;

    const lastMessage = rawLastMessage
      ? {
          MessageType: mapTypeCodeToMessageType(convWithoutMessages.LastMessageType),
          Message: rawLastMessage,
          DateTime: convWithoutMessages.LastMessageDate || convWithoutMessages.LastUpdatedDate,
          Status: convWithoutMessages.LastMessageStatus,
          Direction: convWithoutMessages.LastMessageDirection,
          SystemMsg: convWithoutMessages.LastMessageSystemMsg ?? convWithoutMessages.SystemMsg,
          IsDeletedForEveryone: convWithoutMessages.IsDeletedForEveryone,
        }
      : null;

    const preview = lastMessage ? getMessagePreview(lastMessage) : { text: "", node: "" as React.ReactNode };

    const lastMessageTimeValue =
      lastMessage?.DateTime ||
      convWithoutMessages.LastMessageDate ||
      convWithoutMessages.LastUpdatedDate ||
      convWithoutMessages.DateTime ||
      null;

    return {
      ...convWithoutMessages,
      ConversationId: convWithoutMessages.ConversationId ?? convWithoutMessages.Id,
      ReceiverId: convWithoutMessages.ReceiverId ?? "",
      LastMessageId: convWithoutMessages.LastMessageId ?? convWithoutMessages.MessageId ?? "",
      lastMessage: preview.node,
      lastMessageText: preview.text,
      lastMessageTimeValue: lastMessageTimeValue as string | null,
      lastMessageTime: formatDateTime(lastMessageTimeValue, "chatTimestamp"),
      unreadCount: convWithoutMessages.UnreadCount ?? convWithoutMessages.UnReadMsgCount ?? 0,
      name: convWithoutMessages.ConversationName || getCustomerDisplayName(convWithoutMessages),
      avatar: null,
      avatarConfig: getWhatsAppAvatarConfig(getCustomerAvatarSeed(convWithoutMessages)),
    } as Conversation;
  });
};

export const mapSearchResults = (rd1: RawSearchResult[] | null | undefined): SearchResultConversation[] => {
  return (rd1 || []).map((user) => ({
    ...user,
    ConversationId: null,
    Id: user.UserId || user.CustomerId || user.id || "",
    ReceiverId: (user.UserId || user.CustomerId || "") as string | number,
    name: user.UserName || user.CustomerName || user.CustomerPhone || user.name || "Unknown",
    email: user.UserEmail || user.DisplayEmail || "",
    lastMessage: "",
    lastMessageText: "",
    lastMessageTimeValue: new Date().toISOString(),
    lastMessageTime: "",
    unreadCount: 0,
    isSearchResult: true,
  })) as SearchResultConversation[];
};

// ── Sorting ──────────────────────────────────────────────────────────────────

export const getMemberTimeValue = (member: ConversationListEntry): number => {
  const raw =
    (member as Conversation).lastMessageTimeValue ||
    (member as RawConversation).LastMessageDate ||
    (member as RawConversation).LastUpdatedDate ||
    (member as Conversation).lastMessageTime ||
    0;
  const t = new Date(raw as string).getTime();
  return Number.isFinite(t) ? t : 0;
};

export const conversationComparator = (
  a: ConversationListEntry,
  b: ConversationListEntry
): number => {
  const aIsSearch = Boolean((a as SearchResultConversation).isSearchResult);
  const bIsSearch = Boolean((b as SearchResultConversation).isSearchResult);
  if (aIsSearch !== bIsSearch) return aIsSearch ? 1 : -1;

  const aPinned = Number((a as Conversation).IsPin || 0) === 1;
  const bPinned = Number((b as Conversation).IsPin || 0) === 1;
  if (aPinned !== bPinned) return aPinned ? -1 : 1;

  const aTime = getMemberTimeValue(a);
  const bTime = getMemberTimeValue(b);
  if (aTime !== bTime) return bTime - aTime;

  return Number((b as Conversation).ConversationId ?? 0) - Number((a as Conversation).ConversationId ?? 0);
};

// ── Message type normalization ───────────────────────────────────────────────

export const normalizeMessageType = (type: string | number): string => {
  if (typeof type === "string") return type;
  switch (Number(type)) {
    case 1:
      return "text";
    case 2:
      return "image";
    case 3:
      return "video";
    case 4:
      return "document";
    case 5:
      return "file";
    default:
      return "text";
  }
};

export const mapMessageTypeToCode = (type: string | number): number => {
  const t = normalizeMessageType(type);
  switch (t) {
    case "text":
      return 1;
    case "image":
      return 2;
    case "video":
      return 3;
    case "document":
      return 4;
    case "file":
      return 5;
    default:
      return 1;
  }
};

// ── Search highlight ─────────────────────────────────────────────────────────

/** Resolve the display name for an incoming socket message. */
export const resolveConversationName = (
  incoming: Record<string, unknown> | null | undefined,
  getDisplayName: (c: unknown) => string
): string => {
  const messageSenderName =
    (incoming?.SenderName as string) || (incoming?.senderName as string) || (incoming?.SenderInfo as string) || "";

  const senderInfo = (incoming?.FirstName || incoming?.LastName)
    ? ((incoming?.FirstName as string) || "" + " " + (incoming?.LastName as string) || "").trim()
    : messageSenderName;

  const candidate = String(
    senderInfo ||
      (incoming?.CustomerName as string) ||
      (incoming?.ConversationName as string) ||
      (incoming?.UserName as string) ||
      (incoming?.name as string) ||
      (incoming?.DisplayEmail as string) ||
      (incoming?.RecieverName as string) ||
      ""
  ).trim();

  return candidate || getDisplayName(incoming);
};

/** Highlight matching search text within a name. */
export const highlightText = (text: string, search: string): React.ReactNode => {
  if (!search || !text) return text;
  const lowerText = String(text).toLowerCase();
  const lowerSearch = search.toLowerCase();
  const idx = lowerText.indexOf(lowerSearch);
  if (idx === -1) return text;

  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "transparent", color: "inherit", fontWeight: 700 }}>
        {text.slice(idx, idx + search.length)}
      </mark>
      {text.slice(idx + search.length)}
    </>
  );
};
