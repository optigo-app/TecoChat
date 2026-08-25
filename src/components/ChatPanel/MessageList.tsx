"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
  memo,
} from "react";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ChatMessage, FlattenedRow } from "../../types/message";
import type { ConversationListEntry } from "../../types/conversation";
import { formatDateTime } from "../../utils/dateUtils";
import { useIsMobile } from "../../hooks/useIsMobile";
import MessageItem from "./MessageItem";
import TypingIndicator from "./messages/TypingIndicator";
import ScrollToBottomButton from "./messages/ScrollToBottomButton";
import DragDropOverlay from "../DragDropOverlay/DragDropOverlay";
import type { TypingStatus } from "../../types/message";

export interface MessageListRef {
  scrollToMessage: (messageId: string | number, attachmentId?: string | null) => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

interface MessageListProps {
  rows: FlattenedRow[];
  loading: boolean;
  loadingOlder: boolean;
  selectedCustomer: ConversationListEntry | null;
  blinkMessageId: string | null;
  typingStatus: TypingStatus | null;
  getMessageStatusIcon: (msg: ChatMessage) => "sent" | "delivered" | "read" | null;
  onContextMenu?: (e: React.MouseEvent, msg: ChatMessage) => void;
  onMenuClick?: (e: React.MouseEvent, msg: ChatMessage) => void;
  onForward?: (msg: ChatMessage, event?: React.MouseEvent) => void;
  onQuickReaction?: (emoji: string, msg: ChatMessage) => void;
  onRemoveReaction?: (reaction: { Emoji?: string; Reaction?: string; UserId?: number | string }, msg: ChatMessage) => void;
  onMediaClick?: (msg: ChatMessage, index: number) => void;
  getMediaKey: (msg: ChatMessage, index: number) => string;
  loadedMedia: Record<string, boolean>;
  markLoaded: (key: string) => void;
  getMediaSrcForMessage: (msg: ChatMessage) => string;
  messageById?: Map<string | number, ChatMessage>;
  onScrollToTop?: () => void;
  hasMoreBefore?: boolean;
  hasMoreAfter?: boolean;
  loadingNewer?: boolean;
  pendingNewMessages?: ChatMessage[];
  isAtBottomRef?: React.MutableRefObject<boolean>;
  onFlushNewMessages?: () => void;
  onLoadNewer?: () => void;
  onJumpToLatest?: () => Promise<boolean | void>;
  /** Ref that's true while the loader is auto-loading newer messages
   *  (initial BETWEEN → latest). Distinguishes auto-load from user scroll. */
  isAutoLoadingNewerRef?: React.MutableRefObject<boolean>;
  /** Error states for retry */
  olderError?: boolean;
  newerError?: boolean;
  onRetryOlder?: () => void;
  onRetryNewer?: () => void;
  /** Unread separator anchor — stable message ID */
  unreadAnchorMessageId?: string | number | null;
  unreadCount?: number;
  /** Scroll position restoration */
  scrollRestoreKey?: string | number;
  processFiles?: (files: File[]) => void;
  onContainerRef?: (ref: HTMLDivElement | null) => void;
  auth?: { id?: string | number; userId?: string | number } | null;
  scrollToMessageProp?: (
    messageId: string | number,
    containerRef: React.MutableRefObject<HTMLElement | null>,
    attachmentId?: string | null
  ) => Promise<void> | void;
  isMediaPreviewOpen?: boolean;
  scrollToBottomRightOffset?: number;
}

const MessageList = forwardRef<MessageListRef, MessageListProps>(
  (
    {
      rows,
      loading,
      loadingOlder,
      loadingNewer,
      selectedCustomer,
      blinkMessageId,
      typingStatus,
      getMessageStatusIcon,
      onContextMenu,
      onMenuClick,
      onForward,
      onQuickReaction,
      onRemoveReaction,
      onMediaClick,
      getMediaKey,
      loadedMedia,
      markLoaded,
      getMediaSrcForMessage,
      messageById,
      onScrollToTop,
      hasMoreBefore = false,
      hasMoreAfter = false,
      pendingNewMessages = [],
      isAtBottomRef,
      onFlushNewMessages,
      onLoadNewer,
      onJumpToLatest,
      isAutoLoadingNewerRef,
      olderError = false,
      newerError = false,
      onRetryOlder,
      onRetryNewer,
      unreadAnchorMessageId = null,
      unreadCount = 0,
      scrollRestoreKey,
      processFiles,
      onContainerRef,
      auth,
      scrollToMessageProp,
      isMediaPreviewOpen = false,
      scrollToBottomRightOffset = 30,
    },
    ref
  ) => {
    const theme = useTheme();
    const outerRef = useRef<HTMLDivElement | null>(null);
    const containerRef = useRef<HTMLElement | null>(null);

    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [listVisible, setListVisible] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(new Set());
    const expandedMessageIdsRef = useRef<Set<string>>(expandedMessageIds);
    useEffect(() => {
      expandedMessageIdsRef.current = expandedMessageIds;
    }, [expandedMessageIds]);
    const isMobile = useIsMobile();

    const dragCounter = useRef(0);
    const distanceFromBottomRef = useRef(0);
    const scrollAnchorRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
    const wasLoadingOlderRef = useRef(false);
    const prevConvIdRef = useRef<string | number | null | undefined>(null);
    const didInitialScroll = useRef(false);
    const convLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevMsgCountRef = useRef(0);
    const blinkRef = useRef<string | null>(null);
    // Suppress scroll-triggered loads after programmatic scrolls / loads.
    // Cleared by a timeout once scrolling settles.
    const suppressScrollLoadRef = useRef(true);
    const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track pending new message count via ref so scroll handler doesn't
    // need to depend on the pendingNewMessages prop
    const pendingNewCountRef = useRef(0);

    // Sentinel refs for IntersectionObserver-based pagination
    const topSentinelRef = useRef<HTMLDivElement | null>(null);
    const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

    // Scroll position restoration per conversation
    const scrollRestoreRef = useRef<{ key: string | number; scrollTop: number; scrollHeight: number } | null>(null);

    // Track when auto-load-newer finishes so we can scroll to the actual bottom
    const wasAutoLoadingNewerRef = useRef(false);
    // Track when a user-triggered newer load finishes so we can SKIP the
    // auto-scroll-to-bottom (preserve user's scroll position instead).
    // Without this, scrolling near bottom to trigger the sentinel would
    // cause isNearBottom=true → auto-scroll to actual bottom after append.
    const wasLoadingNewerRef = useRef(false);
    // Track progressive scroll-to-bottom: user clicked the scroll-to-bottom
    // button while in a historical (BETWEEN) view. Instead of jumping directly
    // to the latest (which replaces all messages), we progressively load
    // newer pages via Direction 1 and scroll through them — WhatsApp-like.
    const isScrollingToBottomRef = useRef(false);

    useEffect(() => {
      blinkRef.current = blinkMessageId;
    }, [blinkMessageId]);

    useEffect(() => {
      pendingNewCountRef.current = pendingNewMessages.length;
    }, [pendingNewMessages]);

    // ── Sentinel-based pagination via IntersectionObserver ──────────────────
    // TOP sentinel: auto-load older messages when scrolling near top
    // BOTTOM sentinel: auto-load newer messages when scrolling near bottom
    //   (only fires in historical view where hasMoreAfter=true)
    // Both are protected by suppressScrollLoadRef to prevent loops from
    // programmatic scrolls.
    useEffect(() => {
      const outer = outerRef.current;
      if (!outer) return;

      const observerOptions: IntersectionObserverInit = {
        root: outer,
        rootMargin: "100px 0px 100px 0px", // trigger before reaching edge
        threshold: 0,
      };

      // Top sentinel — load older messages
      const topObserver = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasMoreBefore && !loadingOlder && !olderError) {
          if (!suppressScrollLoadRef.current) {
            onScrollToTop?.();
          }
        }
      }, observerOptions);

      // Bottom sentinel — load newer messages (historical view only)
      const bottomObserver = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasMoreAfter && !loadingNewer && !newerError) {
          if (!suppressScrollLoadRef.current) {
            onLoadNewer?.();
          }
        }
      }, observerOptions);

      if (topSentinelRef.current) topObserver.observe(topSentinelRef.current);
      if (bottomSentinelRef.current) bottomObserver.observe(bottomSentinelRef.current);

      return () => {
        topObserver.disconnect();
        bottomObserver.disconnect();
      };
    }, [hasMoreBefore, hasMoreAfter, loadingOlder, loadingNewer, olderError, newerError, onScrollToTop, onLoadNewer]);

    // ── Scroll position restoration per conversation ────────────────────────
    // Save scroll position when conversation changes away
    useEffect(() => {
      if (!scrollRestoreKey) return;
      const outer = outerRef.current;
      if (!outer) return;
      // Save current scroll state
      scrollRestoreRef.current = {
        key: scrollRestoreKey,
        scrollTop: outer.scrollTop,
        scrollHeight: outer.scrollHeight,
      };
    }, [scrollRestoreKey]);

    // Restore scroll position when returning to a conversation
    useLayoutEffect(() => {
      if (!scrollRestoreKey) return;
      const outer = outerRef.current;
      if (!outer) return;
      const saved = scrollRestoreRef.current;
      if (saved && saved.key === scrollRestoreKey && saved.scrollHeight > 0) {
        // Only restore if we're not in initial load
        if (didInitialScroll.current && rows.length > 2) {
          const heightRatio = outer.scrollHeight / saved.scrollHeight;
          outer.scrollTop = saved.scrollTop * heightRatio;
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scrollRestoreKey]);

    // Helper: suppress scroll loads for a short period, then re-enable.
    // This prevents loops where programmatic scroll → scroll handler → load →
    // programmatic scroll → ...
    const suppressScrollLoadsTemporarily = useCallback((ms = 400) => {
      suppressScrollLoadRef.current = true;
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current = setTimeout(() => {
        suppressScrollLoadRef.current = false;
      }, ms);
    }, []);

    // Cleanup suppress timer on unmount
    useEffect(() => {
      return () => {
        if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      };
    }, []);

    const msgRowCount = useMemo(
      () => rows.filter((r) => r.type === "message").length,
      [rows]
    );

    const toggleMessageExpand = useCallback((id?: string | number) => {
      if (!id) return;
      const key = String(id);
      const willExpand = !expandedMessageIdsRef.current.has(key);
      setExpandedMessageIds((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      // When expanding a long message, scroll it into view so the newly
      // revealed content stays visible (WhatsApp behavior). Wait a frame
      // for the DOM to re-render with the expanded height before scrolling.
      if (willExpand) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const outer = outerRef.current;
            if (!outer) return;
            const el = outer.querySelector(`[data-message-id="${key}"]`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          });
        });
      }
    }, []);

    // ── Scroll anchoring: capture before older messages prepend ─────────────
    useLayoutEffect(() => {
      if (loadingOlder && !scrollAnchorRef.current) {
        const outer = outerRef.current;
        if (!outer) return;
        scrollAnchorRef.current = {
          scrollHeight: outer.scrollHeight,
          scrollTop: outer.scrollTop,
        };
      }
    }, [loadingOlder]);

    // ── Scroll anchoring: restore after rows change (older messages prepended) ─
    useLayoutEffect(() => {
      const outer = outerRef.current;
      if (!outer || !scrollAnchorRef.current) return;

      const prev = scrollAnchorRef.current;
      const heightDiff = outer.scrollHeight - prev.scrollHeight;
      outer.style.scrollBehavior = "auto";
      outer.scrollTop = prev.scrollTop + heightDiff;
      outer.style.scrollBehavior = "";
      distanceFromBottomRef.current =
        outer.scrollHeight - outer.clientHeight - outer.scrollTop;
      scrollAnchorRef.current = null;
    }, [rows]);

    // ── Conversation change: reset ──────────────────────────────────────────
    useLayoutEffect(() => {
      const id = selectedCustomer?.ConversationId;
      if (id === prevConvIdRef.current) return;
      prevConvIdRef.current = id;
      didInitialScroll.current = false;
      wasAutoLoadingNewerRef.current = false;
      wasLoadingNewerRef.current = false;
      isScrollingToBottomRef.current = false;
      wasLoadingOlderRef.current = false;
      distanceFromBottomRef.current = 0;
      suppressScrollLoadRef.current = true; // suppress until initial scroll done
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      if (isAtBottomRef) isAtBottomRef.current = true; // reset to true on conv change
      setShowScrollBtn(false);
      setListVisible(false);
      setExpandedMessageIds(new Set());
      if (convLoadTimerRef.current) clearTimeout(convLoadTimerRef.current);
      // Fallback: if data doesn't arrive in 1.5s, show whatever we have
      convLoadTimerRef.current = setTimeout(() => setListVisible(true), 1500);
    }, [selectedCustomer?.ConversationId]);

    useEffect(() => {
      return () => {
        if (convLoadTimerRef.current) clearTimeout(convLoadTimerRef.current);
      };
    }, []);

    // ── Initial scroll-to-bottom + auto-scroll on new messages ───────────────
    // Does NOT handle scroll-anchor restore (that's in a separate effect above).
    useLayoutEffect(() => {
      const outer = outerRef.current;
      if (!outer) return;

      // Skip if loading older (scroll-anchor effect handles it)
      if (loadingOlder) {
        wasLoadingOlderRef.current = true;
        return;
      }

      // Skip if loading newer — but track it so we know when it finishes.
      // Only set wasAutoLoadingNewerRef if this is the initial auto-load
      // sequence (not user-triggered scroll-down load).
      if (loadingNewer) {
        if (isAutoLoadingNewerRef?.current || isScrollingToBottomRef.current) {
          wasAutoLoadingNewerRef.current = true;
        } else {
          // User-triggered newer load (sentinel) — track so we can skip
          // the auto-scroll-to-bottom after append and preserve position.
          wasLoadingNewerRef.current = true;
        }
        return;
      }

      // After initial auto-load-newer OR progressive scroll-to-bottom
      // finishes, scroll to the actual bottom.
      // For user-triggered newer loads (scrolling down in history), DON'T
      // scroll to bottom — just let the new content appear below naturally.
      if (wasAutoLoadingNewerRef.current) {
        wasAutoLoadingNewerRef.current = false;
        wasLoadingNewerRef.current = false;
        outer.style.scrollBehavior = "auto";
        outer.scrollTop = outer.scrollHeight;
        outer.style.scrollBehavior = "";
        distanceFromBottomRef.current = 0;
        if (isAtBottomRef) isAtBottomRef.current = true;
        setShowScrollBtn(false);
        suppressScrollLoadsTemporarily(500);
        prevMsgCountRef.current = msgRowCount;

        // ── Progressive scroll-to-bottom: if we're still in a historical
        // view (hasMoreAfter=true), keep loading the next page of newer
        // messages. This gives a smooth scroll-through effect instead of
        // a jarring jump to the latest. Stops when hasMoreAfter=false.
        if (isScrollingToBottomRef.current) {
          if (hasMoreAfter) {
            // More pages to load — continue progressive scroll
            onLoadNewer?.();
          } else {
            // Reached the actual latest — done
            isScrollingToBottomRef.current = false;
          }
        }
        return;
      }

      // Skip auto-scroll when a blink is pending (search redirect) —
      // scrollToMessage will handle positioning via requestAnimationFrame
      if (blinkRef.current) {
        prevMsgCountRef.current = msgRowCount;
        return;
      }

      // 1. Initial scroll-to-bottom on conversation open
      if (!didInitialScroll.current) {
        if (!rows || rows.length <= 2) {
          if (convLoadTimerRef.current) clearTimeout(convLoadTimerRef.current);
          convLoadTimerRef.current = setTimeout(() => setListVisible(true), 200);
          return;
        }
        // Use requestAnimationFrame to scroll after the DOM is painted.
        // This ensures scrollHeight is correct after the rows render,
        // avoiding a race where the scroll position is stale.
        const scrollToBottom = () => {
          outer.style.scrollBehavior = "auto";
          outer.scrollTop = outer.scrollHeight;
          outer.style.scrollBehavior = "";
          distanceFromBottomRef.current = 0;
          didInitialScroll.current = true;
          suppressScrollLoadsTemporarily(500);
          if (isAtBottomRef) isAtBottomRef.current = true;
          if (convLoadTimerRef.current) clearTimeout(convLoadTimerRef.current);
          // Make the list visible AFTER scroll is set, then do a second
          // rAF pass to correct any drift from media/layout changes.
          setListVisible(true);
          requestAnimationFrame(() => {
            const o = outerRef.current;
            if (o) {
              o.style.scrollBehavior = "auto";
              o.scrollTop = o.scrollHeight;
              o.style.scrollBehavior = "";
            }
          });
        };
        // Double rAF: first frame paints the rows, second frame has correct height
        requestAnimationFrame(() => requestAnimationFrame(scrollToBottom));
        return;
      }

      // 3. Auto-scroll on new messages
      const prev = prevMsgCountRef.current;
      const curr = msgRowCount;
      prevMsgCountRef.current = curr;
      if (curr <= prev || curr === 0) return;
      if (wasLoadingOlderRef.current) {
        wasLoadingOlderRef.current = false;
        return;
      }
      // Skip auto-scroll if we just finished a user-triggered newer load
      // (sentinel-triggered). The new rows were appended at the bottom;
      // we want to preserve the user's scroll position, NOT jump to the
      // actual bottom. The user was "near bottom" only because that's what
      // triggered the sentinel — that doesn't mean they want to jump to
      // the very last message.
      if (wasLoadingNewerRef.current) {
        wasLoadingNewerRef.current = false;
        // Recompute distance from bottom after the new rows rendered so
        // subsequent scroll state is accurate.
        distanceFromBottomRef.current =
          outer.scrollHeight - outer.clientHeight - outer.scrollTop;
        return;
      }
      const lastMsgRow = [...rows].reverse().find((r) => r.type === "message");
      const isOutgoing = (lastMsgRow as { msg?: ChatMessage })?.msg?.Direction === 1;
      const isNearBottom = distanceFromBottomRef.current <= 100;
      if (isOutgoing || isNearBottom) {
        outer.style.scrollBehavior = "auto";
        outer.scrollTop = outer.scrollHeight;
        outer.style.scrollBehavior = "";
        setShowScrollBtn(false);
        // Suppress scroll loads after programmatic scroll-to-bottom
        // (prevents loadNewerMessages loop when hasMoreAfter is true)
        suppressScrollLoadsTemporarily(500);
      }
    }, [rows, msgRowCount, loadingOlder, loadingNewer, hasMoreAfter, onLoadNewer, suppressScrollLoadsTemporarily]);

    // ── ResizeObserver: keep at bottom when content height changes ───────────
    // When images/media load or lazy content renders, the scrollHeight grows.
    // If the user was at the bottom, we need to scroll down to stay at the
    // bottom — otherwise messages appear "not at the bottom".
    useEffect(() => {
      const outer = outerRef.current;
      if (!outer) return;
      const inner = outer.firstElementChild as HTMLElement | null;
      if (!inner) return;

      const resizeObserver = new ResizeObserver(() => {
        // Only auto-correct if user is at/near the bottom
        if (distanceFromBottomRef.current <= 100 && didInitialScroll.current) {
          outer.style.scrollBehavior = "auto";
          outer.scrollTop = outer.scrollHeight;
          outer.style.scrollBehavior = "";
          distanceFromBottomRef.current = 0;
        }
      });
      resizeObserver.observe(inner);
      return () => resizeObserver.disconnect();
    }, []);

    // ── Expose scroll container (only when ref changes, not every render) ────
    useEffect(() => {
      containerRef.current = outerRef.current;
      onContainerRef?.(outerRef.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Scroll handler ──────────────────────────────────────────────────────
    // Pagination is handled by IntersectionObserver sentinels, not by scroll
    // threshold checks. This handler only tracks bottom state and flush.
    const onListScroll = useCallback(() => {
      const outer = outerRef.current;
      if (!outer) return;
      const { scrollTop, scrollHeight, clientHeight } = outer;
      const dist = scrollHeight - clientHeight - scrollTop;
      distanceFromBottomRef.current = dist;
      setShowScrollBtn(dist > 300);

      // Track whether user is at/near bottom for socket message buffering
      const atBottom = dist <= 100;
      if (isAtBottomRef) isAtBottomRef.current = atBottom;

      // If user scrolls back to bottom and there are pending new messages,
      // flush them automatically (WhatsApp behavior)
      if (atBottom && pendingNewCountRef.current > 0 && onFlushNewMessages) {
        onFlushNewMessages();
      }
    }, [isAtBottomRef, onFlushNewMessages]);

    // ── scrollToMessage ─────────────────────────────────────────────────────
    const scrollToMessage = useCallback(
      async (messageId: string | number, attachmentId?: string | null) => {
        if (!messageId) return;
        const outer = outerRef.current;
        if (outer) {
          const el = outer.querySelector(`[data-message-id="${String(messageId)}"]`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
        if (scrollToMessageProp) {
          return scrollToMessageProp(messageId, containerRef, attachmentId);
        }
      },
      [scrollToMessageProp]
    );

    const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
      const outer = outerRef.current;
      if (outer) outer.scrollTo({ top: outer.scrollHeight, behavior });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        scrollToMessage,
        scrollToBottom,
      }),
      [scrollToMessage, scrollToBottom]
    );

    // ── Drag-and-drop ───────────────────────────────────────────────────────
    const isExternalFileDrag = useCallback((e: React.DragEvent) => {
      const types = e.dataTransfer.types;
      if (!types?.includes("Files")) return false;
      if (types.includes("text/uri-list") || types.includes("text/html")) return false;
      return true;
    }, []);

    const handleDragEnter = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isExternalFileDrag(e)) return;
        dragCounter.current++;
        if (e.dataTransfer.items?.length > 0) setIsDragging(true);
      },
      [isExternalFileDrag]
    );

    const handleDragLeave = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isExternalFileDrag(e)) return;
        if (--dragCounter.current === 0) setIsDragging(false);
      },
      [isExternalFileDrag]
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    }, []);

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isExternalFileDrag(e)) return;
        setIsDragging(false);
        dragCounter.current = 0;
        if (e.dataTransfer.files?.length > 0 && processFiles) {
          processFiles(Array.from(e.dataTransfer.files));
          e.dataTransfer.clearData();
        }
      },
      [processFiles, isExternalFileDrag]
    );

    const handlePaste = useCallback(
      (e: React.ClipboardEvent) => {
        if (e.clipboardData?.files?.length > 0 && processFiles) {
          processFiles(Array.from(e.clipboardData.files));
        }
      },
      [processFiles]
    );

    // ── Render row ──────────────────────────────────────────────────────────
    const renderRow = useCallback(
      (row: FlattenedRow, _index: number) => {
        if (row.type === "spacer-top" || row.type === "spacer-bottom") {
          return <div key={row.type} style={{ height: 8 }} />;
        }
        if (row.type === "date") {
          return (
            <div
              key={`date:${row.date}:${_index}`}
              style={{ display: "flex", justifyContent: "center", margin: "8px 0 4px 0" }}
            >
              <Typography variant="caption" className="typoDate">
                {formatDateTime(row.date, "dateHeader")}
              </Typography>
            </div>
          );
        }
        if (row.type === "typing") {
          return (
            <div
              key="typing"
              style={{ padding: "0 24px 4px 24px" }}
            >
              <TypingIndicator
                typingStatus={typingStatus}
                isGroup={selectedCustomer?.IsGroup === 1}
              />
            </div>
          );
        }
        const msg = (row as { msg: ChatMessage; msgIndex: number }).msg;
        const msgIndex = (row as { msg: ChatMessage; msgIndex: number }).msgIndex;
        const msgId = msg.Id ?? msg.MessageId;
        return (
          <div
            key={`msg:${msgId ?? msgIndex}`}
            style={{
              padding: isMobile
                ? "0 12px 4px 12px"
                : "0 20px 4px 24px",
            }}
          >
            <MessageItem
              msg={msg}
              index={msgIndex}
              selectedCustomer={selectedCustomer}
              blinkMessageId={blinkMessageId}
              getMessageStatusIcon={getMessageStatusIcon}
              onContextMenu={onContextMenu}
              onMenuClick={onMenuClick}
              onForward={onForward}
              onQuickReaction={onQuickReaction}
              onRemoveReaction={onRemoveReaction}
              onMediaClick={onMediaClick}
              getMediaKey={getMediaKey}
              loadedMedia={loadedMedia}
              markLoaded={markLoaded}
              getMediaSrcForMessage={getMediaSrcForMessage}
              messageById={messageById}
              scrollToMessage={(messageId, _containerRef, attachmentId) =>
                scrollToMessage(messageId, attachmentId)
              }
              containerRef={containerRef}
              isExpanded={expandedMessageIds.has(String(msgId))}
              onToggleExpand={() => toggleMessageExpand(msgId)}
              auth={auth}
            />
          </div>
        );
      },
      [
        typingStatus,
        selectedCustomer,
        blinkMessageId,
        getMessageStatusIcon,
        onContextMenu,
        onMenuClick,
        onForward,
        onQuickReaction,
        onRemoveReaction,
        onMediaClick,
        getMediaKey,
        loadedMedia,
        markLoaded,
        getMediaSrcForMessage,
        messageById,
        scrollToMessage,
        expandedMessageIds,
        toggleMessageExpand,
      ]
    );

    const isEmpty = rows.length <= 2;
    // Show loader when loading (covers old messages during conversation switch)
    // or when the list isn't visible yet (initial mount).
    const showLoader = !listVisible || loading;
    // Crossfade: loader fades out as list fades in
    const loaderOpacity = showLoader ? 1 : 0;

    return (
      <Box
        className="messages-area"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPaste={handlePaste}
        onContextMenu={(e) => {
          if (isMediaPreviewOpen) return;
          e.preventDefault();
        }}
        sx={{ position: "relative", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <DragDropOverlay isDragging={isDragging} />

        {/* Loader overlay — crossfades with the message list */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: alpha(theme.palette.background.default, 0.97),
            zIndex: 20,
            gap: 2,
            opacity: loaderOpacity,
            pointerEvents: loaderOpacity > 0 ? "all" : "none",
            transition: "opacity 0.2s ease",
          }}
        >
          <CircularProgress size={40} thickness={3.5} sx={{ color: "primary.main", opacity: 0.8 }} />
          <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 500, opacity: 0.65 }}>
            Loading messages...
          </Typography>
        </Box>

        <ScrollToBottomButton
          open={listVisible && (showScrollBtn || pendingNewMessages.length > 0)}
          onClick={async () => {
            // Flush buffered new messages first (if any)
            if (pendingNewMessages.length > 0 && onFlushNewMessages) {
              onFlushNewMessages();
            }
            // Already at the latest — just scroll to bottom
            scrollToBottom("smooth");
          }}
          showMenu={hasMoreAfter}
          onJumpToLatest={() => {
            // Flush buffered new messages first (if any)
            if (pendingNewMessages.length > 0 && onFlushNewMessages) {
              onFlushNewMessages();
            }
            onJumpToLatest?.();
          }}
          onLoadOnePage={() => {
            // Flush buffered new messages first (if any)
            if (pendingNewMessages.length > 0 && onFlushNewMessages) {
              onFlushNewMessages();
            }
            // Just scroll to bottom of currently loaded data — no API call
            scrollToBottom("smooth");
          }}
          right={scrollToBottomRightOffset}
          bottom={25}
          unreadCount={pendingNewMessages.length}
        />

        {/* Scrollable list */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            opacity: listVisible ? 1 : 0,
            transform: listVisible ? "translateY(0)" : "translateY(4px)",
            transition: "opacity 0.2s ease, transform 0.2s ease",
            overflow: "hidden",
            pointerEvents: isMediaPreviewOpen ? "none" : "auto",
            filter: isMediaPreviewOpen ? "blur(2px)" : "none",
          }}
        >
          <Box
            ref={outerRef}
            sx={{
              height: "100%",
              overflowY: "auto",
              // Allow horizontal scrolling (e.g. wide media / code blocks) but
              // hide the horizontal scrollbar — vertical scrollbar stays visible.
              overflowX: "auto",
              outline: "none",
              scrollBehavior: "smooth",
              overscrollBehavior: "contain",
              WebkitOverflowScrolling: "touch",
              "&::-webkit-scrollbar": { width: 6 },
              "&::-webkit-scrollbar:horizontal": { display: "none !important" },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: alpha(theme.palette.text.primary, 0.2),
                borderRadius: 3,
              },
              "&::-webkit-scrollbar-thumb:horizontal": { display: "none !important" },
            }}
            onScroll={onListScroll}
          >
            {/* ── TOP SENTINEL (IntersectionObserver target for older pagination) ── */}
            {hasMoreBefore && (
              <div ref={topSentinelRef} style={{ height: 1 }} />
            )}

            {/* ── Loading older indicator ── */}
            {loadingOlder && (
              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1, py: 0.75 }}>
                <CircularProgress size={16} thickness={5} />
                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 500 }}>
                  Loading older messages…
                </Typography>
              </Box>
            )}

            {/* ── Older error / retry ── */}
            {olderError && !loadingOlder && (
              <Box
                onClick={() => onRetryOlder?.()}
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 0.5,
                  py: 1,
                  cursor: "pointer",
                  color: "error.main",
                  "&:hover": { backgroundColor: "rgba(0,0,0,0.03)" },
                }}
              >
                <Typography variant="caption" sx={{ fontSize: "0.75rem", fontWeight: 500 }}>
                  ⚠ Failed to load older messages. Click to retry.
                </Typography>
              </Box>
            )}

            {/* ── Beginning of conversation indicator ── */}
            {!hasMoreBefore && !loadingOlder && rows.length > 0 && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 1.5 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.7rem",
                    color: "text.disabled",
                    fontStyle: "italic",
                  }}
                >
                  This is the beginning of the conversation
                </Typography>
              </Box>
            )}

            {rows.map((row, index) => {
              // ── Unread separator: insert before the anchor message ──
              const showUnreadSeparator =
                unreadAnchorMessageId != null &&
                row.type === "message" &&
                String((row as { msg?: ChatMessage }).msg?.MessageId ??
                       (row as { msg?: ChatMessage }).msg?.Id ?? "") ===
                  String(unreadAnchorMessageId);

              return (
                <React.Fragment key={`row-${index}`}>
                  {showUnreadSeparator && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        px: 2,
                        py: 1,
                        my: 0.5,
                      }}
                    >
                      <Box sx={{ flex: 1, height: 1, backgroundColor: "primary.main", opacity: 0.5 }} />
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          color: "primary.main",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {unreadCount > 0 ? `${unreadCount} unread messages` : "Unread messages"}
                      </Typography>
                      <Box sx={{ flex: 1, height: 1, backgroundColor: "primary.main", opacity: 0.5 }} />
                    </Box>
                  )}
                  {renderRow(row, index)}
                </React.Fragment>
              );
            })}

            {/* ── BOTTOM SENTINEL (auto-load newer when scrolling near bottom) ── */}
            {hasMoreAfter && (
              <div ref={bottomSentinelRef} style={{ height: 1 }} />
            )}

            {/* ── Loading newer indicator ── */}
            {loadingNewer && (
              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1, py: 0.75 }}>
                <CircularProgress size={16} thickness={5} />
                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 500 }}>
                  Loading newer messages…
                </Typography>
              </Box>
            )}

            {/* ── Newer error / retry ── */}
            {newerError && !loadingNewer && (
              <Box
                onClick={() => onRetryNewer?.()}
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 0.5,
                  py: 1,
                  cursor: "pointer",
                  color: "error.main",
                  "&:hover": { backgroundColor: "rgba(0,0,0,0.03)" },
                }}
              >
                <Typography variant="caption" sx={{ fontSize: "0.75rem", fontWeight: 500 }}>
                  ⚠ Failed to load newer messages. Click to retry.
                </Typography>
              </Box>
            )}

            {/* ── Bottom sentinel auto-loads newer messages on scroll ── */}
            {/* No manual button — same smooth auto-load as top sentinel */}
          </Box>
        </Box>
      </Box>
    );
  }
);

MessageList.displayName = "MessageList";
export default memo(MessageList);
