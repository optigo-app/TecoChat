// ═══════════════════════════════════════════════════════════════════════════
// Message types — mirrors the old CRA app's message structure
// ═══════════════════════════════════════════════════════════════════════════

/** Message direction — 1 = outgoing (sent by current user), 0 = incoming */
export type MessageDirection = 0 | 1;

/** Message type — text, image, video, document, or system */
export type MessageType = "text" | "image" | "video" | "document" | string;

/** Message status — 0/1 = sent, 2 = delivered, 3 = read, 4 = failed */
export type MessageStatus = 0 | 1 | 2 | 3 | 4 | "sent" | "delivered" | "read" | "pending" | "failed";

/** Context type — 2 = reply to a message */
export type ContextType = 0 | 2;

/** A single chat message */
export interface ChatMessage {
  Id?: string | number;
  MessageId?: string | number;
  /** Client-side temp ID for optimistic messages (used for dedup on server echo) */
  ClientMessageId?: string | number;
  ConversationId?: string | number;
  SenderId?: string | number;
  Sender?: string;
  SenderInfo?: string;
  FirstName?: string;
  LastName?: string;
  SenderProfilePicture?: string;

  /** Message body */
  Message?: string;
  Message1?: string;

  /** Direction: 1 = outgoing, 0 = incoming */
  Direction?: MessageDirection;

  /** Type: text, image, video, document */
  MessageType?: MessageType;

  /** Status: 0/1 sent, 2 delivered, 3 read, 4 failed */
  Status?: MessageStatus;
  MessageStatus?: MessageStatus;
  status?: MessageStatus;

  /** Timestamps */
  Time?: string;
  Date?: string;
  DateTime?: string;
  dateTime?: string;

  /** System message flag */
  SystemMsg?: 0 | 1;

  /** Deleted for everyone */
  IsDeletedForEveryone?: 0 | 1;

  /** Edited flag */
  IsEdited?: 0 | 1;

  /** Reply context */
  ContextType?: ContextType;
  ContextId?: string | number;
  ReplyContextMsg?: string;
  ReplyToAttachmentId?: string | number | null;

  /** Forwarded */
  ForwardedFrom?: string;

  /** Starred message flag — 1 = starred by current user, 0 = not starred */
  IsStar?: 0 | 1;

  /** Reactions */
  ReactionEmojis?: string;

  /** Media attachment info */
  AttachmentId?: string | number;
  FileName?: string;
  FileSize?: number;
  MimeType?: string;
  MediaUrl?: string;
  mediaUrl?: string;
  Width?: number;
  Height?: number;

  /** Is this the current user's message */
  IsMyMessage?: boolean;

  /** Upload state (for optimistic messages) */
  isUploading?: boolean;
  percent?: number;
  previewUrl?: string;
  mediaItems?: Array<{
    url: string;
    filename: string;
    mimeType: string;
    size: number;
    width?: number;
    height?: number;
  }>;

  /** Socket ID */
  SocketId?: string;

  /** Mention metadata — JSON string from backend: [{"MentionedUserId":9,"MentionText":"@Elvish Bhai","MentionType":1}] */
  MentionUsers?: string;

  /** Mention metadata from API (field name: Mentions) — same JSON format as MentionUsers */
  Mentions?: string;
}

/** Group of messages by date */
export interface DateGroup {
  type: "date";
  date: string;
}

/** Typing row in the message list */
export interface TypingRow {
  type: "typing";
}

/** Spacer row */
export interface SpacerRow {
  type: "spacer-top" | "spacer-bottom";
}

/** Message row in the flattened list */
export interface MessageRow {
  type: "message";
  msg: ChatMessage;
  msgIndex: number;
}

/** Flattened row type for the message list */
export type FlattenedRow = DateGroup | TypingRow | SpacerRow | MessageRow;

/** Typing status from socket */
export interface TypingStatus {
  isTyping: boolean;
  UserName?: string;
  ConversationId?: string | number;
  ufcc?: string;
  ProfileImageUrl?: string;
  ProfileImage?: string;
}

/** Conversation view API response */
export interface ConversationViewResponse {
  data: ChatMessage[];
  total: number;
  currentPage: number;
  hasMore: boolean;
}

/** Send message API response */
export interface SendMessageResponse {
  stat: number;
  stat_msg?: string;
  MessageId?: string | number;
  ConversationId?: string | number;
  IsNewConversation?: boolean;
}

/** OpenGraph metadata for a URL — used for link previews in chat */
export interface LinkPreviewData {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
}
