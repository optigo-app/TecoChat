"use client";

import { useReducer, useRef, useCallback, useEffect, useMemo, useState } from "react";
import { useLoginContext } from "../contexts/LoginData";
import {
  messagesReducer,
  msgInitialState,
  MSG,
  type MsgAction,
} from "../components/ChatPanel/CoreLogic/conversationReducer";
import {
  uiReducer,
  uiInitialState,
  UI,
  type UIAction,
} from "../components/ChatPanel/CoreLogic/uiReducer";
import {
  saveConversationToCache,
  getMessageId,
  mergeMessages,
} from "../components/ChatPanel/CoreLogic/messageHelpers";
import { useMessageLoader } from "../components/ChatPanel/CoreLogic/useMessageLoader";
import { conversationView, conversationViewCursor, type CursorDirection } from "../API/ConversationView/ConversationView";
import { useSocketHandlers } from "../components/ChatPanel/CoreLogic/useSocketHandlers";
import { useReadReceipt } from "../components/ChatPanel/CoreLogic/useReadReceipt";
import { useMediaHandlers } from "../components/ChatPanel/CoreLogic/useMediaHandlers";
import { useMessageActions } from "../components/ChatPanel/CoreLogic/useMessageActions";
import { useForwardMessage } from "../components/ChatPanel/CoreLogic/useForwardMessage";
import { useReactions } from "../components/ChatPanel/CoreLogic/useReactions";
import { useTypingIndicator } from "../components/ChatPanel/CoreLogic/useTypingIndicator";
import { useTypingEmitter } from "../components/ChatPanel/CoreLogic/useTypingEmitter";
import { fetchGroupDetails } from "../API/Groups/FetchGroupDetails";
import type { ChatMessage, FlattenedRow } from "../types/message";
import type { ConversationListEntry } from "../types/conversation";
import { formatDateTime } from "../utils/dateUtils";
import { getAndClearDroppedFiles } from "../utils/dropFileQueue";
import { getDraft, setDraft, getAllDrafts } from "../db/draftCache";
import { getMembers, putMembers } from "../db/groupMembersCache";
import { getSearchCache, setSearchCache } from "../db/searchCache";
import { useOutboxSync } from "../components/ChatPanel/CoreLogic/useOutboxSync";
import { useReconnectSync } from "../components/ChatPanel/CoreLogic/useReconnectSync";
import { useSocketContext } from "../contexts/SocketContext";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { liveQuery } from "dexie";
import { getDb } from "../db/tecoDb";

interface UseConversationProps {
  selectedCustomer: ConversationListEntry | null;
  onConversationRead?: ((read: boolean) => void) | null;
  isDrawerOpen?: boolean;
  onCustomerSelect?: ((customer: ConversationListEntry) => void) | null;
}

