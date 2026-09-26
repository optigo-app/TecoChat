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
import { useSafeLink } from "../../hooks/useSafeLink";
import MessageItem from "./MessageItem";
import { TypingIndicator, ScrollToBottomButton } from "./messages/list";
import DragDropOverlay from "../DragDropOverlay/DragDropOverlay";
import ConfirmationDialog from "../ReusableComponent/ConfirmationDialog";
import type { TypingStatus } from "../../types/message";
import {
  scrollToBottomInstant,
  scrollToBottomSmooth,
  scrollToTopInstant,
  scrollToMessageElement,
  getDistanceFromBottom,
  captureScrollAnchor,
  restoreScrollAnchor,
  restoreScrollPosition,
  saveScrollPosition,
  doubleRequestAnimationFrame,
  performInitialScroll,
  correctInitialScrollDrift,
  autoScrollOnNewMessage,
  type ScrollAnchor,
} from "./CoreLogic/scrollUtils";
import { getMessageId } from "./CoreLogic/messageHelpers";
import { parseReactions } from "../../utils/EmojiUtils";

export interface MessageListRef {
  scrollToMessage: (messageId: string | number, attachmentId?: string | null) => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  scrollToTop: () => void;
  setSkipNextAutoScroll: () => void;
}

interface MessageListProps {
  rows: FlattenedRow[];
  loading: boolean;
  loadingOlder: boolean;
  selectedCustomer: ConversationListEntry | null;
  blinkMessageId: string | null;
  searchHighlightQuery?: string | null;
  searchHighlightMessageId?: string | null;
  typingStatus: TypingStatus | null;
  getMessageStatusIcon: (msg: ChatMessage) => "sent" | "delivered" | "read" | null;
  onContextMenu?: (e: React.MouseEvent, msg: ChatMessage) => void;
  onMenuClick?: (e: React.MouseEvent, msg: ChatMessage) => void;
  onForward?: (msg: ChatMessage, event?: React.MouseEvent) => void;
  onQuickReaction?: (emoji: string, msg: ChatMessage) => void;
  onRemoveReaction?: (reaction: { Emoji?: string; Reaction?: string; UserId?: number | string }, msg: ChatMessage) => void;
  onMediaClick?: (msg: ChatMessage, index: number) => void;
  onRetry?: (msg: ChatMessage) => void;
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
  isAutoLoadingNewerRef?: React.MutableRefObject<boolean>;
  olderError?: boolean;
  newerError?: boolean;
  onRetryOlder?: () => void;
  onRetryNewer?: () => void;
  unreadAnchorMessageId?: string | number | null;
  unreadCount?: number;
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
  noResultsDate?: string | null;
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
      searchHighlightQuery,
      searchHighlightMessageId,
      typingStatus,
      getMessageStatusIcon,
      onContextMenu,
      onMenuClick,
      onForward,
      onQuickReaction,
      onRemoveReaction,
      onMediaClick,
      onRetry,
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
      noResultsDate = null,
    },
    ref
  ) => {
    const theme = useTheme();
    const outerRef = useRef<HTMLDivElement | null>(null);
    const containerRef = useRef<HTMLElement | null>(null);

    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [listVisible, setListVisible] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [stickyDate, setStickyDate] = useState<string | null>(null);
    const [stickyDateVisible, setStickyDateVisible] = useState(false);
    const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(new Set());
    const expandedMessageIdsRef = useRef<Set<string>>(expandedMessageIds);
    useEffect(() => {
      expandedMessageIdsRef.current = expandedMessageIds;
    }, [expandedMessageIds]);
    const isMobile = useIsMobile();

    const { linkDialog, openLinkSafely } = useSafeLink();

    const handleListClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest("a");
        if (!anchor || anchor.target.trim().toLowerCase() !== "_blank") return;
        e.preventDefault();
        const href = anchor.href;
        if (!href) return;
        openLinkSafely(href);
      },
      [openLinkSafely]
    );

    const dragCounter = useRef(0);
    const distanceFromBottomRef = useRef(0);
    const scrollAnchorRef = useRef<ScrollAnchor | null>(null);
    const wasLoadingOlderRef = useRef(false);
    const prevConvIdRef = useRef<string | number | null | undefined>(null);
    const didInitialScroll = useRef(false);
    const convLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevMsgCountRef = useRef(0);
    const blinkRef = useRef<string | null>(null);
    const suppressScrollLoadRef = useRef(true);
    const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // A sentinel intersection that arrived while suppressed is remembered here
    // and fired when suppression clears — otherwise a programmatic scroll can
    // wedge pagination (e.g. sitting at the bottom with hasMoreAfter but the
    // observer never re-firing because nothing changed).
    const deferredSentinelRef = useRef<"top" | "bottom" | null>(null);
    const loadCallbacksRef = useRef({ onScrollToTop, onLoadNewer, hasMoreBefore, hasMoreAfter });
    useEffect(() => {
      loadCallbacksRef.current = { onScrollToTop, onLoadNewer, hasMoreBefore, hasMoreAfter };
    }, [onScrollToTop, onLoadNewer, hasMoreBefore, hasMoreAfter]);
    const skipNextAutoScrollRef = useRef(false);
    const stickyDateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stickyDateRef = useRef<string | null>(null);

    const scrollbarHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const pendingNewCountRef = useRef(0);

    const topSentinelRef = useRef<HTMLDivElement | null>(null);
    const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

    const scrollRestoreRef = useRef<{ key: string | number; scrollTop: number; scrollHeight: number } | null>(null);

    const wasAutoLoadingNewerRef = useRef(false);
    const wasLoadingNewerRef = useRef(false);
    const isScrollingToBottomRef = useRef(false);

    useEffect(() => {
      blinkRef.current = blinkMessageId;
    }, [blinkMessageId]);

    useEffect(() => {
      pendingNewCountRef.current = pendingNewMessages.length;
    }, [pendingNewMessages]);
    
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
        if (!(entries[0]?.isIntersecting) || !hasMoreBefore || loadingOlder || olderError) return;
        // A jump-to-message is in progress (blink set) — pagination must not
        // fire from the programmatic scroll or the target drifts off-screen.
        if (blinkRef.current) return;
        if (suppressScrollLoadRef.current) {
          deferredSentinelRef.current = "top";
          return;
        }
        onScrollToTop?.();
      }, observerOptions);

      const bottomObserver = new IntersectionObserver((entries) => {
        if (!(entries[0]?.isIntersecting) || !hasMoreAfter || loadingNewer || newerError) return;
        if (blinkRef.current) return;
        if (suppressScrollLoadRef.current) {
          deferredSentinelRef.current = "bottom";
          return;
        }
        onLoadNewer?.();
      }, observerOptions);

      if (topSentinelRef.current) topObserver.observe(topSentinelRef.current);
      if (bottomSentinelRef.current) bottomObserver.observe(bottomSentinelRef.current);

      return () => {
        topObserver.disconnect();
        bottomObserver.disconnect();
      };
    }, [hasMoreBefore, hasMoreAfter, loadingOlder, loadingNewer, olderError, newerError, onScrollToTop, onLoadNewer]);

    useEffect(() => {
      if (!scrollRestoreKey) return;
      const outer = outerRef.current;
      if (!outer) return;
      const saved = saveScrollPosition(outer);
      scrollRestoreRef.current = {
        key: scrollRestoreKey,
        scrollTop: saved.scrollTop,
        scrollHeight: saved.scrollHeight,
      };
    }, [scrollRestoreKey]);

    useLayoutEffect(() => {
      if (!scrollRestoreKey) return;
      const outer = outerRef.current;
      if (!outer) return;
      const saved = scrollRestoreRef.current;
      if (saved && saved.key === scrollRestoreKey && saved.scrollHeight > 0) {
        if (didInitialScroll.current && rows.length > 2) {
          restoreScrollPosition(outer, saved.scrollTop, saved.scrollHeight);
        }
      }
    }, [scrollRestoreKey]);

    const suppressScrollLoadsTemporarily = useCallback((ms = 400) => {
      suppressScrollLoadRef.current = true;
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current = setTimeout(() => {
        suppressScrollLoadRef.current = false;
        // Fire a sentinel load that was skipped while suppressed — but only
        // if we're still near that edge (a jump may have moved us away).
        const deferred = deferredSentinelRef.current;
        deferredSentinelRef.current = null;
        const outer = outerRef.current;
        if (!outer || !deferred) return;
        const { onScrollToTop, onLoadNewer, hasMoreBefore, hasMoreAfter } = loadCallbacksRef.current;
        if (deferred === "top" && outer.scrollTop < 150 && hasMoreBefore) {
          onScrollToTop?.();
        } else if (deferred === "bottom" && getDistanceFromBottom(outer) < 150 && hasMoreAfter) {
          onLoadNewer?.();
        }
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

    // ── Typing indicator auto-scroll ────────────────────────────────────────
    // The typing row is appended below the last message but does NOT bump
    // msgRowCount, so the generic auto-scroll never fires for it and the
    // indicator sits below the fold (mobile especially). When typing starts
    // and the user is near the bottom, scroll just enough to reveal it.
    const prevTypingRef = useRef(false);
    useEffect(() => {
      const isTyping = !!typingStatus;
      const becameTyping = isTyping && !prevTypingRef.current;
      prevTypingRef.current = isTyping;
      if (!becameTyping) return;
      const outer = outerRef.current;
      if (!outer || !didInitialScroll.current) return;
      // Live measurement — distanceFromBottomRef can be stale (only updated
      // on scroll events, and the appended row already changed scrollHeight).
      if (getDistanceFromBottom(outer) <= 180) {
        doubleRequestAnimationFrame(() => {
          const o = outerRef.current;
          if (o) scrollToBottomInstant(o);
        });
      }
    }, [typingStatus]);

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

      if (willExpand) {
        doubleRequestAnimationFrame(() => {
          const outer = outerRef.current;
          if (!outer) return;
          scrollToMessageElement(outer, key);
        });
      }
    }, []);

    // ── Scroll anchoring: capture before older messages prepend ─────────────
    useLayoutEffect(() => {
      if (loadingOlder && !scrollAnchorRef.current) {
        const outer = outerRef.current;
        if (!outer) return;
        scrollAnchorRef.current = captureScrollAnchor(outer);
      }
    }, [loadingOlder]);

    useLayoutEffect(() => {
      const outer = outerRef.current;
      if (!outer || !scrollAnchorRef.current) return;

      restoreScrollAnchor(outer, scrollAnchorRef.current);
      distanceFromBottomRef.current = getDistanceFromBottom(outer);
      scrollAnchorRef.current = null;
    }, [rows]);

    useEffect(() => {
      const onPrependPending = () => {
        const outer = outerRef.current;
        if (!outer || !didInitialScroll.current) return;
        if (!scrollAnchorRef.current) {
          scrollAnchorRef.current = captureScrollAnchor(outer);
        }
        wasLoadingOlderRef.current = true;
      };
      window.addEventListener("CHAT_PREPEND_PENDING", onPrependPending);
      return () =>
        window.removeEventListener("CHAT_PREPEND_PENDING", onPrependPending);
    }, []);

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
      setStickyDate(null);
      setStickyDateVisible(false);
      stickyDateRef.current = null;
      linkDialog.close();
      setIsDragging(false);
      dragCounter.current = 0;
      if (convLoadTimerRef.current) clearTimeout(convLoadTimerRef.current);
      convLoadTimerRef.current = setTimeout(() => setListVisible(true), 800);
    }, [selectedCustomer?.ConversationId]);

    useEffect(() => {
      return () => {
        if (convLoadTimerRef.current) clearTimeout(convLoadTimerRef.current);
        if (stickyDateTimerRef.current) clearTimeout(stickyDateTimerRef.current);
        if (scrollbarHideTimerRef.current) clearTimeout(scrollbarHideTimerRef.current);
      };
    }, []);

    useLayoutEffect(() => {
      const outer = outerRef.current;
      if (!outer) return;
      if (loadingOlder) {
        wasLoadingOlderRef.current = true;
        return;
      }

      if (loadingNewer) {
        if (isAutoLoadingNewerRef?.current || isScrollingToBottomRef.current) {
          wasAutoLoadingNewerRef.current = true;
        } else {
          wasLoadingNewerRef.current = true;
        }
        return;
      }
      if (wasAutoLoadingNewerRef.current) {
        wasAutoLoadingNewerRef.current = false;
        wasLoadingNewerRef.current = false;
        scrollToBottomInstant(outer);
        distanceFromBottomRef.current = 0;
        if (isAtBottomRef) isAtBottomRef.current = true;
        setShowScrollBtn(false);
        suppressScrollLoadsTemporarily(500);
        prevMsgCountRef.current = msgRowCount;
        if (isScrollingToBottomRef.current) {
          if (hasMoreAfter) {
            onLoadNewer?.();
          } else {
            isScrollingToBottomRef.current = false;
          }
        }
        return;
      }
      if (blinkRef.current) {
        prevMsgCountRef.current = msgRowCount;
        return;
      }

      if (!didInitialScroll.current) {
        if (!rows || rows.length <= 2) {
          if (convLoadTimerRef.current) clearTimeout(convLoadTimerRef.current);
          convLoadTimerRef.current = setTimeout(() => setListVisible(true), 200);
          return;
        }

        const performInitialScrollFn = () => {
          const mode = performInitialScroll(outer, unreadAnchorMessageId);

          if (mode === "anchor") {
            distanceFromBottomRef.current = getDistanceFromBottom(outer);
            if (isAtBottomRef) isAtBottomRef.current = false;
          } else {
            distanceFromBottomRef.current = 0;
            if (isAtBottomRef) isAtBottomRef.current = true;
          }

          didInitialScroll.current = true;
          suppressScrollLoadsTemporarily(500);
          if (convLoadTimerRef.current) clearTimeout(convLoadTimerRef.current);
          setListVisible(true);

          // Second rAF pass to correct any drift from media/layout changes
          requestAnimationFrame(() => {
            const o = outerRef.current;
            if (!o) return;
            correctInitialScrollDrift(o, mode, unreadAnchorMessageId);
          });
        };
        doubleRequestAnimationFrame(performInitialScrollFn);
        return;
      }

      const prev = prevMsgCountRef.current;
      const curr = msgRowCount;
      prevMsgCountRef.current = curr;
      if (curr <= prev || curr === 0) return;
      if (skipNextAutoScrollRef.current) {
        skipNextAutoScrollRef.current = false;
        return;
      }
      if (wasLoadingOlderRef.current) {
        wasLoadingOlderRef.current = false;
        return;
      }
      if (wasLoadingNewerRef.current) {
        wasLoadingNewerRef.current = false;
        distanceFromBottomRef.current = getDistanceFromBottom(outer);
        return;
      }
      const lastMsgRow = [...rows].reverse().find((r) => r.type === "message");
      const isOutgoing = (lastMsgRow as { msg?: ChatMessage })?.msg?.Direction === 1;
      if (autoScrollOnNewMessage(outer, isOutgoing, distanceFromBottomRef.current)) {
        distanceFromBottomRef.current = 0;
        setShowScrollBtn(false);
        suppressScrollLoadsTemporarily(500);
      }
    }, [rows, msgRowCount, loadingOlder, loadingNewer, hasMoreAfter, onLoadNewer, suppressScrollLoadsTemporarily, unreadAnchorMessageId]);

    useEffect(() => {
      const outer = outerRef.current;
      if (!outer) return;
      const inner = outer.firstElementChild as HTMLElement | null;
      if (!inner) return;

      const resizeObserver = new ResizeObserver(() => {
        if (
          !blinkRef.current &&
          distanceFromBottomRef.current <= 100 &&
          didInitialScroll.current
        ) {
          scrollToBottomInstant(outer);
          distanceFromBottomRef.current = 0;
        }
      });
      resizeObserver.observe(inner);
      return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
      containerRef.current = outerRef.current;
      onContainerRef?.(outerRef.current);
    }, []);

    const onListScroll = useCallback(() => {
      const outer = outerRef.current;
      if (!outer) return;

      if (!outer.classList.contains("scrollbar-active")) {
        outer.classList.add("scrollbar-active");
      }
      if (scrollbarHideTimerRef.current) clearTimeout(scrollbarHideTimerRef.current);
      scrollbarHideTimerRef.current = setTimeout(() => {
        outer.classList.remove("scrollbar-active");
      }, 700);

      const dist = getDistanceFromBottom(outer);
      distanceFromBottomRef.current = dist;
      setShowScrollBtn(dist > 300);

      const atBottom = dist <= 100;
      if (isAtBottomRef) isAtBottomRef.current = atBottom;

      if (atBottom && onFlushNewMessages) {
        onFlushNewMessages();
      }

      const outerRect = outer.getBoundingClientRect();
      const dateRows = outer.querySelectorAll<HTMLElement>("[data-date-row]");
      let currentDate: string | null = null;
      for (let i = dateRows.length - 1; i >= 0; i--) {
        const el = dateRows[i];
        const rowTop = el.getBoundingClientRect().top - outerRect.top;
        if (rowTop <= 4) {
          currentDate = el.dataset.dateValue || null;
          break;
        }
      }

      // Update the date text only when it actually changes (avoids re-renders).
      if (currentDate && currentDate !== stickyDateRef.current) {
        stickyDateRef.current = currentDate;
        setStickyDate(currentDate);
      }
      if (currentDate) {
        setStickyDateVisible(true);
      } else {
        // No date row above the viewport top — hide immediately.
        setStickyDateVisible(false);
      }

      if (stickyDateTimerRef.current) clearTimeout(stickyDateTimerRef.current);
      if (currentDate) {
        stickyDateTimerRef.current = setTimeout(() => {
          setStickyDateVisible(false);
        }, 3000);
      }
    }, [isAtBottomRef, onFlushNewMessages]);

    // ── scrollToMessage ─────────────────────────────────────────────────────
    const scrollToMessage = useCallback(
      async (messageId: string | number, attachmentId?: string | null) => {
        if (!messageId) return;
        // Let the prop own scrolling (it decides smooth vs instant + blink) —
        // a second scroll here races the prop's scrollIntoView and makes the
        // list visibly scroll twice.
        if (scrollToMessageProp) {
          return scrollToMessageProp(messageId, containerRef, attachmentId);
        }
        const outer = outerRef.current;
        if (outer) {
          scrollToMessageElement(outer, messageId);
        }
      },
      [scrollToMessageProp, containerRef]
    );

    const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
      const outer = outerRef.current;
      if (outer) scrollToBottomSmooth(outer, behavior);
    }, []);

    const scrollToTop = useCallback(() => {
      const outer = outerRef.current;
      if (outer) {
        scrollToTopInstant(outer);
        distanceFromBottomRef.current = getDistanceFromBottom(outer);
        if (isAtBottomRef) isAtBottomRef.current = false;
        setShowScrollBtn(true);
        didInitialScroll.current = true;
        suppressScrollLoadsTemporarily(500);
        prevMsgCountRef.current = msgRowCount;
      }
    }, [suppressScrollLoadsTemporarily, msgRowCount]);

    useImperativeHandle(
      ref,
      () => ({
        scrollToMessage,
        scrollToBottom,
        scrollToTop,
        setSkipNextAutoScroll: () => {
          skipNextAutoScrollRef.current = true;
        },
      }),
      [scrollToMessage, scrollToBottom, scrollToTop]
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
          const files = Array.from(e.dataTransfer.files);
          e.dataTransfer.clearData();
          requestAnimationFrame(() => processFiles(files));
        }
      },
      [processFiles, isExternalFileDrag]
    );

    useEffect(() => {
      const handleDragEnd = () => {
        setIsDragging(false);
        dragCounter.current = 0;
      };
      window.addEventListener("dragend", handleDragEnd);
      window.addEventListener("drop", handleDragEnd);
      return () => {
        window.removeEventListener("dragend", handleDragEnd);
        window.removeEventListener("drop", handleDragEnd);
      };
    }, []);

    const handlePaste = useCallback(
      (e: React.ClipboardEvent) => {
        if (e.clipboardData?.files?.length > 0 && processFiles) {
          processFiles(Array.from(e.clipboardData.files));
        }
      },
      [processFiles]
    );

    const handleScrollToMessage = useCallback(
      (
        messageId: string | number,
        _containerRef: React.MutableRefObject<HTMLElement | null>,
        attachmentId?: string | null
      ) => scrollToMessage(messageId, attachmentId),
      [scrollToMessage]
    );

    const selectedIsGroup = selectedCustomer?.IsGroup === 1;
    const selectedConvId = selectedCustomer?.ConversationId;

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
              data-date-row
              data-date-value={formatDateTime(row.date, "dateNumeric")}
              style={{
                display: "flex",
                justifyContent: "center",
                margin: "8px 0 4px 0",
                contentVisibility: "auto",
                containIntrinsicSize: "auto 36px",
              }}
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
                isGroup={selectedIsGroup}
              />
            </div>
          );
        }
        const msg = (row as { msg: ChatMessage; msgIndex: number }).msg;
        const msgIndex = (row as { msg: ChatMessage; msgIndex: number }).msgIndex;
        const msgId = getMessageId(msg);
        // Reaction badges hang ~18px below the bubble (position absolute,
        // bottom: -18) — reserve just enough room so they aren't clipped at
        // the scroll container's edge. Quick check first, then parseReactions
        // so rows with only removed-reaction placeholders don't get dead space.
        const re = msg.ReactionEmojis;
        const hasReactions =
          (Array.isArray(re) ? re.length > 0 : !!re && re !== "" && re !== "[]") &&
          parseReactions(re).length > 0;
        const bottomPad = hasReactions ? 20 : 4;
        // Media rows are ~320px; a flat 80px estimate makes far jumps drift
        // badly while real heights resolve. Estimate per message type so
        // content-visibility's placeholder height is closer to reality.
        const isMediaMsg = ["image", "video", "document", "file"].includes(msg.MessageType || "");
        return (
          <div
            key={`msg:${msgId ?? msgIndex}`}
            data-message-id={msgId != null ? String(msgId) : undefined}
            style={{
              padding: isMobile
                ? `0 12px ${bottomPad}px 12px`
                : `0 20px ${bottomPad}px 24px`,
              contentVisibility: "auto",
              containIntrinsicSize: `auto ${isMediaMsg ? 320 : 80}px`,
            }}
          >
            <MessageItem
              msg={msg}
              index={msgIndex}
              isGroup={selectedIsGroup}
              conversationId={selectedConvId}
              blinkMessageId={blinkMessageId}
              searchHighlightQuery={searchHighlightQuery}
              searchHighlightMessageId={searchHighlightMessageId}
              getMessageStatusIcon={getMessageStatusIcon}
              onContextMenu={onContextMenu}
              onMenuClick={onMenuClick}
              onForward={onForward}
              onQuickReaction={onQuickReaction}
              onRemoveReaction={onRemoveReaction}
              onMediaClick={onMediaClick}
              onRetry={onRetry}
              getMediaKey={getMediaKey}
              loadedMedia={loadedMedia}
              markLoaded={markLoaded}
              getMediaSrcForMessage={getMediaSrcForMessage}
              messageById={messageById}
              scrollToMessage={handleScrollToMessage}
              containerRef={containerRef}
              isExpanded={expandedMessageIds.has(String(msgId))}
              onToggleExpand={toggleMessageExpand}
              auth={auth}
            />
          </div>
        );
      },
      [
        typingStatus,
        selectedIsGroup,
        selectedConvId,
        blinkMessageId,
        searchHighlightQuery,
        searchHighlightMessageId,
        getMessageStatusIcon,
        onContextMenu,
        onMenuClick,
        onForward,
        onQuickReaction,
        onRemoveReaction,
        onMediaClick,
        onRetry,
        getMediaKey,
        loadedMedia,
        markLoaded,
        getMediaSrcForMessage,
        messageById,
        handleScrollToMessage,
        expandedMessageIds,
        toggleMessageExpand,
      ]
    );

    const isEmpty = rows.length <= 2;
    // Show loader when loading AND no messages to display.
    // loading is now set to true before the cache read (in useMessageLoader),
    // so this covers the brief IndexedDB read gap too — no more blank state.
    const showLoader = loading && isEmpty;
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
        {isDragging && <DragDropOverlay isDragging={isDragging} />}
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
            backgroundColor: alpha(theme.palette.background.default, 0.85),
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 20,
            gap: 2,
            opacity: loaderOpacity,
            pointerEvents: loaderOpacity > 0 ? "all" : "none",
            transition: "opacity 0.25s ease",
          }}
        >
          <CircularProgress size={32} thickness={3} sx={{ color: "primary.main", opacity: 0.7 }} />
        </Box>

        <ScrollToBottomButton
          open={listVisible && (showScrollBtn || pendingNewMessages.length > 0)}
          onClick={async () => {
            if (pendingNewMessages.length > 0 && onFlushNewMessages) {
              onFlushNewMessages();
            }
            scrollToBottom("smooth");
          }}
          showMenu={hasMoreAfter}
          onJumpToLatest={async () => {
            if (pendingNewMessages.length > 0 && onFlushNewMessages) {
              onFlushNewMessages();
            }
            const loaded = await onJumpToLatest?.();
            if (loaded) {
              let tries = 0;
              const loop = () => {
                const outer = outerRef.current;
                if (!outer) return;
                scrollToBottomInstant(outer);
                distanceFromBottomRef.current = 0;
                if (isAtBottomRef) isAtBottomRef.current = true;
                setShowScrollBtn(false);
                suppressScrollLoadsTemporarily(250);
                if (++tries < 12) requestAnimationFrame(loop);
              };
              requestAnimationFrame(loop);
            } else {
              scrollToBottom("smooth");
            }
          }}
          onLoadOnePage={() => {
            if (pendingNewMessages.length > 0 && onFlushNewMessages) {
              onFlushNewMessages();
            }
            onLoadNewer?.();
            scrollToBottom("smooth");
          }}
          right={scrollToBottomRightOffset}
          bottom={25}
          unreadCount={pendingNewMessages.length}
        />

        <Box
          className="sticky-date-pill"
          sx={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: `translateX(-50%) translateY(${stickyDateVisible ? "0" : "-6px"})`,
            opacity: stickyDateVisible ? 1 : 0,
            transition: "opacity 0.35s ease-out, transform 0.35s ease-out",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontFamily: "var(--font-family)",
              fontSize: "clamp(11px, 0.5vw + 9px, 12px)",
              fontWeight: 500,
              color: "var(--color-text-secondary)",
              backgroundColor: "var(--color-wa-surface-3, var(--color-surface-elevated))",
              padding: "3px 10px",
              borderRadius: "16px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
              display: "block",
            }}
          >
            {stickyDate}
          </Typography>
        </Box>

        {noResultsDate && (
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              justifyContent: "center",
              px: 2,
              width: "100%",
              pointerEvents: "none",
              zIndex: 6,
            }}
          >
            <Box
              sx={{
                bgcolor: "var(--color-surface-elevated)",
                color: "var(--color-text-secondary)",
                px: 3,
                py: 1.25,
                borderRadius: "12px",
                fontSize: "0.8rem",
                fontWeight: 500,
                textAlign: "center",
                maxWidth: "80%",
                border: "1px solid var(--color-border-light)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                animation: "fadeIn 0.3s ease",
              }}
            >
              No messages found on this date
            </Box>
          </Box>
        )}

        {/* Scrollable list */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            opacity: listVisible ? 1 : 0,
            transform: listVisible ? "translateY(0) scale(1)" : "translateY(6px) scale(0.99)",
            transition: "opacity 0.3s ease, transform 0.3s ease",
            overflow: "hidden",
            pointerEvents: isMediaPreviewOpen ? "none" : "auto",
            filter: isMediaPreviewOpen ? "blur(2px)" : "none",
          }}
        >
          <Box
            ref={outerRef}
            className="message-list-scroll"
            sx={{
              height: "100%",
              overflowY: "auto",
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
            onClick={handleListClick}
            onAuxClick={handleListClick}
          >
            {hasMoreBefore && (
              <div ref={topSentinelRef} style={{ height: 1 }} />
            )}

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
              return (
                <React.Fragment key={`row-${index}`}>
                  {renderRow(row, index)}
                </React.Fragment>
              );
            })}

            {hasMoreAfter && (
              <div ref={bottomSentinelRef} style={{ height: 1 }} />
            )}

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

          </Box>
        </Box>

        <ConfirmationDialog
          isOpen={linkDialog.isOpen}
          onClose={linkDialog.close}
          onConfirm={linkDialog.confirm}
          title={linkDialog.title}
          description={linkDialog.description}
          confirmText={linkDialog.confirmText}
          cancelText="Cancel"
          variant={linkDialog.variant}
          icon={linkDialog.icon}
          loading={linkDialog.loading}
        />
      </Box>
    );
  }
);

MessageList.displayName = "MessageList";
export default memo(MessageList);
