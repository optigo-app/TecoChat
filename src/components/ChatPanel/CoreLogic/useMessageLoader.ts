"use client";

// ─── useMessageLoader ───────────────────────────────────────────────────────
// Cursor-based message loading.
// Uses GetMessagesCursor API with Direction:
//   0 = INITIAL (open conversation — latest page, no cursor needed)
//   1 = AFTER (load newer messages below current)
//   2 = BEFORE (load older messages above current)
//   3 = BETWEEN (search jump — bi-directional around a cursor)
//
// Initial load uses Direction 0 to get the latest page directly.
// Scroll-up loads older (Direction 2) using beforeCursor.
// Scroll-down loads newer (Direction 1) using afterCursor.

import { useCallback, useRef, useEffect } from "react";
import {
  conversationViewCursor,
  type CursorDirection,
} from "../../../API/ConversationView/ConversationView";
import { MSG, type MsgState, type MsgAction } from "./conversationReducer";
import {
  mergeMessages,
  getConversationFromCache,
  saveConversationToCache,
} from "./messageHelpers";
import { getMessagesBefore, getMessagesAfter } from "../../../db/messageCache";
import { setSyncState } from "../../../db/outboxCache";
import type { AuthData } from "../../../context/LoginData";
import type { ChatMessage } from "../../../types/message";
import type { ConversationListEntry } from "../../../types/conversation";

interface UseMessageLoaderProps {
  selectedCustomer: ConversationListEntry | null;
  auth: AuthData | null;
  pageSize: number;
  initialPageSize?: number;
  msgState: MsgState;
  dispatchMsg: React.Dispatch<MsgAction>;
  isStarFilter?: 0 | 1;
}

