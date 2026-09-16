"use client";

// ─── useTypingEmitter ───────────────────────────────────────────────────────
// Ported from OldChatReactCode/.../Conversation/ChatBox.js typing logic.
// Emits typing indicators via socket when the user types in the chat input.
// Throttled to 1 second between emits, with auto-stop after 1 second of
// inactivity.

import { useCallback, useEffect, useRef } from "react";
import { emitInternalTyping } from "../../../socket";
import type { AuthData } from "../../../contexts/LoginData";
import type { ConversationListEntry } from "../../../types/conversation";

interface UseTypingEmitterOptions {
  auth: AuthData | null;
  selectedCustomer: ConversationListEntry | null;
  fetchAndCacheGroupMembers?: (
    convId: string | number
  ) => Promise<{ members: Array<{ UserId?: number; userId?: number; id?: number }> } | null>;
}

export function useTypingEmitter({
  auth,
  selectedCustomer,
  fetchAndCacheGroupMembers,
}: UseTypingEmitterOptions) {
  const lastTypingEmitRef = useRef(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevConversationRef = useRef<ConversationListEntry | null>(null);
  const selectedCustomerRef = useRef<ConversationListEntry | null>(selectedCustomer);

  useEffect(() => {
    selectedCustomerRef.current = selectedCustomer;
  }, [selectedCustomer]);

  const emitTypingEvent = useCallback(
    async (isTyping: boolean, customer: ConversationListEntry | null) => {
      if (!customer?.ConversationId || !auth) return;

      const senderId = auth?.id || auth?.userId;
      const isGroup = customer?.IsGroup === 1;
      let receiverIdValue: string | number | number[];

      if (isGroup && fetchAndCacheGroupMembers) {
        try {
          const groupData = await fetchAndCacheGroupMembers(customer.ConversationId);
          const memberIds = (groupData?.members || [])
            .map((m) => Number(m.UserId || m.userId || m.id))
            .filter(Boolean);
          receiverIdValue = memberIds.length > 0 ? memberIds : [];
        } catch {
          receiverIdValue = [];
        }
      } else {
        receiverIdValue =
          (customer.ReceiverId as string | number) ||
          (customer.UserId as string | number) ||
          (customer.CustomerId as string | number) ||
          "";
      }

      console.log("[TYPING EMIT] Sending typing event:", {
        ConversationId: customer.ConversationId,
        SenderId: senderId,
        IsGroup: isGroup ? 1 : 0,
        UserName: auth?.username || auth?.name,
      });

      emitInternalTyping({
        ConversationId: customer.ConversationId,
        SenderId: senderId,
        ReceiverId: receiverIdValue,
        IsGroup: isGroup ? 1 : 0,
        UserName: auth?.username || auth?.name,
        FirstName: (auth as any)?.firstName || (auth as any)?.FirstName || (auth as any)?.firstname,
        LastName: (auth as any)?.lastName || (auth as any)?.LastName || (auth as any)?.lastname,
        ProfileImageUrl: auth?.ProfileImageUrl || auth?.profileImage || auth?.AvatarUrl || "",
        ProfileImage: auth?.ProfileImage || auth?.profileImage || auth?.AvatarUrl || "",
        ufcc: auth?.ufcc,
        isTyping,
      });
    },
    [auth, fetchAndCacheGroupMembers]
  );

  // Called when the user types in the input. Throttled to 1s.
  const onTextChange = useCallback(
    (hasContent: boolean) => {
      const convId = selectedCustomer?.ConversationId;
      if (!convId) return;

      // If conversation changed, emit stop-typing for the old conversation
      const prevCustomer = prevConversationRef.current;
      if (
        prevCustomer?.ConversationId &&
        prevCustomer.ConversationId !== convId
      ) {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
        emitTypingEvent(false, prevCustomer);
      }
      prevConversationRef.current = selectedCustomer;

      // Clear any pending timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      const now = Date.now();

      if (hasContent) {
        // Throttle: only emit typing every 1 second
        if (now - lastTypingEmitRef.current > 1000) {
          emitTypingEvent(true, selectedCustomer);
          lastTypingEmitRef.current = now;
        }
        // Auto-stop after 1 second of no new input
        const customerAtSetTime = selectedCustomer;
        typingTimeoutRef.current = setTimeout(() => {
          // Only emit stop-typing if the user is still on the same conversation
          const currentCustomer = selectedCustomerRef.current;
          if (
            currentCustomer?.ConversationId &&
            customerAtSetTime?.ConversationId === currentCustomer.ConversationId
          ) {
            emitTypingEvent(false, customerAtSetTime);
          }
          typingTimeoutRef.current = null;
        }, 1000);
      } else {
        // Content cleared — stop typing immediately
        emitTypingEvent(false, selectedCustomer);
        lastTypingEmitRef.current = 0;
      }
    },
    [emitTypingEvent, selectedCustomer]
  );

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    // Emit stop-typing when leaving
    if (selectedCustomer?.ConversationId) {
      emitTypingEvent(false, selectedCustomer);
    }
  }, [emitTypingEvent, selectedCustomer]);

  return { onTextChange, cleanup };
}
