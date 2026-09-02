"use client";

// ─── scrollUtils ────────────────────────────────────────────────────────────
// Pure scroll helpers extracted from MessageList.tsx.
// These functions operate on a scroll container element and do NOT depend on
// React state — they're designed to be called from effects, callbacks, and
// event handlers within the component.

/**
 * Instantly set the scroll position of a container (no smooth animation).
 * Temporarily disables scroll-behavior to avoid CSS `smooth` interference.
 */
export function setScrollTop(
  outer: HTMLElement,
  top: number
): void {
  outer.style.scrollBehavior = "auto";
  outer.scrollTop = top;
  outer.style.scrollBehavior = "";
}

/**
 * Scroll a container to its bottom (latest content).
 * Uses instant jump (not smooth) for programmatic positioning.
 */
export function scrollToBottomInstant(outer: HTMLElement): void {
  setScrollTop(outer, outer.scrollHeight);
}

/**
 * Scroll a container to its bottom with optional smooth behavior.
 */
export function scrollToBottomSmooth(
  outer: HTMLElement,
  behavior: ScrollBehavior = "smooth"
): void {
  outer.scrollTo({ top: outer.scrollHeight, behavior });
}

/**
 * Scroll to a specific message element inside the scroll container.
 * The element is identified by `data-message-id` attribute.
 * Returns true if the element was found and scrolled to, false otherwise.
 */
export function scrollToMessageElement(
  outer: HTMLElement,
  messageId: string | number
): boolean {
  const el = outer.querySelector(
    `[data-message-id="${String(messageId)}"]`
  ) as HTMLElement | null;
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }
  return false;
}

/**
 * Scroll to a message element positioned near the top of the viewport.
 * Used for unread-anchor scrolling so the user sees unread messages
 * flowing downward from the anchor point.
 * Returns true if the element was found and scrolled to, false otherwise.
 */
export function scrollToMessageNearTop(
  outer: HTMLElement,
  messageId: string | number,
  offset = 20
): boolean {
  const el = outer.querySelector(
    `[data-message-id="${String(messageId)}"]`
  ) as HTMLElement | null;
  if (el) {
    setScrollTop(outer, el.offsetTop - offset);
    return true;
  }
  return false;
}

/**
 * Compute the distance from the current scroll position to the bottom.
 */
export function getDistanceFromBottom(outer: HTMLElement): number {
  return outer.scrollHeight - outer.clientHeight - outer.scrollTop;
}

/**
 * Check if the scroll position is at or near the bottom.
 */
export function isAtBottom(outer: HTMLElement, threshold = 100): boolean {
  return getDistanceFromBottom(outer) <= threshold;
}

/**
 * Preserve scroll position when content is prepended (older messages loaded).
 * Captures the current scroll state before the prepend, then adjusts
 * scrollTop by the height difference after the new content is rendered.
 *
 * Usage:
 *   const anchor = captureScrollAnchor(outer);  // before prepend
 *   // ... rows change ...
 *   restoreScrollAnchor(outer, anchor);          // after prepend
 */
export interface ScrollAnchor {
  scrollHeight: number;
  scrollTop: number;
}

export function captureScrollAnchor(outer: HTMLElement): ScrollAnchor {
  return {
    scrollHeight: outer.scrollHeight,
    scrollTop: outer.scrollTop,
  };
}

export function restoreScrollAnchor(
  outer: HTMLElement,
  anchor: ScrollAnchor
): void {
  const heightDiff = outer.scrollHeight - anchor.scrollHeight;
  setScrollTop(outer, anchor.scrollTop + heightDiff);
}

/**
 * Restore a previously saved scroll position proportional to the new
 * content height. Used when returning to a conversation.
 */
export function restoreScrollPosition(
  outer: HTMLElement,
  savedScrollTop: number,
  savedScrollHeight: number
): void {
  if (savedScrollHeight <= 0) return;
  const heightRatio = outer.scrollHeight / savedScrollHeight;
  setScrollTop(outer, savedScrollTop * heightRatio);
}

/**
 * Save the current scroll position for later restoration.
 */
export function saveScrollPosition(outer: HTMLElement): {
  scrollTop: number;
  scrollHeight: number;
} {
  return {
    scrollTop: outer.scrollTop,
    scrollHeight: outer.scrollHeight,
  };
}

/**
 * Double-rAF helper: waits two animation frames before calling the callback.
 * This ensures the DOM has been painted and layout is settled (correct
 * scrollHeight) before performing scroll operations.
 */
export function doubleRequestAnimationFrame(callback: () => void): void {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

/**
 * Perform the initial scroll on conversation open.
 * If an unread anchor message ID is provided and found in the DOM,
 * scrolls to it (near the top). Otherwise scrolls to the bottom.
 *
 * Returns the scroll mode that was used: "anchor" or "bottom".
 */
export type InitialScrollMode = "anchor" | "bottom";

export function performInitialScroll(
  outer: HTMLElement,
  unreadAnchorMessageId?: string | number | null,
  anchorOffset = 20
): InitialScrollMode {
  if (unreadAnchorMessageId != null) {
    if (scrollToMessageNearTop(outer, unreadAnchorMessageId, anchorOffset)) {
      return "anchor";
    }
  }
  scrollToBottomInstant(outer);
  return "bottom";
}

/**
 * Correct scroll position on a second rAF pass after the initial scroll.
 * Re-scrolls to the anchor or bottom to fix any drift from media/layout
 * changes that altered the scrollHeight after the first pass.
 */
export function correctInitialScrollDrift(
  outer: HTMLElement,
  mode: InitialScrollMode,
  unreadAnchorMessageId?: string | number | null,
  anchorOffset = 20
): void {
  if (mode === "anchor" && unreadAnchorMessageId != null) {
    scrollToMessageNearTop(outer, unreadAnchorMessageId, anchorOffset);
  } else {
    scrollToBottomInstant(outer);
  }
}

/**
 * Auto-scroll to bottom on new messages if the user was already near the
 * bottom or if the last message is outgoing (sent by current user).
 * Returns true if scrolled, false if position was preserved.
 */
export function autoScrollOnNewMessage(
  outer: HTMLElement,
  isOutgoingLastMessage: boolean,
  distanceFromBottom: number,
  threshold = 100
): boolean {
  if (isOutgoingLastMessage || distanceFromBottom <= threshold) {
    scrollToBottomInstant(outer);
    return true;
  }
  return false;
}
