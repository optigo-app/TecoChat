"use client";

// ─── useSocketHandlers ──────────────────────────────────────────────────────
// Ported from OldChatReactCode/.../CoreLogic/useSocketHandlers.js
// Registers socket event listeners for incoming messages, status changes,
// reactions, and deletions.

import { useEffect, useRef, useCallback } from "react";
import {
  addMessageReactionHandler,
  addInternalMessageHandler,
  addInternalStatusHandler,
  addInternalMessageDeletionHandler,
} from "../../../socket";
import { MSG, type MsgAction } from "./conversationReducer";
import { getMessageId, resolveStatus, normalizeSocketMessage } from "./messageHelpers";
import { normalizeServerMessages } from "../../../utils/messageUtils";
import type { AuthData } from "../../../context/LoginData";
import type { ChatMessage } from "../../../types/message";
import type { ConversationListEntry } from "../../../types/conversation";

interface UseSocketHandlersProps {
  auth: AuthData | null;
  selectedCustomerRef: React.MutableRefObject<ConversationListEntry | null>;
  dispatchMsg: React.Dispatch<MsgAction>;
  handleReadMessage: (convId: string | number, signal?: AbortSignal | null, force?: boolean, skipDrawerCheck?: boolean) => void;
  isAtBottomRef: React.MutableRefObject<boolean>;
}

export function useSocketHandlers({
  auth,
  selectedCustomerRef,
  dispatchMsg,
  handleReadMessage,
  isAtBottomRef,
}: UseSocketHandlersProps) {
  const dispatchRef = useRef(dispatchMsg);
  const handleReadRef = useRef(handleReadMessage);

  useEffect(() => {
    dispatchRef.current = dispatchMsg;
  }, [dispatchMsg]);
  useEffect(() => {
    handleReadRef.current = handleReadMessage;
  }, [handleReadMessage]);

  const addUniqueMessage = useCallback(
    (rawData: Record<string, unknown>) => {
      if (!rawData || typeof rawData !== "object") return;
      const normalized = normalizeSocketMessage(
        rawData,
        auth,
        (arr, a) => normalizeServerMessages(arr, a) as ChatMessage[]
      );
      if (!normalized) return;

      const id = getMessageId(normalized);
      if (!id) return;

      dispatchRef.current({ type: MSG.UPSERT, msg: normalized, id });
    },
    [auth]
  );

  useEffect(() => {
    if (!auth) return;

    const handleChangeStatus = (data: Record<string, unknown>) => {
      if (!data || typeof data !== "object") return;
      setTimeout(() => {
        const messageId = data.MessageId as string | number | undefined;
        const conversationId = data.ConversationId as string | number | undefined;
        if (messageId) {
          dispatchRef.current({ type: MSG.SET_MESS_ID, value: String(messageId) });
          dispatchRef.current({
            type: MSG.SET_STORE_MESS,
            value: { messageId: String(messageId) },
          });
        }
        if (conversationId) {
          dispatchRef.current({ type: MSG.SET_TEMP_CONV, value: conversationId });
        }
       
        const extra: Record<string, unknown> = {};
        if (data.SenderInfo != null) extra.SenderInfo = data.SenderInfo;
        if (data.DateTime != null) extra.DateTime = data.DateTime;
        if (data.Message != null) extra.Message = data.Message;
        dispatchRef.current({
          type: MSG.UPDATE_STATUS,
          messageId,
          conversationId,
          status: resolveStatus(data.MessageStatus ?? data.status ?? data.Status),
          extra,
        });
      });
    };

    const handleReactionMessage = (data: Record<string, unknown>) => {
      if (!data) return;
      setTimeout(() => {
        const messageId = data.MessageId || data.Id || data.id;
        if (!messageId) return;

        let incomingReactions: Array<{ Reaction?: string; UserId?: string | number }> = [];
        try {
          incomingReactions = data.ReactionEmojis
            ? typeof data.ReactionEmojis === "string"
              ? JSON.parse(data.ReactionEmojis)
              : data.ReactionEmojis
            : [];
        } catch {
          incomingReactions = [];
        }

        dispatchRef.current({
          type: MSG.UPDATE_REACTION,
          messageId: messageId as string | number,
          reactions: incomingReactions,
          senderId: data.SenderId as string | number,
        });
      });
    };

    const handleInternalMessage = (data: Record<string, unknown>) => {
      if (!data || typeof data !== "object") return;
      if (
        Number(data?.SenderId) === Number(auth?.id) ||
        Number(data?.Sender) === Number(auth?.id)
      ) {
        return;
      }

      const incomingConvId = data.ConversationId as string | number | undefined;
      const activeConvId = selectedCustomerRef.current?.ConversationId;

      if (
        activeConvId &&
        incomingConvId &&
        Number(activeConvId) === Number(incomingConvId)
      ) {
        setTimeout(() => {
          dispatchRef.current({
            type: MSG.SET_MESS_ID,
            value: String(data.MessageId ?? ""),
          });

          if (isAtBottomRef.current) {
            addUniqueMessage(data);
            handleReadRef.current(incomingConvId, null, false, true);
          } else {
            const normalized = normalizeSocketMessage(
              data,
              auth,
              (arr, a) => normalizeServerMessages(arr, a) as ChatMessage[]
            );
            if (normalized) {
              dispatchRef.current({ type: MSG.BUFFER_NEW, msg: normalized });
            }
          }
        });
      }
    };

    const handleDeleteMessageSocket = (data: Record<string, unknown>) => {
      const myId = Number(auth?.id ?? auth?.userId);
      const senderId = Number(data.UserId ?? data.SenderId ?? data.senderId);
      if (myId && senderId && myId === senderId) return;
      setTimeout(() => {
        dispatchRef.current({
          type: MSG.DELETE_ALL,
          messageId: data.MessageId as string | number,
          deletedInfo: data as Partial<ChatMessage>,
        });
      });
    };

    const r1 = addMessageReactionHandler(handleReactionMessage);
    const r2 = addInternalStatusHandler(handleChangeStatus);
    const r3 = addInternalMessageHandler(handleInternalMessage);
    const r4 = addInternalMessageDeletionHandler(handleDeleteMessageSocket);

    return () => {
      r1();
      r2();
      r3();
      r4();
    };
  }, [auth, addUniqueMessage, selectedCustomerRef, isAtBottomRef]);

  return { addUniqueMessage };
}
