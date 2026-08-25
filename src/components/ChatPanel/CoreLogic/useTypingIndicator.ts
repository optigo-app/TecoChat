"use client";

// ─── useTypingIndicator ─────────────────────────────────────────────────────
// Ported from OldChatReactCode/.../hooks/Conversaction/useTypingIndicator.js
// Listens for typing events on the socket and exposes the current typing state.

import { useState, useEffect, useRef } from "react";
import { addInternalTypingHandler } from "../../../socket";
import type { TypingStatus } from "../../../types/message";

export function useTypingIndicator(
  conversationId: string | number | undefined,
  currentUserId: string | undefined
): TypingStatus | null {
  const [typingStatus, setTypingStatus] = useState<TypingStatus | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const convIdRef = useRef(conversationId);
  const currentUserIdRef = useRef(currentUserId);

  useEffect(() => {
    convIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // Clear typing status whenever conversation changes
  useEffect(() => {
    setTypingStatus(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setTypingStatus(null);
      return;
    }

    const handler = (data: Record<string, unknown>) => {
      if (!data) return;
      const incomingConvId = data.ConversationId as string | number;
      if (!incomingConvId || Number(incomingConvId) !== Number(convIdRef.current))
        return;

      // Filter out self-typing events (don't show "typing" on your own side)
      if (Number(data.SenderId) === Number(currentUserIdRef.current)) return;

      const isStopped =
        data.isTyping === false || data.isTyping === 0 || data.isTyping === "false";
      if (isStopped) {
        setTypingStatus(null);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      } else {
        setTypingStatus({
          isTyping: true,
          UserName: (data.UserName as string) || (data.senderName as string) || "Someone",
          ConversationId: incomingConvId,
          ufcc: data.ufcc as string,
          ProfileImageUrl: data.ProfileImageUrl as string,
          ProfileImage: data.ProfileImage as string,
        });
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setTypingStatus(null), 5000);
      }
    };

    const unsub = addInternalTypingHandler(handler);
    return () => {
      unsub();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [conversationId]);

  return typingStatus;
}