export function useMessageLoader({
  selectedCustomer,
  auth,
  pageSize,
  initialPageSize = 20,
  msgState,
  dispatchMsg,
  isStarFilter = 0,
}: UseMessageLoaderProps) {
  const latestRequestRef = useRef(0);
  const initAbortRef = useRef<AbortController | null>(null);
  const olderAbortRef = useRef<AbortController | null>(null);
  const newerAbortRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);
  const msgDataRef = useRef(msgState.data);
  const cursorRef = useRef<{ before: number | null; after: number | null }>({
    before: null,
    after: null,
  });
  const autoLoadNewerRef = useRef(false);
  const loadNewerMessagesRef = useRef<() => void>(() => {});
  const isStarFilterRef = useRef(isStarFilter);

  useEffect(() => {
    isStarFilterRef.current = isStarFilter;
  }, [isStarFilter]);

  useEffect(() => {
    msgDataRef.current = msgState.data;
    cursorRef.current = {
      before: msgState.beforeCursor,
      after: msgState.afterCursor,
    };
  }, [msgState.data, msgState.beforeCursor, msgState.afterCursor]);

  const loadConversation = useCallback(
    async (page = 1, reset = false, ignoreCache = false, cursorId: number = 0, starOverride?: 0 | 1) => {
      const convId = selectedCustomer?.ConversationId;
      if (!convId || !auth) return;
      autoLoadNewerRef.current = false;

      const requestId = ++latestRequestRef.current;
      const controller = new AbortController();
      if (initAbortRef.current) initAbortRef.current.abort();
      initAbortRef.current = controller;

      const effectiveStar = starOverride !== undefined ? starOverride : isStarFilterRef.current;

      const selectedId = convId;
      let didShowCache = false;
      if (reset && !ignoreCache) {
        // Clear previous conversation's messages IMMEDIATELY so they don't
        // leak into the new conversation while the cache read is in flight.
        dispatchMsg({ type: MSG.CLEAR });

        try {
          const cached = await getConversationFromCache(selectedId, auth);
          if (
            cached.length > 0 &&
            requestId === latestRequestRef.current &&
            selectedId === selectedCustomer?.ConversationId
          ) {
            dispatchMsg({ type: MSG.LOAD, data: cached, total: cached.length });
            dispatchMsg({ type: MSG.SET_HAS_MORE, value: false });
            dispatchMsg({ type: MSG.SET_LOADING, value: false });
            didShowCache = true;
          }
        } catch {
          /* ignore */
        }
      }
      if (!didShowCache) dispatchMsg({ type: MSG.SET_LOADING, value: true });
      loadingRef.current = true;

      try {
        const response = await conversationViewCursor(
          selectedId,
          0 as CursorDirection, // INITIAL — latest page
          cursorId,
          initialPageSize,
          auth,
          controller.signal,
          undefined,
          effectiveStar
        );

        // Race condition guard
        if (
          requestId !== latestRequestRef.current ||
          selectedId !== selectedCustomer?.ConversationId
        )
          return;

        let serverMessages = response.data as ChatMessage[];
       
        if (serverMessages.length === 0 && cursorId !== 0) {
          const fallbackResponse = await conversationViewCursor(
            selectedId,
            0 as CursorDirection,
            0, // no cursor = latest page
            initialPageSize,
            auth,
            controller.signal,
            undefined,
            effectiveStar
          );
          if (
            requestId !== latestRequestRef.current ||
            selectedId !== selectedCustomer?.ConversationId
          )
            return;
          serverMessages = fallbackResponse.data as ChatMessage[];
          // Use the fallback response's cursors
          const merged = mergeMessages(serverMessages, msgDataRef.current, selectedId);
          dispatchMsg({ type: MSG.LOAD, data: merged, total: fallbackResponse.total });
          dispatchMsg({ type: MSG.SET_HAS_MORE, value: fallbackResponse.hasMoreBefore });
          dispatchMsg({ type: MSG.SET_HAS_MORE_BEFORE, value: fallbackResponse.hasMoreBefore });
          dispatchMsg({ type: MSG.SET_HAS_MORE_AFTER, value: false });
          dispatchMsg({
            type: MSG.SET_CURSORS,
            beforeCursor: fallbackResponse.beforeCursor,
            afterCursor: null,
          });
          dispatchMsg({ type: MSG.SET_PAGE, value: 1 });
          dispatchMsg({ type: MSG.SET_PAGE_SIZE, value: initialPageSize });
          dispatchMsg({ type: MSG.SET_OLDER_ERROR, value: false });
          dispatchMsg({ type: MSG.SET_NEWER_ERROR, value: false });
          dispatchMsg({ type: MSG.SET_UNREAD_ANCHOR, messageId: null, count: 0 });
          cursorRef.current = { before: fallbackResponse.beforeCursor, after: null };
          if (merged.length > 0) {
            saveConversationToCache(selectedId, merged, auth).catch(() => {
              /* ignore */
            });
          }
          return;
        }

        const merged = mergeMessages(
          serverMessages,
          msgDataRef.current,
          selectedId
        );

        // ── Unread anchor: scroll to first unread message instead of bottom ──
        // When opening a conversation with UnreadCount > 0, compute the first
        // unread message ID so MessageList can scroll to it (WhatsApp-style).
        // The latest N messages are the unread ones, where N = UnreadCount.
        //
        // IMPORTANT: This MUST be dispatched BEFORE MSG.LOAD so that the
        // unreadAnchorMessageId is available in state when the rows first
        // render and the initial scroll effect runs. Otherwise the effect
        // sees null anchor, scrolls to bottom, and sets didInitialScroll=true
        // before the anchor arrives.
        const unreadCount = Number(selectedCustomer?.UnreadCount) || Number(selectedCustomer?.UnReadMsgCount) || 0;
        if (unreadCount > 0 && merged.length > 0) {
          if (unreadCount >= merged.length) {
            // All loaded messages are unread — anchor is the first (oldest) message.
            // More older messages exist; the user can scroll up to see them.
            const firstMsg = merged[0];
            const anchorId = firstMsg.MessageId ?? firstMsg.Id;
            if (anchorId != null) {
              dispatchMsg({ type: MSG.SET_UNREAD_ANCHOR, messageId: anchorId, count: unreadCount });
            }
          } else {
            // First unread message is at index (length - unreadCount)
            const anchorIndex = merged.length - unreadCount;
            const anchorMsg = merged[anchorIndex];
            const anchorId = anchorMsg?.MessageId ?? anchorMsg?.Id;
            if (anchorId != null) {
              dispatchMsg({ type: MSG.SET_UNREAD_ANCHOR, messageId: anchorId, count: unreadCount });
            }
          }
        } else {
          // No unread messages — clear any previous anchor
          dispatchMsg({ type: MSG.SET_UNREAD_ANCHOR, messageId: null, count: 0 });
        }

        dispatchMsg({ type: MSG.LOAD, data: merged, total: response.total });
        dispatchMsg({
          type: MSG.SET_HAS_MORE,
          value: response.hasMoreBefore,
        });
        dispatchMsg({ type: MSG.SET_HAS_MORE_BEFORE, value: response.hasMoreBefore });
        // No newer messages to load — we started from the latest
        dispatchMsg({ type: MSG.SET_HAS_MORE_AFTER, value: false });
        dispatchMsg({
          type: MSG.SET_CURSORS,
          beforeCursor: response.beforeCursor,
          afterCursor: null,
        });
        dispatchMsg({ type: MSG.SET_PAGE, value: 1 });
        dispatchMsg({ type: MSG.SET_PAGE_SIZE, value: initialPageSize });
        // Clear errors on successful load
        dispatchMsg({ type: MSG.SET_OLDER_ERROR, value: false });
        dispatchMsg({ type: MSG.SET_NEWER_ERROR, value: false });

        // No auto-load-newer needed — Direction 2 already gives us the latest
        cursorRef.current = {
          before: response.beforeCursor,
          after: null,
        };

        // Persist the merged messages to IndexedDB (best-effort, non-blocking).
        if (merged.length > 0) {
          saveConversationToCache(selectedId, merged, auth).catch(() => {});
          const lastMsg = merged[merged.length - 1];
          const lastMsgId = lastMsg?.MessageId ?? lastMsg?.Id;
          if (lastMsgId) {
            setSyncState(auth, selectedId, lastMsgId).catch(() => {});
          }
        }

        // One-page-ahead prefetch: if there are older messages on the server,
        // fetch them silently into IDB so scrolling up is instant.
        if (response.hasMoreBefore && response.beforeCursor != null) {
          conversationViewCursor(
            selectedId,
            2 as CursorDirection,
            response.beforeCursor,
            pageSize,
            auth,
            undefined,
            undefined,
            effectiveStar
          ).then((prefetch) => {
            if (prefetch.data.length > 0) {
              saveConversationToCache(selectedId, prefetch.data as ChatMessage[], auth).catch(() => {});
            }
          }).catch(() => {});
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("loadConversation error:", err);
        }
      } finally {
        loadingRef.current = false;
        if (requestId === latestRequestRef.current) {
          dispatchMsg({ type: MSG.SET_LOADING, value: false });
        }
      }
    },
    [selectedCustomer?.ConversationId, auth, initialPageSize, dispatchMsg]
  );

  // ── Load older messages (scroll up, Direction 2 = BEFORE) ────────────────
  const loadOlderMessages = useCallback(async () => {
    if (
      msgState.loadingOlder ||
      msgState.loading ||
      !msgState.hasMoreBefore ||
      !selectedCustomer?.ConversationId ||
      !auth ||
      cursorRef.current.before == null
    )
      return;

    const requestId = ++latestRequestRef.current;
    const controller = new AbortController();
    if (olderAbortRef.current) olderAbortRef.current.abort();
    olderAbortRef.current = controller;

    dispatchMsg({ type: MSG.SET_LOADING_OLDER, value: true });
    dispatchMsg({ type: MSG.SET_OLDER_ERROR, value: false });

    const selectedId = selectedCustomer.ConversationId;
    const prevBeforeCursor = cursorRef.current.before;

    // Cache-first: try loading older messages from IndexedDB before hitting API.
    const firstMsg = msgDataRef.current[0];
    const firstMsgId = firstMsg ? (firstMsg.MessageId ?? firstMsg.Id) : null;
    if (firstMsgId) {
      try {
        const cachedOlder = await getMessagesBefore(auth, selectedId, firstMsgId, pageSize);
        if (cachedOlder.length > 0) {
          const existingIds = new Set(msgDataRef.current.map((m) => String(m.MessageId ?? m.Id ?? "")));
          const newOnes = cachedOlder.filter((m) => !existingIds.has(String(m.MessageId ?? m.Id ?? "")));
          if (newOnes.length > 0) {
            dispatchMsg({ type: MSG.PREPEND, data: newOnes, total: msgState.total });
            // Still fetch from API to check if there are even older messages.
          }
        }
      } catch {
        /* ignore cache errors */
      }
    }

    try {
      const response = await conversationViewCursor(
        selectedId,
        2 as CursorDirection, // BEFORE
        prevBeforeCursor,
        pageSize,
        auth,
        controller.signal,
        undefined,
        isStarFilterRef.current
      );

      if (
        requestId !== latestRequestRef.current ||
        selectedId !== selectedCustomer?.ConversationId
      )
        return;

      const serverMessages = response.data as ChatMessage[];

      if (serverMessages.length === 0) {
        dispatchMsg({ type: MSG.SET_HAS_MORE_BEFORE, value: false });
        dispatchMsg({ type: MSG.SET_HAS_MORE, value: msgState.hasMoreAfter });
        return;
      }

      dispatchMsg({
        type: MSG.PREPEND,
        data: serverMessages,
        total: response.total,
      });
      // Persist the newly loaded older messages to IndexedDB.
      saveConversationToCache(selectedId, serverMessages, auth).catch(() => {
        /* ignore */
      });
      // If the beforeCursor didn't change, stop to prevent loops.
      const cursorUnchanged =
        response.beforeCursor == null ||
        (prevBeforeCursor != null && response.beforeCursor === prevBeforeCursor);
      const finalHasMoreBefore = response.hasMoreBefore && !cursorUnchanged;
      dispatchMsg({ type: MSG.SET_HAS_MORE_BEFORE, value: finalHasMoreBefore });
      dispatchMsg({
        type: MSG.SET_CURSORS,
        beforeCursor: response.beforeCursor,
        afterCursor: cursorRef.current.after, // keep existing afterCursor
      });
      dispatchMsg({
        type: MSG.SET_HAS_MORE,
        value: finalHasMoreBefore || msgState.hasMoreAfter,
      });
    } catch (err) {
      if (err instanceof Error && err.message !== "AbortError" && err.name !== "AbortError") {
        console.error("loadOlderMessages error:", err);
        // Set error state for retry UI (not on abort)
        if (err instanceof Error && err.message !== "AbortError" && err.name !== "AbortError") {
          dispatchMsg({ type: MSG.SET_OLDER_ERROR, value: true });
        }
      }
    } finally {
      if (requestId === latestRequestRef.current) {
        dispatchMsg({ type: MSG.SET_LOADING_OLDER, value: false });
      }
    }
  }, [
    msgState.loadingOlder,
    msgState.loading,
    msgState.hasMoreBefore,
    msgState.hasMoreAfter,
    selectedCustomer?.ConversationId,
    pageSize,
    auth,
    dispatchMsg,
  ]);

  // ── Load newer messages (scroll down, Direction 1 = AFTER) ───────────────
  const loadNewerMessages = useCallback(async () => {
    if (
      msgState.loadingNewer ||
      msgState.loading ||
      !msgState.hasMoreAfter ||
      !selectedCustomer?.ConversationId ||
      !auth ||
      cursorRef.current.after == null
    )
      return;

    const requestId = ++latestRequestRef.current;
    const controller = new AbortController();
    if (newerAbortRef.current) newerAbortRef.current.abort();
    newerAbortRef.current = controller;

    dispatchMsg({ type: MSG.SET_LOADING_NEWER, value: true });
    dispatchMsg({ type: MSG.SET_NEWER_ERROR, value: false });

    const selectedId = selectedCustomer.ConversationId;
    const prevAfterCursor = cursorRef.current.after;

    // Cache-first: try loading newer messages from IndexedDB before hitting API.
    const lastMsg = msgDataRef.current[msgDataRef.current.length - 1];
    const lastMsgId = lastMsg ? (lastMsg.MessageId ?? lastMsg.Id) : null;
    if (lastMsgId) {
      try {
        const cachedNewer = await getMessagesAfter(auth, selectedId, lastMsgId, pageSize);
        if (cachedNewer.length > 0) {
          const existingIds = new Set(msgDataRef.current.map((m) => String(m.MessageId ?? m.Id ?? "")));
          const newOnes = cachedNewer.filter((m) => !existingIds.has(String(m.MessageId ?? m.Id ?? "")));
          if (newOnes.length > 0) {
            dispatchMsg({ type: MSG.APPEND, data: newOnes, total: msgState.total });
          }
        }
      } catch {
        /* ignore cache errors */
      }
    }

    try {
      const response = await conversationViewCursor(
        selectedId,
        1 as CursorDirection, // AFTER
        prevAfterCursor,
        pageSize,
        auth,
        controller.signal,
        undefined,
        isStarFilterRef.current
      );

      if (
        requestId !== latestRequestRef.current ||
        selectedId !== selectedCustomer?.ConversationId
      )
        return;

      const serverMessages = response.data as ChatMessage[];

      if (serverMessages.length === 0) {
        dispatchMsg({ type: MSG.SET_HAS_MORE_AFTER, value: false });
        dispatchMsg({ type: MSG.SET_HAS_MORE, value: msgState.hasMoreBefore });
        return;
      }

      dispatchMsg({
        type: MSG.APPEND,
        data: serverMessages,
        total: response.total,
      });
      // Persist the newly loaded newer messages to IndexedDB.
      saveConversationToCache(selectedId, serverMessages, auth).catch(() => {
        /* ignore */
      });
      // If the afterCursor didn't change, the server has no more newer messages
      // even if hasMoreAfter is reported as true — stop to prevent loops.
      const cursorUnchanged =
        response.afterCursor == null ||
        (prevAfterCursor != null && response.afterCursor === prevAfterCursor);
      const finalHasMoreAfter = response.hasMoreAfter && !cursorUnchanged;
      dispatchMsg({ type: MSG.SET_HAS_MORE_AFTER, value: finalHasMoreAfter });
      dispatchMsg({
        type: MSG.SET_CURSORS,
        beforeCursor: cursorRef.current.before, // keep existing beforeCursor
        afterCursor: response.afterCursor,
      });
      dispatchMsg({
        type: MSG.SET_HAS_MORE,
        value: msgState.hasMoreBefore || finalHasMoreAfter,
      });

      // ── Auto-load continuation: if we're in auto-load mode and there
      // are still more newer messages, keep loading until we reach the
      // actual latest. This ensures the user starts at the real bottom
      // of the conversation after opening it.
      if (autoLoadNewerRef.current && finalHasMoreAfter && response.afterCursor != null) {
        cursorRef.current = {
          before: cursorRef.current.before,
          after: response.afterCursor,
        };
        // Continue loading next page of newer messages
        setTimeout(() => loadNewerMessagesRef.current(), 0);
      } else if (autoLoadNewerRef.current && !finalHasMoreAfter) {
        // Reached the actual latest — stop auto-loading
        autoLoadNewerRef.current = false;
      }
    } catch (err) {
      // AbortError is thrown as `new Error("AbortError")` by CommonApi —
      // check message, not name. Don't log aborted requests.
      if (err instanceof Error && err.message !== "AbortError" && err.name !== "AbortError") {
        console.error("loadNewerMessages error:", err);
        dispatchMsg({ type: MSG.SET_NEWER_ERROR, value: true });
      }
    } finally {
      if (requestId === latestRequestRef.current) {
        dispatchMsg({ type: MSG.SET_LOADING_NEWER, value: false });
      }
    }
  }, [
    msgState.loadingNewer,
    msgState.loading,
    msgState.hasMoreAfter,
    msgState.hasMoreBefore,
    selectedCustomer?.ConversationId,
    pageSize,
    auth,
    dispatchMsg,
  ]);

  // Keep loadNewerMessagesRef in sync so loadConversation can call it
  useEffect(() => {
    loadNewerMessagesRef.current = loadNewerMessages;
  }, [loadNewerMessages]);

  // ── Retry handlers (clear error + re-call) ──────────────────────────────
  const retryLoadOlder = useCallback(() => {
    dispatchMsg({ type: MSG.SET_OLDER_ERROR, value: false });
    loadOlderMessages();
  }, [dispatchMsg, loadOlderMessages]);

  const retryLoadNewer = useCallback(() => {
    dispatchMsg({ type: MSG.SET_NEWER_ERROR, value: false });
    loadNewerMessages();
  }, [dispatchMsg, loadNewerMessages]);

  // ── Jump to latest (WhatsApp-style) ──────────────────────────────────────
  // When user clicks the scroll-to-bottom button and hasMoreAfter is true
  // (they're in a historical view), this loads the latest page using
  // Direction 2 (BEFORE) with the conversation's LastMessageId as the cursor.
  // Falls back to 0 if LastMessageId is missing.
  // If hasMoreAfter is false, the caller just scrolls to bottom.
  const jumpToLatest = useCallback(async () => {
    const convId = selectedCustomer?.ConversationId;
    if (!convId || !auth) return;

    // If no more newer messages, caller should just scroll to bottom
    if (!msgState.hasMoreAfter) return false;

    // Reset auto-load flag
    autoLoadNewerRef.current = false;

    const requestId = ++latestRequestRef.current;
    const controller = new AbortController();
    if (initAbortRef.current) initAbortRef.current.abort();
    initAbortRef.current = controller;

    dispatchMsg({ type: MSG.SET_LOADING, value: true });
    loadingRef.current = true;

    try {
      // Direction 0 (INITIAL) gives us the latest page directly.
      const lastMsgId = Number(selectedCustomer?.LastMessageId) || 0;
      let response = await conversationViewCursor(
        convId,
        0 as CursorDirection, // INITIAL — latest page
        lastMsgId,
        initialPageSize,
        auth,
        controller.signal,
        undefined,
        isStarFilterRef.current
      );

      if (
        requestId !== latestRequestRef.current ||
        convId !== selectedCustomer?.ConversationId
      )
        return true;

      // Safety net: if empty result with non-zero cursor, retry with cursor 0
      if (response.data.length === 0 && lastMsgId !== 0) {
        response = await conversationViewCursor(
          convId,
          0 as CursorDirection,
          0,
          initialPageSize,
          auth,
          controller.signal,
          undefined,
          isStarFilterRef.current
        );
        if (
          requestId !== latestRequestRef.current ||
          convId !== selectedCustomer?.ConversationId
        )
          return true;
      }

      const serverMessages = response.data as ChatMessage[];
      const merged = mergeMessages(serverMessages, msgDataRef.current, convId);

      dispatchMsg({ type: MSG.LOAD, data: merged, total: response.total });
      dispatchMsg({
        type: MSG.SET_HAS_MORE,
        value: response.hasMoreBefore,
      });
      dispatchMsg({ type: MSG.SET_HAS_MORE_BEFORE, value: response.hasMoreBefore });
      dispatchMsg({ type: MSG.SET_HAS_MORE_AFTER, value: false });
      dispatchMsg({
        type: MSG.SET_CURSORS,
        beforeCursor: response.beforeCursor,
        afterCursor: null,
      });
      dispatchMsg({ type: MSG.SET_OLDER_ERROR, value: false });
      dispatchMsg({ type: MSG.SET_NEWER_ERROR, value: false });

      cursorRef.current = {
        before: response.beforeCursor,
        after: null,
      };

      if (merged.length > 0) {
        saveConversationToCache(convId, merged, auth).catch(() => {
          /* ignore */
        });
      }
      return true; // signal that we loaded new data
    } catch (err) {
      if (err instanceof Error && err.message !== "AbortError" && err.name !== "AbortError") {
        console.error("jumpToLatest error:", err);
      }
      return true;
    } finally {
      loadingRef.current = false;
      if (requestId === latestRequestRef.current) {
        dispatchMsg({ type: MSG.SET_LOADING, value: false });
      }
    }
  }, [
    selectedCustomer?.ConversationId,
    auth,
    msgState.hasMoreAfter,
    initialPageSize,
    dispatchMsg,
  ]);

  return {
    loadConversation,
    loadOlderMessages,
    loadNewerMessages,
    retryLoadOlder,
    retryLoadNewer,
    jumpToLatest,
    autoLoadNewerRef,
    abortControllerRef: initAbortRef,
  };
}
