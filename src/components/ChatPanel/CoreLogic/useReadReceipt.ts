"use client";

// ─── useReadReceipt ─────────────────────────────────────────────────────────
// Ported from OldChatReactCode/.../CoreLogic/useReadReceipt.js
// Marks messages as read via socket emission and API call.

import { useCallback, useEffect, useRef } from "react";
import { isSocketConnected } from "../../../socket";
import { emitReadReceipt } from "./socketHelpers";
import { readMessageApi } from "../../../API/SendMessage/ReadMessageApi";
import type { AuthData } from "../../../contexts/LoginData";
import type { ChatMessage } from "../../../types/message";
import type { ConversationListEntry } from "../../../types/conversation";

interface UseReadReceiptProps {
  auth: AuthData | null;
  selectedCustomerRef: React.MutableRefObject<ConversationListEntry | null>;
  messagesRef: React.MutableRefObject<ChatMessage[]>;
  isDrawerOpen: boolean;
  onConversationRead?: ((read: boolean) => void) | null;
  fetchAndCacheGroupMembers?: (conversationId: string | number) => Promise<{ members: Array<{ UserId?: number; userId?: number; id?: number }> } | null>;
}

export function useReadReceipt({
  auth,
  selectedCustomerRef,
  messagesRef,
  isDrawerOpen,
  onConversationRead,
  fetchAndCacheGroupMembers,
}: UseReadReceiptProps) {
  const readTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReadConvRef = useRef<string | number | null>(null);
  const lastReadTimeRef = useRef(0);
  const lastReadMsgIdRef = useRef<number | null>(null);

  // Clear pending read timeout on unmount
  useEffect(() => {
    return () => {
      if (readTimeoutRef.current) {
        clearTimeout(readTimeoutRef.current);
        readTimeoutRef.current = null;
      }
    };
  }, []);

  const handleReadMessage = useCallback(
    async (
      custConverId: string | number,
      _signal: AbortSignal | null = null,
      force = false,
      skipDrawerCheck = false
    ) => {
      if (!custConverId) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (!skipDrawerCheck && isDrawerOpen) return;

      const now = Date.now();
      if (!force && lastReadConvRef.current === custConverId && now - lastReadTimeRef.current < 3000)
        return;

      if (readTimeoutRef.current) clearTimeout(readTimeoutRef.current);

      readTimeoutRef.current = setTimeout(async () => {
        try {
          const currentConv = selectedCustomerRef.current;
          if (!currentConv || Number(currentConv.ConversationId) !== Number(custConverId)) return;

          const isGroup = Boolean(currentConv.IsGroup === 1);
          const receiverId =
            (currentConv as { ReceiverId?: string | number })?.ReceiverId ||
            (currentConv as { CustomerId?: string | number })?.CustomerId ||
            (currentConv as { UserId?: string | number })?.UserId;

          // For groups, fetch member IDs to send read receipts to all members
          let receiverIdValue: string | number | number[] = receiverId as string | number;
          if (isGroup && fetchAndCacheGroupMembers) {
            try {
              const groupData = await fetchAndCacheGroupMembers(custConverId);
              const memberIds = (groupData?.members || [])
                .map((m) => Number(m.UserId || m.userId || m.id))
                .filter(Boolean);
              if (memberIds.length > 0) receiverIdValue = memberIds;
            } catch {
              // keep single receiverId
            }
          }

          // Clear the list badge as soon as the user is actually viewing the
          // conversation — even when the socket is offline.
          if (onConversationRead) onConversationRead(true);

          if (isSocketConnected()) {
            const msgs = messagesRef.current;
            const unread = msgs.filter((m) => m.Direction === 0 && Number(m.Status) < 3);
            if (unread.length === 0) return;

            const latestId = Math.max(
              ...unread.map((m) => Number(m.MessageId || m.Id)).filter((id) => !isNaN(id))
            );
            if (lastReadMsgIdRef.current === latestId && lastReadConvRef.current === custConverId)
              return;

            emitReadReceipt(auth, receiverIdValue as string | number | number[], 2, isGroup, custConverId);

            lastReadConvRef.current = custConverId;
            lastReadTimeRef.current = Date.now();
            lastReadMsgIdRef.current = latestId;

            if (onConversationRead) onConversationRead(true);

            // ── Second emit: notify senders when messages are fully read ──
            // Old code calls readMessageApi, and if MsgRead === 1, emits
            // status 3 (fully read / blue ticks) to the unique senders.
            const unreadSenderIds = [
              ...new Set(
                unread
                  .map((m) => Number(m.SenderId ?? (m as { Sender?: number }).Sender))
                  .filter(Boolean)
              ),
            ];

            const readResponse = await readMessageApi(auth, {
              ConversationId: custConverId,
              signal: _signal,
            });

            if (
              readResponse?.Data?.rd?.[0]?.MsgRead === 1 &&
              unreadSenderIds.length > 0
            ) {
              emitReadReceipt(
                auth,
                isGroup ? unreadSenderIds : (receiverIdValue as string | number | number[]),
                3,
                isGroup,
                custConverId
              );
            }
          } else {
            lastReadConvRef.current = custConverId;
            lastReadTimeRef.current = Date.now();
          }
        } catch (err) {
          console.error("handleReadMessage error:", err);
        }
      }, 1000);
    },
    [auth, isDrawerOpen, onConversationRead, selectedCustomerRef, messagesRef, fetchAndCacheGroupMembers]
  );

  return { handleReadMessage };
}