export const useConversation = ({
  selectedCustomer,
  onConversationRead = null,
  isDrawerOpen = false,
  onCustomerSelect = null,
}: UseConversationProps) => {
  const { auth } = useLoginContext();
  const [msgState, dispatchMsg] = useReducer(messagesReducer, msgInitialState);
  const [uiState, dispatchUI] = useReducer(uiReducer, uiInitialState);

  // ── Stable refs ──────────────────────────────────────────────────────────
  const selectedCustomerRef = useRef(selectedCustomer);
  const messagesRef = useRef(msgState.data);
  const latestInputValueRef = useRef("");
  const prevConvIdRef = useRef<string | number | null>(null);
  const cacheWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether user is at/near the bottom of the message list.
  // Updated by MessageList's scroll handler, read by socket handler to
  // decide whether to insert new messages immediately or buffer them.
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    selectedCustomerRef.current = selectedCustomer;
    dispatchUI({ type: UI.SET_MEDIA_FILES, value: [] });
    dispatchUI({ type: UI.SET_SHOW_MEDIA, value: false });
  }, [selectedCustomer]);

  useEffect(() => {
    messagesRef.current = msgState.data;
  }, [msgState.data]);

  useEffect(() => {
    latestInputValueRef.current = uiState.inputValue;
  }, [uiState.inputValue]);

  const updateLatestInput = useCallback((val: string) => {
    latestInputValueRef.current = val;
  }, []);

  // ── Group members cache (for typing, reactions, read receipts) ───────────
  type GroupMember = { UserId?: number; userId?: number; id?: number; MemberName?: string; ProfileImage?: string; IsGroupAdmin?: number };
  type GroupMembersResult = { members: GroupMember[]; groupDetails: unknown };
  // Two-tier cache: in-memory ref for instant reads, IndexedDB for persistence
  // across refresh. On a cache miss we try IDB first, then fall back to the API.
  const groupMembersCacheRef = useRef<Record<string, GroupMember[]>>({});
  const groupMembersPromiseRef = useRef<Promise<GroupMembersResult> | null>(null);
  const groupMembersConvIdRef = useRef<string | number | null>(null);

  const fetchAndCacheGroupMembers = useCallback(
    async (conversationId: string | number, _force = false): Promise<GroupMembersResult> => {
      if (!conversationId || !auth) return { members: [], groupDetails: null };
      const cacheKey = String(conversationId);
      // Return in-memory cached members ONLY for the same conversation
      if (!_force && groupMembersConvIdRef.current === conversationId && groupMembersCacheRef.current[cacheKey]?.length > 0) {
        return { members: groupMembersCacheRef.current[cacheKey], groupDetails: null };
      }
      // If there's an in-flight promise for the SAME conversation, reuse it
      if (!_force && groupMembersPromiseRef.current && groupMembersConvIdRef.current === conversationId) {
        return groupMembersPromiseRef.current;
      }
      const promise: Promise<GroupMembersResult> = (async () => {
        try {
          // Try IndexedDB first (unless forced refresh).
          if (!_force) {
            const cached = await getMembers(auth, conversationId);
            if (cached.length > 0) {
              groupMembersCacheRef.current[cacheKey] = cached;
              groupMembersConvIdRef.current = conversationId;
              return { members: cached, groupDetails: null };
            }
          }
          // IDB miss — fetch from API and persist.
          const groupData = await fetchGroupDetails(conversationId, auth);
          const members = (groupData?.members || []) as GroupMember[];
          groupMembersCacheRef.current[cacheKey] = members;
          groupMembersConvIdRef.current = conversationId;
          putMembers(auth, conversationId, members).catch(() => {
            /* ignore */
          });
          return { members, groupDetails: groupData?.groupDetails };
        } catch {
          return { members: [], groupDetails: null };
        } finally {
          groupMembersPromiseRef.current = null;
        }
      })();
      groupMembersPromiseRef.current = promise;
      groupMembersConvIdRef.current = conversationId;
      return promise;
    },
    [auth?.token, auth?.userId, auth]
  );

  // ── Drafts (IndexedDB) ───────────────────────────────────────────────────
  // Drafts are persisted in IndexedDB (per-user DB) for cross-tab sync and
  // survival across refresh. An in-memory mirror (draftsRef) is kept so the
  // CHAT_DRAFTS_UPDATED event can fire synchronously for the list hook.
  const draftsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await getAllDrafts(auth);
        if (cancelled) return;
        draftsRef.current = all;
        window.dispatchEvent(
          new CustomEvent("CHAT_DRAFTS_UPDATED", { detail: draftsRef.current })
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth]);

  // Cross-tab draft sync: subscribe to IDB changes so drafts edited in
  // another tab reflect here in realtime via Dexie liveQuery.
  useEffect(() => {
    if (!auth) return;
    const db = getDb(auth.id ?? auth.userId);
    if (!db) return;
    const sub = liveQuery(() => db.drafts.toArray()).subscribe({
      next: (rows) => {
        const map: Record<string, string> = {};
        for (const r of rows) {
          const text = (r as { text?: string }).text;
          if (text) map[String(r.conversationId)] = text;
        }
        draftsRef.current = map;
        window.dispatchEvent(
          new CustomEvent("CHAT_DRAFTS_UPDATED", { detail: draftsRef.current })
        );
      },
      error: () => {},
    });
    return () => sub.unsubscribe();
  }, [auth]);

  const saveDraft = useCallback(
    (convoId: string | number, text: string, notify = true) => {
      if (!convoId) return;
      const cleanText = text?.trim();
      // Create a NEW object so React detects the state change in
      // useConversationList's setDrafts(detail) — mutating in place keeps
      // the same reference, causing React's bailout to skip re-render.
      const next = { ...draftsRef.current };
      if (cleanText) {
        next[convoId] = cleanText;
      } else {
        delete next[convoId];
      }
      draftsRef.current = next;
      // Persist to IndexedDB (best-effort, non-blocking).
      setDraft(auth, convoId, cleanText ?? "").catch(() => {
        /* ignore */
      });
      if (notify) {
        window.dispatchEvent(
          new CustomEvent("CHAT_DRAFTS_UPDATED", { detail: draftsRef.current })
        );
      }
    },
    [auth]
  );

  // Load draft when switching conversations — read fresh from IndexedDB
  useEffect(() => {
    if (!selectedCustomer?.ConversationId) return;
    let cancelled = false;
    (async () => {
      try {
        const draft = await getDraft(auth, selectedCustomer.ConversationId);
        if (cancelled) return;
        if (draft !== uiState.inputValue) {
          dispatchUI({ type: UI.SET_INPUT, value: draft });
        }
      } catch {
        if (!cancelled) dispatchUI({ type: UI.SET_INPUT, value: "" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?.ConversationId, auth?.id]);

  // Save draft on tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentId = selectedCustomerRef.current?.ConversationId;
      if (currentId) saveDraft(currentId, latestInputValueRef.current, false);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveDraft]);

  // ── Sub-hooks ────────────────────────────────────────────────────────────
  const { loadConversation, loadOlderMessages, loadNewerMessages, retryLoadOlder, retryLoadNewer, jumpToLatest, autoLoadNewerRef, abortControllerRef } =
    useMessageLoader({
      selectedCustomer,
      auth,
      pageSize: 20,
      initialPageSize: 20,
      msgState,
      dispatchMsg,
      isStarFilter: uiState.starFilter ? 1 : 0,
    });

  const { handleReadMessage } = useReadReceipt({
    auth,
    selectedCustomerRef,
    messagesRef,
    isDrawerOpen,
    onConversationRead,
    fetchAndCacheGroupMembers,
  });

  useOutboxSync(auth);
  useReconnectSync(auth, selectedCustomer?.ConversationId, dispatchMsg);
  const { status: socketStatus } = useSocketContext();
  const isOnline = useOnlineStatus();
  const isOffline = !isOnline || socketStatus !== "connected";

  // When an outbox message is successfully sent on reconnect, update the
  // React state so the "Failed" icon changes to the normal sent status.
  useEffect(() => {
    const handleOutboxSent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.tempId) return;
      // Sentinel event: serverId is null when multiple documents were split
      // into individual messages. The individual OUTBOX_MESSAGE_SENT events
      // have already been dispatched — just remove the original temp message.
      if (detail.serverId == null) {
        dispatchMsg({ type: MSG.DELETE_ME, messageId: detail.tempId });
        return;
      }
      dispatchMsg({
        type: MSG.UPSERT,
        id: detail.tempId,
        msg: {
          Id: detail.serverId ?? detail.tempId,
          MessageId: detail.serverId ?? detail.tempId,
          ClientMessageId: detail.tempId,
          Status: "sent",
          ...(detail.MessageType ? {
            Message: detail.Message,
            MessageType: detail.MessageType,
            mediaItems: detail.mediaItems,
            previewUrl: detail.previewUrl,
            Time: detail.Time,
            Date: detail.Date,
            DateTime: detail.DateTime,
            ConversationId: detail.conversationId,
            SenderId: detail.SenderId,
            Direction: detail.Direction,
            isUploading: false,
          } : {}),
        },
      });
    };
    const handleOutboxRetrying = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.tempId) return;
      dispatchMsg({
        type: MSG.UPSERT,
        id: detail.tempId,
        msg: { Status: "pending" },
      });
    };
    const handleOutboxFailed = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.tempId) return;
      dispatchMsg({
        type: MSG.UPSERT,
        id: detail.tempId,
        msg: { Status: 4, isUploading: false },
      });
    };
    window.addEventListener("OUTBOX_MESSAGE_SENT", handleOutboxSent as EventListener);
    window.addEventListener("OUTBOX_MESSAGE_RETRYING", handleOutboxRetrying as EventListener);
    window.addEventListener("OUTBOX_MESSAGE_FAILED", handleOutboxFailed as EventListener);
    return () => {
      window.removeEventListener("OUTBOX_MESSAGE_SENT", handleOutboxSent as EventListener);
      window.removeEventListener("OUTBOX_MESSAGE_RETRYING", handleOutboxRetrying as EventListener);
      window.removeEventListener("OUTBOX_MESSAGE_FAILED", handleOutboxFailed as EventListener);
    };
  }, [dispatchMsg]);

  const { addUniqueMessage } = useSocketHandlers({
    auth,
    selectedCustomerRef,
    dispatchMsg,
    handleReadMessage,
    isAtBottomRef,
  });

  const {
    handleAttachClick,
    processFiles,
    handleFileChange,
    handleMediaClick,
    handleClosePreview,
    handleClosePdfViewer,
    handleCloseTxtViewer,
    uploadAndSendMedia,
  } = useMediaHandlers({
    auth,
    selectedCustomer,
    selectedCustomerRef,
    uiState: { showMedia: uiState.showMedia, mediaFiles: uiState.mediaFiles },
    dispatchUI,
    dispatchMsg,
    tempConversationId: msgState.tempConversationId,
    fetchAndCacheGroupMembers,
    onCustomerSelect,
    isOffline,
  });

  const {
    handleSendMessage,
    handleEditMessage,
    handleDeleteMessage,
    handleStarMessage,
    handleReply,
    handleCancelReply,
    retryFailedMessage,
  } = useMessageActions({
    auth,
    selectedCustomer,
    selectedCustomerRef,
    uiState: {
      inputValue: uiState.inputValue,
      replyToMessage: uiState.replyToMessage,
      storeMessData: msgState.storeMessData,
      mediaFiles: uiState.mediaFiles,
    },
    dispatchUI,
    dispatchMsg,
    onCustomerSelect,
    tempConversationId: msgState.tempConversationId,
    uploadAndSendMedia,
    fetchAndCacheGroupMembers,
    isOffline,
    messagesRef,
  });

  const { handleForward, handleCloseForward, handleSendForward } =
    useForwardMessage({
      auth,
      selectedCustomer,
      uiState: { forwardMessage: uiState.forwardMessage },
      dispatchUI,
      dispatchMsg,
    });

  // Process files dropped on a conversation item in the sidebar
  // Listens for both conversation changes and the FILES_DROPPED_ON_CONVERSATION
  // event so dropping on an already-selected conversation also works.
  useEffect(() => {
    const convId = selectedCustomer?.ConversationId;
    if (!convId) return;

    const checkPendingFiles = () => {
      const pendingFiles = getAndClearDroppedFiles(convId);
      if (pendingFiles && pendingFiles.length > 0 && processFiles) {
        processFiles(pendingFiles);
      }
    };

    // Check on mount / conversation change
    checkPendingFiles();

    // Listen for drop events on the same conversation
    const handleFilesDropped = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (Number(detail?.conversationId) === Number(convId)) {
        checkPendingFiles();
      }
    };
    window.addEventListener("FILES_DROPPED_ON_CONVERSATION", handleFilesDropped as EventListener);

    return () => {
      window.removeEventListener("FILES_DROPPED_ON_CONVERSATION", handleFilesDropped as EventListener);
    };
  }, [selectedCustomer?.ConversationId, processFiles]);

  // Messages ref for reaction handlers (reuse existing messagesRef from line 58)
  const { handleMessageEmojiClick, handleRemoveReaction } = useReactions({
    auth,
    selectedCustomer,
    dispatchMsg,
    messagesRef,
    fetchAndCacheGroupMembers,
  });

  const typingStatus = useTypingIndicator(
    selectedCustomer?.ConversationId ?? undefined,
    auth?.id
  );

  // ── Typing emitter (sends typing indicators to other participants) ───────
  const { onTextChange: onTypingChange, cleanup: cleanupTyping } = useTypingEmitter({
    auth,
    selectedCustomer,
    fetchAndCacheGroupMembers,
  });

  // Cleanup typing emitter on unmount
  useEffect(() => {
    return () => cleanupTyping();
  }, [cleanupTyping]);

  // ── Conversation change effect ───────────────────────────────────────────
  // Only re-run when the conversation ID changes — use refs for everything else
  // to avoid infinite loops (loadConversation changes when msgState changes).
  const loadConversationRef = useRef(loadConversation);
  const handleReadMessageRef = useRef(handleReadMessage);
  const saveDraftRef = useRef(saveDraft);
  useEffect(() => {
    loadConversationRef.current = loadConversation;
  }, [loadConversation]);
  useEffect(() => {
    handleReadMessageRef.current = handleReadMessage;
  }, [handleReadMessage]);
  useEffect(() => {
    saveDraftRef.current = saveDraft;
  }, [saveDraft]);

  useEffect(() => {
    const nextId = selectedCustomer?.ConversationId;
    const prevId = prevConvIdRef.current;

    // COMMIT DRAFT FOR PREVIOUS CONVERSATION
    if (prevId && prevId !== nextId) {
      saveDraftRef.current(prevId, latestInputValueRef.current);
    }

    if (!nextId) {
      dispatchMsg({ type: MSG.CLEAR });
      dispatchUI({ type: UI.SET_INPUT, value: "" });
      prevConvIdRef.current = null;
      return;
    }

    dispatchUI({ type: UI.SET_REPLY, value: null });
    dispatchUI({ type: UI.SET_FORWARD, value: null });
    // Reset star filter when switching conversations
    dispatchUI({ type: UI.SET_STAR_FILTER, value: false });
    // Clear any buffered new messages from previous conversation
    dispatchMsg({ type: MSG.CLEAR_BUFFER });
    // NOTE: Do NOT set SET_LOADING here — loadConversation handles it.
    // If we set loading=true here, the overlay covers cached messages
    // that loadConversation renders instantly from IndexedDB. The loader
    // is only shown inside loadConversation when there is NO cache.

    // Pass LastMessageId as the initial cursor so the API anchors the
    // initial page around the last known message for that conversation.
    // ignoreCache=false: cache-first. The loader renders cached messages
    // instantly (no spinner) and the API reconciles in the background via
    // an ID-based merge — only new/updated rows change, so there is no
    // visible content swap.
    const lastMsgId = Number(selectedCustomer?.LastMessageId) || 0;
    loadConversationRef.current(1, true, false, lastMsgId);
    handleReadMessageRef.current(nextId, null);

    prevConvIdRef.current = nextId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?.ConversationId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (prevConvIdRef.current) {
        saveDraft(prevConvIdRef.current, latestInputValueRef.current);
      }
    };
  }, [saveDraft]);

  // Auto-read on focus / visibility
  useEffect(() => {
    const fn = () => {
      if (
        document.visibilityState === "visible" &&
        selectedCustomerRef.current?.ConversationId
      ) {
        handleReadMessage(selectedCustomerRef.current.ConversationId, null, true);
      }
    };
    window.addEventListener("focus", fn);
    document.addEventListener("visibilitychange", fn);
    return () => {
      window.removeEventListener("focus", fn);
      document.removeEventListener("visibilitychange", fn);
    };
  }, [handleReadMessage]);

  // ── Notify parent when conversation is read / unread ──────────────────────
  // Mirrors old CRA useConversation.js: when selectedCustomer changes,
  // call onConversationRead(true) to clear the unread badge in the list.
  // On cleanup (switching away), call onConversationRead(false) to reset.
  useEffect(() => {
    if (selectedCustomer && onConversationRead) onConversationRead(true);
    return () => {
      if (onConversationRead) onConversationRead(false);
    };
  }, [selectedCustomer, onConversationRead]);

  // ── Clear messages when CLEAR_CONVERSATION_MESSAGES is dispatched ────────
  // Dispatched by useConfirmModal when user clears a chat.
  useEffect(() => {
    const handleClear = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const targetId = detail?.conversationId ?? detail?.ConversationId;
      const currentId = selectedCustomerRef.current?.ConversationId;
      if (!targetId || (currentId && Number(targetId) === Number(currentId))) {
        dispatchMsg({ type: MSG.CLEAR });
        // Also clear search state — the messages that were searched are gone
        dispatchUI({ type: UI.SET_SEARCH_RESULTS, value: [] });
        dispatchUI({ type: UI.SET_SEARCHING, value: false });
      }
    };
    window.addEventListener("CLEAR_CONVERSATION_MESSAGES", handleClear as EventListener);
    return () => {
      window.removeEventListener("CLEAR_CONVERSATION_MESSAGES", handleClear as EventListener);
    };
  }, []);

  // ── Debounced cache write ────────────────────────────────────────────────
  useEffect(() => {
    const id = selectedCustomer?.ConversationId;
    if (!id || !msgState.data.length) return;
    if (cacheWriteTimer.current) clearTimeout(cacheWriteTimer.current);
    cacheWriteTimer.current = setTimeout(() => {
      // The clone+put walks every message synchronously — run it at idle
      // time so it doesn't compete with conversation-switch rendering.
      const schedule =
        typeof window !== "undefined" && "requestIdleCallback" in window
          ? window.requestIdleCallback
          : (cb: () => void) => window.setTimeout(cb, 1);
      schedule(() => {
        // Cap at 500 — the deep clone + bulkPut walks every message on the
        // main thread; 2000 was a ~130ms chunk even at idle time.
        saveConversationToCache(id, msgState.data, auth, 500);
      });
    }, 800);
    return () => {
      if (cacheWriteTimer.current) clearTimeout(cacheWriteTimer.current);
    };
  }, [msgState.data, selectedCustomer?.ConversationId, auth]);

  // ── Derived state ────────────────────────────────────────────────────────
  // Note: groupMessagesByDate was removed — flattenedRows already does
  // date grouping inline, so the separate grouping pass was wasted work.
  const messageById = useMemo(() => {
    const map = new Map<string | number, ChatMessage>();
    for (const m of msgState.data) {
      const id = m.Id ?? m.MessageId;
      if (id != null) map.set(id, m);
    }
    return map;
  }, [msgState.data]);

  const flattenedRows = useMemo((): FlattenedRow[] => {
    const rows: FlattenedRow[] = [{ type: "spacer-top" }];
    let lastDateKey = "";
    // When star filter is active, only show starred messages
    const data = uiState.starFilter
      ? msgState.data.filter((m) => m.IsStar === 1)
      : msgState.data;
    for (let i = 0; i < data.length; i++) {
      const msg = data[i];
      const dateKey = formatDateTime(msg.Date || msg.DateTime || msg.dateTime, "dateKey");
      if (dateKey && dateKey !== lastDateKey) {
        rows.push({ type: "date", date: dateKey });
        lastDateKey = dateKey;
      }
      rows.push({ type: "message", msg, msgIndex: i });
    }
    if (typingStatus) rows.push({ type: "typing" });
    rows.push({ type: "spacer-bottom" });
    return rows;
  }, [msgState.data, typingStatus, uiState.starFilter]);

  // ── Stable helpers ───────────────────────────────────────────────────────

  // ── Star filter: toggle and reload messages with IsStar filter ───────────
  // When enabled, sends IsStar=1 to GetMessagesCursor so the backend returns
  // only starred messages. When disabled, reloads normally (IsStar=0).
  const starFilterRef = useRef(false);
  useEffect(() => {
    starFilterRef.current = uiState.starFilter;
  }, [uiState.starFilter]);

  const handleToggleStarFilter = useCallback(() => {
    const next = !uiState.starFilter;
    dispatchUI({ type: UI.SET_STAR_FILTER, value: next });
    // Update the ref immediately so loadConversation uses the correct
    // IsStar value on this render cycle (the useEffect update lags by
    // one render, causing the wrong IsStar to be sent on toggle).
    starFilterRef.current = next;
    // Reload messages with the star filter applied — pass the star value
    // directly so the API gets IsStar=1 when enabling, IsStar=0 when disabling.
    const lastMsgId = Number(selectedCustomer?.LastMessageId) || 0;
    loadConversationRef.current(1, true, true, lastMsgId, next ? 1 : 0);
  }, [uiState.starFilter, selectedCustomer, dispatchUI]);

  // Count new (non-starred) messages that arrive while star filter is active.
  // These are shown as a badge on the star toggle button.
  const [starNewMessageCount, setStarNewMessageCount] = useState(0);
  const prevDataLenRef = useRef(0);
  useEffect(() => {
    if (!uiState.starFilter) {
      setStarNewMessageCount(0);
      prevDataLenRef.current = msgState.data.length;
      return;
    }
    // If new messages arrived while star filter is on, count the non-starred ones
    if (msgState.data.length > prevDataLenRef.current) {
      const newMsgs = msgState.data.slice(prevDataLenRef.current);
      const nonStarredNew = newMsgs.filter((m) => m.IsStar !== 1).length;
      if (nonStarredNew > 0) {
        setStarNewMessageCount((prev: number) => prev + nonStarredNew);
      }
    }
    prevDataLenRef.current = msgState.data.length;
  }, [msgState.data, uiState.starFilter]);

  const getMessageStatusIcon = useCallback(
    (msg: ChatMessage): "sent" | "delivered" | "read" | null => {
      const raw = msg.Status ?? msg.status ?? msg.MessageStatus;
      if (typeof raw === "string") {
        const l = raw.toLowerCase();
        if (l === "read") return "read";
        if (l === "sent") return "sent";
        if (l === "delivered") return "delivered";
      }
      const p = typeof raw === "number" ? raw : parseInt(String(raw), 10);
      if (p === 3) return "read";
      if (p === 2) return "delivered";
      if (p === 1 || p === 0) return "sent";
      return null;
    },
    []
  );

  // Stable media key that survives the temp→server ID transition.
  // Using msg.Id causes a flash when UPSERT replaces the temp ID with the
  // server MessageId — loadedMedia[oldKey] is true but loadedMedia[newKey]
  // is false, so the skeleton reappears and the image flashes.
  // Instead, use ConversationId + DateTime + index, which are stable across
  // the UPSERT (only Id, previewUrl, mediaItems change, not DateTime).
  const getMediaKey = useCallback(
    (msg: ChatMessage, index: number) =>
      `${msg.ConversationId ?? "conv"}-${msg.DateTime ?? msg.Date ?? msg.Time ?? ""}-${index}`,
    []
  );

  const markLoaded = useCallback(
    (key: string) => dispatchUI({ type: UI.SET_LOADED_MEDIA, key }),
    [dispatchUI]
  );

  const getMediaSrcForMessage = useCallback((msg: ChatMessage) => {
    if (!msg) return "";
    if (msg.previewUrl) return msg.previewUrl;
    return "";
  }, []);

  const scrollToMessage = useCallback(
    async (
      messageId: string | number,
      containerRef: React.MutableRefObject<HTMLElement | null>,
      _attachmentId?: string | null,
      searchQuery?: string | null
    ) => {
      if (!containerRef.current || !messageId) return;
      const sid = String(messageId);
      const el = containerRef.current.querySelector(`[data-message-id="${sid}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        dispatchUI({ type: UI.SET_BLINK, value: sid });
        if (searchQuery) dispatchUI({ type: UI.SET_SEARCH_HIGHLIGHT, value: { query: searchQuery, messageId: sid } });
        // Blink clears on 3s timeout; search highlight clears on user interaction
        setTimeout(() => {
          dispatchUI({ type: UI.SET_BLINK, value: null });
        }, 3000);
        return;
      }

      // Message not in DOM — fetch it using cursor API (Direction 3 = BETWEEN)
      // with the message ID as the cursor. This loads a page of messages
      // anchored around the target message, then we scroll to it.
      const convId = selectedCustomerRef.current?.ConversationId;
      if (!convId || !auth) return;

      const cursorId = Number(messageId) || 0;
      if (!cursorId) return;

      dispatchMsg({ type: MSG.SET_LOADING, value: true });
      // Set blink BEFORE loading so MessageList knows to skip auto-scroll
      dispatchUI({ type: UI.SET_BLINK, value: sid });
      if (searchQuery) dispatchUI({ type: UI.SET_SEARCH_HIGHLIGHT, value: { query: searchQuery, messageId: sid } });
      try {
        const response = await conversationViewCursor(
          convId,
          3 as CursorDirection,
          cursorId,
          20,
          auth,
          null
        );

        // Guard: bail if the user switched conversations while the request
        // was in flight, so we don't overwrite the new chat with stale data.
        if (selectedCustomerRef.current?.ConversationId !== convId) return;

        const serverMessages = response.data as ChatMessage[];
        if (!serverMessages.length) {
          dispatchUI({ type: UI.SET_BLINK, value: null });
          return;
        }

        const merged = mergeMessages(serverMessages, messagesRef.current, convId);
        dispatchMsg({ type: MSG.LOAD, data: merged, total: response.total });
        dispatchMsg({ type: MSG.SET_HAS_MORE, value: response.hasMoreBefore || response.hasMoreAfter });
        dispatchMsg({ type: MSG.SET_HAS_MORE_BEFORE, value: response.hasMoreBefore });
        dispatchMsg({ type: MSG.SET_HAS_MORE_AFTER, value: response.hasMoreAfter });
        dispatchMsg({
          type: MSG.SET_CURSORS,
          beforeCursor: response.beforeCursor,
          afterCursor: response.afterCursor,
        });

        // Wait for DOM to render the new messages, then scroll to target
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const target = containerRef.current?.querySelector(`[data-message-id="${sid}"]`);
            if (target) {
              target.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            // Keep blink for 3s total, then clear (highlight clears on user interaction)
            setTimeout(() => {
              dispatchUI({ type: UI.SET_BLINK, value: null });
            }, 3000);
          });
        });
      } catch (err) {
        console.error("scrollToMessage cursor fetch error:", err);
      } finally {
        dispatchMsg({ type: MSG.SET_LOADING, value: false });
      }
    },
    [dispatchUI, dispatchMsg, auth, selectedCustomerRef]
  );

  // ── Clear search highlight on user interaction ────────────────────────────
  // The blink animation clears on its 3s timeout, but the search keyword
  // highlight stays until the user interacts with the chat (scroll, click,
  // keydown, touch). This mirrors WhatsApp — the highlight persists so the
  // user can read the matched word, then disappears once they start doing
  // something else.
  useEffect(() => {
    const clearHighlight = () => {
      dispatchUI({ type: UI.SET_SEARCH_HIGHLIGHT, value: { query: null, messageId: null } });
    };
    // Use passive listeners so we don't block scrolling
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("scroll", clearHighlight, opts);
    window.addEventListener("click", clearHighlight);
    window.addEventListener("keydown", clearHighlight);
    window.addEventListener("touchstart", clearHighlight, opts);
    return () => {
      window.removeEventListener("scroll", clearHighlight, opts);
      window.removeEventListener("click", clearHighlight);
      window.removeEventListener("keydown", clearHighlight);
      window.removeEventListener("touchstart", clearHighlight, opts);
    };
  }, [dispatchUI]);

  const refresh = useCallback(() => {
    // Use LastMessageId from the conversation list as the cursor (same as
    // initial conversation open) so refresh anchors around the latest known
    // message, not cursor 0.
    const lastMsgId = Number(selectedCustomer?.LastMessageId) || 0;
    loadConversation(1, true, true, lastMsgId);
  }, [loadConversation, selectedCustomer?.LastMessageId]);

  // ── Search messages ──────────────────────────────────────────────────────
  const searchMessages = useCallback(
    async (query: string) => {
      if (!selectedCustomer?.ConversationId || !query?.trim()) {
        dispatchUI({ type: UI.SET_SEARCH_RESULTS, value: [] });
        return;
      }
      dispatchUI({ type: UI.SET_SEARCHING, value: true });
      try {
        const convId = selectedCustomer.ConversationId;
        const cached = await getSearchCache(auth, convId, query);
        // Guard: bail if the user switched conversations while awaiting cache.
        if (selectedCustomerRef.current?.ConversationId !== convId) return;
        if (cached) {
          dispatchUI({ type: UI.SET_SEARCH_RESULTS, value: cached });
          return;
        }
        const response = await conversationView(
          convId,
          1,
          100,
          auth,
          null,
          query
        );
        // Guard: bail if the user switched conversations while awaiting network.
        if (selectedCustomerRef.current?.ConversationId !== convId) return;
        const results = (response.data as ChatMessage[]) || [];
        setSearchCache(auth, convId, query, results).catch(() => {});
        dispatchUI({ type: UI.SET_SEARCH_RESULTS, value: results });
      } catch {
        dispatchUI({ type: UI.SET_SEARCH_RESULTS, value: [] });
      } finally {
        dispatchUI({ type: UI.SET_SEARCHING, value: false });
      }
    },
    [selectedCustomer?.ConversationId, selectedCustomerRef, auth, dispatchUI]
  );

  const searchByDate = useCallback(
    async (date: string): Promise<boolean> => {
      const convId = selectedCustomer?.ConversationId;
      if (!convId || !auth || !date) return false;
      dispatchMsg({ type: MSG.SET_LOADING, value: true });
      try {
        // Direction 4 (date search) — the backend anchors purely on
        // MsgDate; CursorMessageId is omitted from the payload entirely
        // so the current scroll position can't skew the results.
        const response = await conversationViewCursor(
          convId,
          4 as CursorDirection,
          0,
          50,
          auth,
          null,
          "Message ( Search By Date )",
          0,
          date
        );
        if (selectedCustomerRef.current?.ConversationId !== convId) return false;
        const results = response.data as ChatMessage[];
        if (results.length > 0) {
          dispatchMsg({
            type: MSG.LOAD,
            data: results,
            total: response.total,
          });
          dispatchMsg({
            type: MSG.SET_CURSORS,
            beforeCursor: response.beforeCursor,
            afterCursor: response.afterCursor,
          });
          // Forward the real per-direction flags — the scroll loaders gate on
          // hasMoreBefore/hasMoreAfter, so leaving them stale (e.g.
          // hasMoreAfter=false from sitting at the bottom) breaks pagination
          // after a date jump and traps the user in the search range.
          dispatchMsg({ type: MSG.SET_HAS_MORE_BEFORE, value: response.hasMoreBefore });
          dispatchMsg({ type: MSG.SET_HAS_MORE_AFTER, value: response.hasMoreAfter });
          dispatchMsg({
            type: MSG.SET_HAS_MORE,
            value: response.hasMoreBefore || response.hasMoreAfter,
          });
          // Clear stale anchors/errors — the anchor message may not exist in
          // the date-search window, and old error states would block retries.
          dispatchMsg({ type: MSG.SET_UNREAD_ANCHOR, messageId: null, count: 0 });
          dispatchMsg({ type: MSG.SET_OLDER_ERROR, value: false });
          dispatchMsg({ type: MSG.SET_NEWER_ERROR, value: false });
          return true;
        }
        return false;
      } catch (err) {
        console.error("searchByDate error:", err);
        return false;
      } finally {
        dispatchMsg({ type: MSG.SET_LOADING, value: false });
      }
    },
    [selectedCustomer?.ConversationId, selectedCustomerRef, auth, dispatchMsg]
  );

  // ── Public API ───────────────────────────────────────────────────────────
  return {
    // State
    inputValue: uiState.inputValue,
    setInputValue: (v: string) => dispatchUI({ type: UI.SET_INPUT, value: v }),
    updateLatestInput,
    messages: msgState.data,
    mediaFiles: uiState.mediaFiles,
    setMediaFiles: (v: typeof uiState.mediaFiles) =>
      dispatchUI({ type: UI.SET_MEDIA_FILES, value: v }),
    showMedia: uiState.showMedia,
    loading: msgState.loading,
    loadingOlder: msgState.loadingOlder,
    loadingNewer: msgState.loadingNewer,
    hasMoreBefore: msgState.hasMoreBefore,
    hasMoreAfter: msgState.hasMoreAfter,
    olderError: msgState.olderError,
    newerError: msgState.newerError,
    unreadAnchorMessageId: msgState.unreadAnchorMessageId,
    unreadCount: msgState.unreadCount,
    pendingNewMessages: msgState.pendingNewMessages,
    isAtBottomRef,
    autoLoadNewerRef,
    loadedMedia: uiState.loadedMedia,
    replyToMessage: uiState.replyToMessage,
    forwardMessage: uiState.forwardMessage,
    forwardAnchorEl: uiState.forwardAnchorEl,
    blinkMessageId: uiState.blinkMessageId,
    searchHighlightQuery: uiState.searchHighlightQuery,
    searchHighlightMessageId: uiState.searchHighlightMessageId,
    mediaViewerOpen: uiState.mediaViewerOpen,
    mediaViewerItems: uiState.mediaViewerItems,
    mediaViewerIndex: uiState.mediaViewerIndex,
    mediaViewerMessage: uiState.mediaViewerMessage,
    pdfViewerOpen: uiState.pdfViewerOpen,
    pdfViewerItem: uiState.pdfViewerItem,
    txtViewerOpen: uiState.txtViewerOpen,
    txtViewerItem: uiState.txtViewerItem,
    flattenedRows,
    messageById,
    typingStatus,

    // Functions
    loadConversation,
    loadOlderMessages,
    loadNewerMessages,
    retryLoadOlder,
    retryLoadNewer,
    jumpToLatest,
    flushNewMessages: () => {
      dispatchMsg({ type: MSG.FLUSH_NEW });
      // After flushing buffered messages into the visible list, send read
      // receipts so the other side sees them as read. Without this, messages
      // that arrived while the user was scrolled up never get marked as read.
      const convId = selectedCustomerRef.current?.ConversationId;
      if (convId) {
        handleReadMessage(convId, null, true);
      }
    },
    handleAttachClick,
    handleFileChange,
    processFiles,
    handleMediaClick,
    handleClosePreview,
    handleClosePdfViewer,
    handleCloseTxtViewer,
    handleSendMessage,
    handleReply,
    handleCancelReply,
    retryFailedMessage,
    handleForward,
    handleCloseForward,
    handleSendForward,
    handleEditMessage,
    handleDeleteMessage,
    handleStarMessage,
    handleMessageEmojiClick,
    handleRemoveReaction,
    searchMessages,
    searchByDate,
    isSearching: uiState.isSearching,
    searchResults: uiState.searchResults,
    getMessageStatusIcon,
    getMediaSrcForMessage,
    getMediaKey,
    markLoaded,
    scrollToMessage,
    addUniqueMessage,
    refresh,
    onTypingChange,
    fetchAndCacheGroupMembers,
    // Star filter
    starFilter: uiState.starFilter,
    handleToggleStarFilter,
    starNewMessageCount,
  };
};
