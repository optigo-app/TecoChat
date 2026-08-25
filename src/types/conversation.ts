// ── Conversation / Chat Member Types ─────────────────────────────────────────

export type MessageType = "text" | "image" | "video" | "document" | "file";

export interface ConversationTag {
  TagId: string | number;
  [key: string]: unknown;
}

/** Raw conversation object as returned by the API (rd array). */
export interface RawConversation {
  ConversationId?: string | number;
  Id?: string | number;
  ReceiverId?: string | number;
  CustomerId?: string | number;
  UserId?: string | number;
  SenderId?: string | number;
  ConversationName?: string;
  MemberName?: string;
  UserName?: string;
  CustomerName?: string;
  Name?: string;
  name?: string;
  SenderInfo?: string;
  FirstName?: string;
  LastName?: string;
  UserEmail?: string;
  DisplayEmail?: string;
  SenderEmail?: string;
  email?: string;
  CustomerPhone?: string;
  MobileNo?: string;
  phone?: string;
  ProfileImageUrl?: string;
  AvatarUrl?: string;
  Avatar?: string;
  LastMessage?: string;
  LastMessageType?: number;
  LastMessageDate?: string;
  LastUpdatedDate?: string;
  LastMessageStatus?: number;
  LastMessageDirection?: number;
  LastMessageSystemMsg?: number;
  LastMessageId?: string | number;
  MessageId?: string | number;
  DateTime?: string;
  SystemMsg?: number;
  IsDeletedForEveryone?: number;
  UnreadCount?: number;
  UnReadMsgCount?: number;
  IsPin?: number;
  IsStar?: number;
  IsArchived?: number;
  IsGroup?: number;
  IsAdmin?: number;
  // Per-user mute state (synced from backend)
  IsMuted?: number;              // 0 = not muted, 1 = muted (for THIS user)
  MuteExpiresAt?: string | null; // ISO datetime or null (null = always)
  ticketStatus?: string;
  tags?: ConversationTag[];
  stat?: unknown;
  stat_msg?: string;
  stat_code?: number | null;
  [key: string]: unknown;
}

/** Raw search-result contact (rd1 array). */
export interface RawSearchResult {
  UserId?: string | number;
  CustomerId?: string | number;
  id?: string | number;
  UserName?: string;
  CustomerName?: string;
  CustomerPhone?: string;
  name?: string;
  UserEmail?: string;
  DisplayEmail?: string;
  [key: string]: unknown;
}

/** Processed conversation object used in the UI. */
export interface Conversation extends RawConversation {
  // Normalized / computed fields
  lastMessage: React.ReactNode | string;
  lastMessageText: string;
  lastMessageTimeValue: string | null;
  lastMessageTime: string;
  unreadCount: number;
  name: string;
  avatar: null;
  avatarConfig: ReturnType<typeof import("../utils/globalFunc").getWhatsAppAvatarConfig>;
  isSearchResult?: boolean;
}

/** Search-result contact mapped to a conversation-like shape. */
export interface SearchResultConversation extends RawSearchResult {
  ConversationId: null;
  Id: string | number;
  ReceiverId: string | number;
  name: string;
  email: string;
  lastMessage: string;
  lastMessageText: string;
  lastMessageTimeValue: string;
  lastMessageTime: string;
  unreadCount: number;
  isSearchResult: true;
  [key: string]: unknown;
}

export type ConversationListEntry = Conversation | SearchResultConversation;

export interface ConversationListData {
  data: ConversationListEntry[];
  total: number;
}

export interface FetchConversationResult {
  data: { rd: RawConversation[]; rd1: RawSearchResult[]; total?: number } | null;
  total: number;
  currentPage: number;
  hasMore: boolean;
  serviceDown: boolean;
  serviceMessage?: string;
  statCode?: number | null;
}

export interface TypingState {
  isTyping: boolean;
  userName?: string;
}
