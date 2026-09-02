// ─── UI state reducer ───────────────────────────────────────────────────────
// Ported from OldChatReactCode/.../CoreLogic/uiReducer.js
// Manages composer UI state: input value, media files, reply, forward,
// media viewer, search, upload progress, loaded media cache.

import type { ChatMessage } from "../../../types/message";

export const UI = {
  SET_INPUT: "SET_INPUT",
  SET_MEDIA_FILES: "SET_MEDIA_FILES",
  SET_SHOW_MEDIA: "SET_SHOW_MEDIA",
  SET_REPLY: "SET_REPLY",
  SET_FORWARD: "SET_FORWARD",
  SET_FORWARD_ANCHOR: "SET_FORWARD_ANCHOR",
  SET_BLINK: "SET_BLINK",
  SET_SEARCH_HIGHLIGHT: "SET_SEARCH_HIGHLIGHT",
  SET_VIEWER: "SET_VIEWER",
  SET_SEARCHING: "SET_SEARCHING",
  SET_SEARCH_RESULTS: "SET_SEARCH_RESULTS",
  SET_UPLOAD_PROGRESS: "SET_UPLOAD_PROGRESS",
  SET_LOADED_MEDIA: "SET_LOADED_MEDIA",
  SET_STAR_FILTER: "SET_STAR_FILTER",
} as const;

export interface MediaFileItem {
  file: File;
  preview: string;
  type: "image" | "video" | "file";
  name: string;
  size: number;
  width?: number;
  height?: number;
}

export interface MediaViewerItem {
  src: string;
  type: "image" | "video" | "document";
  name: string;
  mimeType?: string;
  size?: number;
  attachmentId?: string;
}

export interface ReplyToMessage {
  Id?: string | number;
  ConversationId?: string | number;
  sender: string;
  text: string;
  MessageType?: string;
  ReplyToAttachmentId?: string | null;
  mediaUrl?: string | null;
}

export type UIAction =
  | { type: "SET_INPUT"; value: string }
  | { type: "SET_MEDIA_FILES"; value: MediaFileItem[] }
  | { type: "SET_SHOW_MEDIA"; value: boolean }
  | { type: "SET_REPLY"; value: ReplyToMessage | null }
  | { type: "SET_FORWARD"; value: ChatMessage | null }
  | { type: "SET_FORWARD_ANCHOR"; value: HTMLElement | null }
  | { type: "SET_BLINK"; value: string | null }
  | { type: "SET_SEARCH_HIGHLIGHT"; value: { query: string | null; messageId: string | null } }
  | {
      type: "SET_VIEWER";
      open?: boolean;
      items?: MediaViewerItem[];
      index?: number;
      message?: ChatMessage | null;
    }
  | { type: "SET_SEARCHING"; value: boolean }
  | { type: "SET_SEARCH_RESULTS"; value: ChatMessage[] }
  | { type: "SET_UPLOAD_PROGRESS"; value: Record<string, number> }
  | { type: "SET_LOADED_MEDIA"; key: string }
  | { type: "SET_STAR_FILTER"; value: boolean };

export interface UIState {
  inputValue: string;
  mediaFiles: MediaFileItem[];
  showMedia: boolean;
  replyToMessage: ReplyToMessage | null;
  forwardMessage: ChatMessage | null;
  forwardAnchorEl: HTMLElement | null;
  blinkMessageId: string | null;
  searchHighlightQuery: string | null;
  searchHighlightMessageId: string | null;
  mediaViewerOpen: boolean;
  mediaViewerItems: MediaViewerItem[];
  mediaViewerIndex: number;
  mediaViewerMessage: ChatMessage | null;
  isSearching: boolean;
  searchResults: ChatMessage[];
  uploadProgress: Record<string, number>;
  loadedMedia: Record<string, boolean>;
  starFilter: boolean;
}

export const uiInitialState: UIState = {
  inputValue: "",
  mediaFiles: [],
  showMedia: false,
  replyToMessage: null,
  forwardMessage: null,
  forwardAnchorEl: null,
  blinkMessageId: null,
  searchHighlightQuery: null,
  searchHighlightMessageId: null,
  mediaViewerOpen: false,
  mediaViewerItems: [],
  mediaViewerIndex: 0,
  mediaViewerMessage: null,
  isSearching: false,
  searchResults: [],
  uploadProgress: {},
  loadedMedia: {},
  starFilter: false,
};

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case UI.SET_INPUT:
      return state.inputValue === action.value
        ? state
        : { ...state, inputValue: action.value };

    case UI.SET_MEDIA_FILES:
      return state.mediaFiles === action.value
        ? state
        : { ...state, mediaFiles: action.value };

    case UI.SET_SHOW_MEDIA:
      return state.showMedia === action.value
        ? state
        : { ...state, showMedia: action.value };

    case UI.SET_REPLY:
      return state.replyToMessage === action.value
        ? state
        : { ...state, replyToMessage: action.value };

    case UI.SET_FORWARD:
      return state.forwardMessage === action.value
        ? state
        : { ...state, forwardMessage: action.value };

    case UI.SET_FORWARD_ANCHOR:
      return state.forwardAnchorEl === action.value
        ? state
        : { ...state, forwardAnchorEl: action.value };

    case UI.SET_BLINK:
      return state.blinkMessageId === action.value
        ? state
        : { ...state, blinkMessageId: action.value };

    case UI.SET_SEARCH_HIGHLIGHT:
      if (
        state.searchHighlightQuery === action.value.query &&
        state.searchHighlightMessageId === action.value.messageId
      )
        return state;
      return {
        ...state,
        searchHighlightQuery: action.value.query,
        searchHighlightMessageId: action.value.messageId,
      };

    case UI.SET_SEARCHING:
      return state.isSearching === action.value
        ? state
        : { ...state, isSearching: action.value };

    case UI.SET_SEARCH_RESULTS:
      return state.searchResults === action.value
        ? state
        : { ...state, searchResults: action.value };

    case UI.SET_UPLOAD_PROGRESS:
      return {
        ...state,
        uploadProgress: { ...state.uploadProgress, ...action.value },
      };

    case UI.SET_LOADED_MEDIA:
      if (state.loadedMedia[action.key]) return state;
      return {
        ...state,
        loadedMedia: { ...state.loadedMedia, [action.key]: true },
      };

    case UI.SET_VIEWER:
      if (
        (action.open === undefined || state.mediaViewerOpen === action.open) &&
        (action.items === undefined || state.mediaViewerItems === action.items) &&
        (action.index === undefined || state.mediaViewerIndex === action.index) &&
        (action.message === undefined || state.mediaViewerMessage === action.message)
      ) {
        return state;
      }
      return {
        ...state,
        mediaViewerOpen: action.open ?? state.mediaViewerOpen,
        mediaViewerItems: action.items ?? state.mediaViewerItems,
        mediaViewerIndex: action.index ?? state.mediaViewerIndex,
        mediaViewerMessage: action.message ?? state.mediaViewerMessage,
      };

    case UI.SET_STAR_FILTER:
      return state.starFilter === action.value
        ? state
        : { ...state, starFilter: action.value };

    default:
      return state;
  }
}
