"use client";

export function setScrollTop(
  outer: HTMLElement,
  top: number
): void {
  outer.style.scrollBehavior = "auto";
  outer.scrollTop = top;
  outer.style.scrollBehavior = "";
}

export function scrollToBottomInstant(outer: HTMLElement): void {
  setScrollTop(outer, outer.scrollHeight);
}

export function scrollToBottomSmooth(
  outer: HTMLElement,
  behavior: ScrollBehavior = "smooth"
): void {
  outer.scrollTo({ top: outer.scrollHeight, behavior });
}

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

export function getDistanceFromBottom(outer: HTMLElement): number {
  return outer.scrollHeight - outer.clientHeight - outer.scrollTop;
}

export function isAtBottom(outer: HTMLElement, threshold = 100): boolean {
  return getDistanceFromBottom(outer) <= threshold;
}

export interface ScrollAnchor {
  scrollHeight: number;
  scrollTop: number;
  anchorMessageId?: string | number | null;
  anchorOffsetTop?: number;
}

export function captureScrollAnchor(outer: HTMLElement): ScrollAnchor {
  const scrollTop = outer.scrollTop;
  let anchorMessageId: string | number | null = null;
  let anchorOffsetTop = 0;

  // Find the first message element at or below the current scroll top.
  const messageEls = outer.querySelectorAll("[data-message-id]");
  for (let i = 0; i < messageEls.length; i++) {
    const el = messageEls[i] as HTMLElement;
    const elTop = el.offsetTop;
    if (elTop >= scrollTop) {
      anchorMessageId = el.getAttribute("data-message-id");
      anchorOffsetTop = elTop;
      break;
    }
  }

  return {
    scrollHeight: outer.scrollHeight,
    scrollTop,
    anchorMessageId,
    anchorOffsetTop,
  };
}

export function restoreScrollAnchor(
  outer: HTMLElement,
  anchor: ScrollAnchor
): void {
  if (anchor.anchorMessageId) {
    const target = outer.querySelector(
      `[data-message-id="${CSS.escape(String(anchor.anchorMessageId))}"]`
    ) as HTMLElement | null;
    if (target) {
      setScrollTop(outer, target.offsetTop - (anchor.anchorOffsetTop ?? 0) + anchor.scrollTop);
      return;
    }
  }
  // Fallback: height-delta restoration.
  const heightDiff = outer.scrollHeight - anchor.scrollHeight;
  setScrollTop(outer, anchor.scrollTop + heightDiff);
}

export function restoreScrollPosition(
  outer: HTMLElement,
  savedScrollTop: number,
  savedScrollHeight: number
): void {
  if (savedScrollHeight <= 0) return;
  const heightRatio = outer.scrollHeight / savedScrollHeight;
  setScrollTop(outer, savedScrollTop * heightRatio);
}


export function saveScrollPosition(outer: HTMLElement): {
  scrollTop: number;
  scrollHeight: number;
} {
  return {
    scrollTop: outer.scrollTop,
    scrollHeight: outer.scrollHeight,
  };
}

export function doubleRequestAnimationFrame(callback: () => void): void {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

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
