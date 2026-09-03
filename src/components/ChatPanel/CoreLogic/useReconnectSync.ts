"use client";

import { useEffect, useRef } from "react";
import { useSocketContext } from "../../../context/SocketContext";
import { conversationViewCursor, type CursorDirection } from "../../../API/ConversationView/ConversationView";
import { setSyncState, getSyncState } from "../../../db/outboxCache";
import { saveConversationToCache } from "./messageHelpers";
import { MSG, type MsgAction } from "./conversationReducer";
import type { AuthData } from "../../../context/LoginData";
import type { ChatMessage } from "../../../types/message";

export function useReconnectSync(
  auth: AuthData | null,
  activeConversationId: string | number | null | undefined,
  dispatchMsg: React.Dispatch<MsgAction>
) {
  const { status } = useSocketContext();
  const authRef = useRef(auth);
  const convIdRef = useRef(activeConversationId);
  const prevStatusRef = useRef(status);

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);
  useEffect(() => {
    convIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;

    // Only trigger on reconnect (disconnected → connected)
    if (prevStatus !== "disconnected" || status !== "connected") return;
    if (!auth || !convIdRef.current) return;

    const convId = convIdRef.current;
    let cancelled = false;

    (async () => {
      try {
        const syncState = await getSyncState(authRef.current, convId);
        const cursorId = syncState?.lastMessageId ? Number(syncState.lastMessageId) : 0;

        const response = await conversationViewCursor(
          convId,
          1 as CursorDirection, // AFTER — fetch messages newer than last known
          cursorId,
          50,
          authRef.current,
          undefined,
          undefined,
          0
        );

        if (cancelled || response.data.length === 0) return;

        const newMessages = response.data as ChatMessage[];
        dispatchMsg({ type: MSG.APPEND, data: newMessages, total: response.total });
        saveConversationToCache(convId, newMessages, authRef.current).catch(() => {});

        const latestMsgId = newMessages[newMessages.length - 1]?.MessageId;
        if (latestMsgId) {
          setSyncState(authRef.current, convId, latestMsgId).catch(() => {});
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, auth, activeConversationId, dispatchMsg]);
}
