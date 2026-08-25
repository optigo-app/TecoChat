"use client";

import { useRef, useCallback } from "react";
import { addReactionApi } from "../../../API/SendMessage/addReactionApi";
import { removeReactionApi } from "../../../API/SendMessage/removeReactionApi";
import { emitSendReaction, emitRemoveReaction } from "../../../socket";
import { MSG, type MsgAction } from "./conversationReducer";
import type { ChatMessage } from "../../../types/message";
import type { AuthData } from "../../../context/LoginData";
import type { ConversationListEntry } from "../../../types/conversation";

interface UseReactionsProps {
  auth: AuthData | null;
  selectedCustomer: ConversationListEntry | null;
  dispatchMsg: React.Dispatch<MsgAction>;
  messagesRef: React.MutableRefObject<ChatMessage[]>;
  fetchAndCacheGroupMembers?: (convId: string | number) => Promise<{ members: Array<{ UserId?: number; userId?: number; id?: number }> } | null>;
}

export function useReactions({
  auth,
  selectedCustomer,
  dispatchMsg,
  messagesRef,
  fetchAndCacheGroupMembers,
}: UseReactionsProps) {
  const reactionRequestStateRef = useRef(new Map<string, { inFlight: boolean; lastSentAt: number; lastEmoji: string | null }>());

  const handleMessageEmojiClick = useCallback(
    async (emoji: string, message: ChatMessage) => {
      try {
        const messageIdToUse = message?.MessageId ?? message?.Id;
        if (!messageIdToUse) return;

        const key = String(messageIdToUse);
        const now = Date.now();
        const prevState = reactionRequestStateRef.current.get(key) || { inFlight: false, lastSentAt: 0, lastEmoji: null };

        if (prevState.inFlight) return;
        if (now - (prevState.lastSentAt || 0) < 700) return;

        prevState.inFlight = true;
        prevState.lastSentAt = now;
        prevState.lastEmoji = emoji;
        reactionRequestStateRef.current.set(key, prevState);

        // Get latest message from ref
        const list = messagesRef.current || [];
        const latestMsg = list.find((m) => String(m?.MessageId ?? m?.Id) === String(messageIdToUse)) || message;

        let currentReactions: Array<{ Reaction?: string; Emoji?: string; Direction?: number; UserId?: number; UserName?: string; Unified?: string }> = [];
        if (latestMsg?.ReactionEmojis) {
          try {
            currentReactions = typeof latestMsg.ReactionEmojis === "string"
              ? JSON.parse(latestMsg.ReactionEmojis)
              : Array.isArray(latestMsg.ReactionEmojis) ? latestMsg.ReactionEmojis : [];
          } catch {
            currentReactions = [];
          }
        }

        const existingIndex = currentReactions.findIndex(
          (r) => r.Direction === 1 && r.Reaction === emoji
        );

        let updatedReactions: typeof currentReactions;
        let reactionPayload: string;
        let apiEmoji: string;

        if (existingIndex >= 0) {
          currentReactions.splice(existingIndex, 1);
          updatedReactions = currentReactions;
          reactionPayload = "";
          apiEmoji = "";
        } else {
          const filtered = currentReactions.filter((r) => r.Direction !== 1);
          const newReaction = {
            Reaction: emoji,
            Direction: 1,
            UserName: String(auth?.username || auth?.UserName || auth?.name || ""),
            UserId: Number(auth?.id || auth?.userId || 0),
          };
          updatedReactions = [...filtered, newReaction];
          reactionPayload = JSON.stringify(updatedReactions);
          apiEmoji = emoji;
        }

        await addReactionApi(auth, { messageId: messageIdToUse as string | number, emoji: apiEmoji });

        // Emit socket event
        const senderId = auth?.id ?? auth?.userId;
        const isGroup = (selectedCustomer as { IsGroup?: number })?.IsGroup === 1;
        let receiverIdValue: number | number[];

        if (isGroup && fetchAndCacheGroupMembers && selectedCustomer?.ConversationId != null) {
          try {
            const groupData = await fetchAndCacheGroupMembers(selectedCustomer.ConversationId);
            const memberIds = (groupData?.members || []).map((m) => Number(m.UserId || m.userId || m.id)).filter(Boolean);
            receiverIdValue = memberIds.length > 0 ? memberIds : [Number(selectedCustomer?.ReceiverId)];
          } catch {
            receiverIdValue = [Number(selectedCustomer?.ReceiverId)];
          }
        } else {
          receiverIdValue = Number(selectedCustomer?.ReceiverId);
        }

        if (receiverIdValue && senderId && auth?.ufcc) {
          const socketReactionEmojis = reactionPayload === ""
            ? JSON.stringify([{ Reaction: "", Direction: 0, UserId: senderId }])
            : JSON.stringify([{ Reaction: emoji, Direction: 0, UserId: senderId }]);

          const reactionPayloadData: Record<string, unknown> = {
            ufcc: auth?.ufcc,
            userId: senderId,
            SenderId: senderId,
            ReceiverId: receiverIdValue,
            ConversationId: selectedCustomer?.ConversationId,
            MessageId: messageIdToUse,
            ReactionEmojis: socketReactionEmojis,
          };

          // Always include sender info (not just for groups) so recipient
          // sees who reacted, not "member"
          reactionPayloadData.UserName = auth?.username || auth?.name;
          reactionPayloadData.FirstName = auth?.firstName || auth?.FirstName || (auth as any)?.firstname;
          reactionPayloadData.LastName = auth?.lastName || auth?.LastName || (auth as any)?.lastname;
          if (isGroup) {
            reactionPayloadData.IsGroup = 1;
          }

          emitSendReaction(reactionPayloadData);
        }

        // Update local state
        dispatchMsg({
          type: MSG.UPSERT,
          id: String(messageIdToUse),
          msg: { ReactionEmojis: reactionPayload },
        });

        const finalState = reactionRequestStateRef.current.get(key);
        if (finalState) {
          finalState.inFlight = false;
          reactionRequestStateRef.current.set(key, finalState);
        }
      } catch (error) {
        console.error("Error sending reaction:", error);
        const messageIdToUse = message?.MessageId ?? message?.Id;
        if (messageIdToUse != null) {
          const key = String(messageIdToUse);
          const state = reactionRequestStateRef.current.get(key);
          if (state) {
            state.inFlight = false;
            reactionRequestStateRef.current.set(key, state);
          }
        }
      }
    },
    [auth, selectedCustomer, dispatchMsg, messagesRef, fetchAndCacheGroupMembers]
  );

  const handleRemoveReaction = useCallback(
    async (reaction: { Emoji?: string; Reaction?: string }, message: ChatMessage) => {
      try {
        const messageIdToUse = message?.MessageId ?? message?.Id;
        if (!messageIdToUse || !auth) return;

        const response = await removeReactionApi(auth, { messageId: messageIdToUse as string | number });
        if (response) {
          // Get current message from ref and compute new reactions
          const list = messagesRef.current || [];
          const currentMsg = list.find((m) => String(m?.MessageId ?? m?.Id) === String(messageIdToUse));
          let currentReactions: Array<{ Reaction?: string; Emoji?: string; UserId?: number }> = [];
          try {
            currentReactions = JSON.parse(currentMsg?.ReactionEmojis || "[]");
          } catch {
            currentReactions = [];
          }
          const newReactions = currentReactions.filter(
            (r) =>
              !(
                String(r.UserId) === String(auth?.id ?? auth?.userId) &&
                (r.Emoji === (reaction.Emoji || reaction.Reaction) ||
                  r.Reaction === (reaction.Emoji || reaction.Reaction))
              )
          );

          dispatchMsg({
            type: MSG.UPSERT,
            id: String(messageIdToUse),
            msg: { ReactionEmojis: JSON.stringify(newReactions) },
          });

          // Emit socket event
          const senderId = auth?.id ?? auth?.userId;
          const isGroup = (selectedCustomer as { IsGroup?: number })?.IsGroup === 1;
          let receiverIdValue: number | number[];

          if (isGroup && fetchAndCacheGroupMembers && selectedCustomer?.ConversationId != null) {
            try {
              const groupData = await fetchAndCacheGroupMembers(selectedCustomer.ConversationId);
              const memberIds = (groupData?.members || []).map((m) => Number(m.UserId || m.userId || m.id)).filter(Boolean);
              receiverIdValue = memberIds.length > 0 ? memberIds : [Number(selectedCustomer?.ReceiverId)];
            } catch {
              receiverIdValue = [Number(selectedCustomer?.ReceiverId)];
            }
          } else {
            receiverIdValue = Number(selectedCustomer?.ReceiverId);
          }

          if (receiverIdValue && senderId && auth?.ufcc) {
            emitRemoveReaction({
              ufcc: auth?.ufcc,
              userId: senderId,
              SenderId: senderId,
              ReceiverId: receiverIdValue,
              ConversationId: selectedCustomer?.ConversationId,
              MessageId: messageIdToUse,
              ReactionEmojis: JSON.stringify([{ Reaction: "", Direction: 0, UserId: senderId }]),
              // Always include sender info (not just for groups)
              UserName: auth?.username || auth?.name,
              FirstName: auth?.firstName || auth?.FirstName || (auth as any)?.firstname,
              LastName: auth?.lastName || auth?.LastName || (auth as any)?.lastname,
              ...(isGroup && { IsGroup: 1 }),
            });
          }
        }
      } catch (error) {
        console.error("Error removing reaction:", error);
      }
    },
    [auth, selectedCustomer, dispatchMsg, fetchAndCacheGroupMembers]
  );

  return { handleMessageEmojiClick, handleRemoveReaction };
}
